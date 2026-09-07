//! Layout-aware global hotkey manager using direct Windows `RegisterHotKey` API.
//!
//! Bypasses Tauri's global-shortcut plugin (which hardcodes QWERTY VK codes) by
//! mapping physical scan codes → layout-correct virtual keys via `MapVirtualKeyExW`.
//!
//! Runs a dedicated background thread with a Windows message loop (`GetMessageW`).

use keyboard_types::Code;
use std::collections::HashMap;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::mpsc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info, warn};

/// Current keyboard layout HKL as detected by the timer thread.
/// Updated every 250ms — `get_layout_key_labels()` reads this for instant
/// cache lookups instead of calling Windows APIs on every IPC request.
static CURRENT_HKL: AtomicIsize = AtomicIsize::new(0);

/// Foreground window HWND captured at the moment the clipboard changes.
/// Used by `get_clipboard_source()` as a race-free alternative to calling
/// `GetForegroundWindow()` at async IPC resolve time (50-200ms later).
static LAST_CLIPBOARD_HWND: AtomicIsize = AtomicIsize::new(0);

/// Returns the foreground HWND captured at the last clipboard change event.
pub fn last_clipboard_foreground() -> isize {
    LAST_CLIPBOARD_HWND.load(Ordering::Acquire)
}

use crate::window;

/// Fixed hotkey ID scheme.
pub const ID_MAIN_PRIMARY: i32 = 1;
pub const ID_MAIN_ALTGR: i32 = 2;
pub const ID_PLAIN_PRIMARY: i32 = 3;
pub const ID_PLAIN_ALTGR: i32 = 4;

/// Modifier flags for `RegisterHotKey` (Windows API constants).
pub const MOD_ALT: u32 = 0x0001;
pub const MOD_CONTROL: u32 = 0x0002;
pub const MOD_SHIFT: u32 = 0x0004;
pub const MOD_WIN: u32 = 0x0008;

/// Commands sent from the main thread to the hotkey thread.
enum HotkeyCommand {
    Register {
        id: i32,
        modifiers: u32,
        code: Code,
        result_tx: mpsc::Sender<Result<(), String>>,
    },
    Unregister {
        id: i32,
        result_tx: mpsc::Sender<()>,
    },
    UnregisterAll,
    RegisterNavKeys,
    UnregisterNavKeys,
    Stop,
}

/// Thread-safe handle to the hotkey background thread.
/// Clone + Send — safe to store in Tauri managed state.
pub struct HotkeyManager {
    sender: mpsc::Sender<HotkeyCommand>,
    thread_id: u32,
}

/// Custom message to wake the hotkey thread's `GetMessageW` loop.
const WM_USER: u32 = 0x0400;
const WM_HOTKEY: u32 = 0x0312;
const WM_TIMER: u32 = 0x0113;
const WM_LAYOUT_CHANGED: u32 = WM_USER + 1;
/// Posted by keyboard_hook.rs when a navigation key is pressed in no-focus mode.
/// wParam = VK code (e.g. VK_DOWN=0x28, VK_SPACE=0x20, VK_RETURN=0x0D, VK_ESCAPE=0x1B)
pub(crate) const WM_NAV_KEY: u32 = WM_USER + 2;
/// Click outside the no-focus window (posted by the mouse hook; x in WPARAM, y in LPARAM).
pub(crate) const WM_CLICK_OUTSIDE: u32 = WM_USER + 3;
const WM_CLIPBOARDUPDATE: u32 = 0x031D;
const WM_INPUTLANGCHANGE: u32 = 0x0051;
const LAYOUT_SUBCLASS_ID: usize = 0xBEE7;

impl HotkeyManager {
    /// Spawn the hotkey background thread. Returns immediately.
    pub fn new(app_handle: AppHandle) -> Self {
        let (cmd_tx, cmd_rx) = mpsc::channel::<HotkeyCommand>();
        let (tid_tx, tid_rx) = mpsc::channel::<u32>();

        std::thread::spawn(move || {
            hotkey_thread_main(app_handle, cmd_rx, tid_tx);
        });

        let thread_id = tid_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("hotkey thread failed to send thread ID within 5s");
        info!(thread_id, "HotkeyManager started");

        HotkeyManager {
            sender: cmd_tx,
            thread_id,
        }
    }

    /// Register a hotkey. Blocks until the hotkey thread processes the request.
    pub fn register(&self, id: i32, modifiers: u32, code: Code) -> Result<(), String> {
        let (result_tx, result_rx) = mpsc::channel();
        self.sender
            .send(HotkeyCommand::Register {
                id,
                modifiers,
                code,
                result_tx,
            })
            .map_err(|e| format!("failed to send register command: {}", e))?;
        wake_thread(self.thread_id);
        result_rx
            .recv()
            .map_err(|e| format!("failed to receive register result: {}", e))?
    }

    /// Unregister a hotkey by ID and wait for the native thread to finish.
    pub fn unregister(&self, id: i32) -> Result<(), String> {
        let (result_tx, result_rx) = mpsc::channel();
        self.sender
            .send(HotkeyCommand::Unregister { id, result_tx })
            .map_err(|e| format!("failed to send unregister command: {e}"))?;
        wake_thread(self.thread_id);
        result_rx
            .recv()
            .map_err(|e| format!("failed to receive unregister result: {e}"))
    }

    /// Unregister all hotkeys. Fire-and-forget.
    pub fn unregister_all(&self) {
        let _ = self.sender.send(HotkeyCommand::UnregisterAll);
        wake_thread(self.thread_id);
    }

    /// Register navigation hotkeys for no-focus mode. Fire-and-forget.
    pub fn register_nav(&self) {
        let _ = self.sender.send(HotkeyCommand::RegisterNavKeys);
        wake_thread(self.thread_id);
    }

    /// Unregister navigation hotkeys. Fire-and-forget.
    pub fn unregister_nav(&self) {
        let _ = self.sender.send(HotkeyCommand::UnregisterNavKeys);
        wake_thread(self.thread_id);
    }

    /// Get the background thread ID (for subclass → thread message posting).
    pub fn thread_id(&self) -> u32 {
        self.thread_id
    }
}

impl Drop for HotkeyManager {
    fn drop(&mut self) {
        let _ = self.sender.send(HotkeyCommand::Stop);
        wake_thread(self.thread_id);
    }
}

/// Post `WM_USER` to the hotkey thread to break `GetMessageW` blocking.
fn wake_thread(thread_id: u32) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
        // SAFETY: `thread_id` is the hotkey background thread's ID (valid for the
        // process lifetime); WM_USER with null wParam/lParam is a benign wake-up
        // message; PostThreadMessageW is safe to call from any thread.
        unsafe {
            let _ = PostThreadMessageW(thread_id, WM_USER, None, None);
        }
    }
}

/// A registered hotkey — stores Code + modifiers for re-registration
/// when the keyboard layout changes at runtime.
#[cfg(target_os = "windows")]
struct RegHotkey {
    id: i32,
    modifiers: u32,
    code: Code,
}

/// The hotkey thread's main loop.
fn hotkey_thread_main(
    app_handle: AppHandle,
    cmd_rx: mpsc::Receiver<HotkeyCommand>,
    tid_tx: mpsc::Sender<u32>,
) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetMessageW, KillTimer, PeekMessageW, SetTimer, MSG, PM_NOREMOVE,
        };

        // Force message queue creation with PeekMessage
        let mut msg = MSG::default();
        // SAFETY: PeekMessageW writes into `msg` (stack-allocated MSG); hwnd=None
        // means any window on this thread; PM_NOREMOVE leaves the message in the
        // queue; called here only to ensure the thread has a message queue.
        unsafe {
            let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
        }

        // SAFETY: GetCurrentThreadId takes no arguments and always succeeds;
        // it returns the calling thread's OS ID, valid for the thread's lifetime.
        let tid = unsafe { windows::Win32::System::Threading::GetCurrentThreadId() };
        let _ = tid_tx.send(tid);

        // Track registered hotkeys (with Code) for layout-change re-registration
        let mut registered_hotkeys: Vec<RegHotkey> = Vec::new();
        let mut last_layout: isize = 0;

        // Create a message-only window for receiving WM_CLIPBOARDUPDATE.
        // Captures GetForegroundWindow() at clipboard change time (race-free).
        // SAFETY: RegisterClassW/CreateWindowExW/AddClipboardFormatListener are
        // all standard Win32 APIs called on the hotkey background thread with a
        // valid message queue (PeekMessageW above). `clipboard_wndproc` is a valid
        // `unsafe extern "system"` fn with the required WNDPROC signature.
        // `class_name` is a NUL-terminated UTF-16 literal that outlives the calls.
        // HWND_MESSAGE creates a message-only window (no screen presence, no z-order).
        unsafe {
            use windows::core::w;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{
                CreateWindowExW, RegisterClassW, HMENU, HWND_MESSAGE, WINDOW_EX_STYLE, WNDCLASSW,
                WS_OVERLAPPED,
            };

            unsafe extern "system" fn clipboard_wndproc(
                hwnd: HWND,
                msg: u32,
                wparam: windows::Win32::Foundation::WPARAM,
                lparam: windows::Win32::Foundation::LPARAM,
            ) -> windows::Win32::Foundation::LRESULT {
                windows::Win32::UI::WindowsAndMessaging::DefWindowProcW(hwnd, msg, wparam, lparam)
            }

            let class_name = w!("BeetrootClipboardMonitor");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(clipboard_wndproc),
                lpszClassName: class_name,
                ..Default::default()
            };
            RegisterClassW(&wc);
            if let Ok(hwnd) = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                class_name,
                w!(""),
                WS_OVERLAPPED,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                HMENU::default(),
                None,
                None,
            ) {
                use windows::Win32::System::DataExchange::AddClipboardFormatListener;
                if AddClipboardFormatListener(hwnd).is_ok() {
                    info!("AddClipboardFormatListener installed on message-only window");
                } else {
                    warn!("AddClipboardFormatListener failed");
                }
            } else {
                warn!("Failed to create clipboard monitor window");
            }
        }

        // Poll keyboard layout every 250ms as a fallback for external-window
        // layout changes.  WM_INPUTLANGCHANGE subclass (installed on the Tauri
        // HWND) handles the focused-window case with zero latency.
        // SAFETY: SetTimer with hwnd=None creates a thread-message timer (fires
        // WM_TIMER on this thread); 250ms interval; callback=None means the
        // message is posted rather than calling a callback — fully safe.
        let timer_id = unsafe { SetTimer(None, 0, 250, None) };

        loop {
            // SAFETY: GetMessageW writes into `msg` (stack-allocated MSG);
            // hwnd=None retrieves all messages for this thread (including
            // thread messages posted with PostThreadMessageW); min=0/max=0
            // disables filtering so WM_HOTKEY and WM_TIMER are not missed.
            let ret = unsafe { GetMessageW(&mut msg, None, 0, 0) };
            if !ret.as_bool() {
                // WM_QUIT or error
                break;
            }

            if msg.message == WM_HOTKEY {
                let hotkey_id = msg.wParam.0 as i32;
                handle_hotkey_press(&app_handle, hotkey_id);
            } else if msg.message == WM_TIMER {
                // SAFETY: get_active_keyboard_layout is an `unsafe fn` that only
                // calls Win32 APIs (GetForegroundWindow, GetWindowThreadProcessId,
                // EnumChildWindows, GetKeyboardLayout) with OS-provided handles.
                let current_layout = unsafe { get_active_keyboard_layout() };
                let current_hkl = current_layout.0 as isize;
                handle_layout_change(
                    current_hkl,
                    &mut last_layout,
                    &registered_hotkeys,
                    &app_handle,
                    "timer",
                );
            } else if msg.message == WM_NAV_KEY {
                // Posted by keyboard_hook.rs for modifier-less nav keys
                let vk = msg.wParam.0 as u32;
                dispatch_nav_vk(&app_handle, vk, msg.lParam.0 as u64);
            } else if msg.message == WM_CLICK_OUTSIDE {
                let x = msg.wParam.0 as u32 as i32;
                let y = msg.lParam.0 as i32;
                handle_click_outside(&app_handle, x, y);
            } else if msg.message == WM_LAYOUT_CHANGED {
                // Posted by layout_subclass_proc on WM_INPUTLANGCHANGE
                let new_hkl = msg.wParam.0 as isize;
                handle_layout_change(
                    new_hkl,
                    &mut last_layout,
                    &registered_hotkeys,
                    &app_handle,
                    "subclass",
                );
            } else if msg.message == WM_CLIPBOARDUPDATE {
                // Capture foreground window at the exact moment clipboard changes.
                // get_clipboard_source() reads this cached HWND instead of calling
                // GetForegroundWindow() at async IPC resolve time (race-free).
                // SAFETY: GetForegroundWindow takes no arguments; returns the
                // foreground HWND or null — both are valid isize values to store.
                let fg = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
                LAST_CLIPBOARD_HWND.store(fg.0 as isize, Ordering::Release);
            } else if msg.message == WM_USER {
                // Drain all pending commands
                while let Ok(cmd) = cmd_rx.try_recv() {
                    match cmd {
                        HotkeyCommand::Register {
                            id,
                            modifiers,
                            code,
                            result_tx,
                        } => {
                            let result = register_hotkey_win(id, modifiers, code);
                            if result.is_ok() {
                                registered_hotkeys.retain(|h| h.id != id);
                                registered_hotkeys.push(RegHotkey {
                                    id,
                                    modifiers,
                                    code,
                                });
                            }
                            let _ = result_tx.send(result);
                        }
                        HotkeyCommand::Unregister { id, result_tx } => {
                            unregister_hotkey_win(id);
                            registered_hotkeys.retain(|h| h.id != id);
                            let _ = result_tx.send(());
                        }
                        HotkeyCommand::UnregisterAll => {
                            for hk in &registered_hotkeys {
                                unregister_hotkey_win(hk.id);
                            }
                            registered_hotkeys.clear();
                        }
                        HotkeyCommand::RegisterNavKeys => {
                            register_nav_hotkeys();
                        }
                        HotkeyCommand::UnregisterNavKeys => {
                            unregister_nav_hotkeys();
                        }
                        HotkeyCommand::Stop => {
                            unregister_nav_hotkeys();
                            for hk in &registered_hotkeys {
                                unregister_hotkey_win(hk.id);
                            }
                            registered_hotkeys.clear();
                            // SAFETY: `timer_id` is the ID returned by SetTimer above;
                            // called on the same thread that created the timer (required
                            // by the Win32 API contract); hwnd=None matches the creation call.
                            unsafe {
                                let _ = KillTimer(None, timer_id);
                            }
                            return;
                        }
                    }
                }
            }
        }

        // Cleanup on exit
        for hk in &registered_hotkeys {
            unregister_hotkey_win(hk.id);
        }
        // SAFETY: same as the KillTimer in HotkeyCommand::Stop above.
        unsafe {
            let _ = KillTimer(None, timer_id);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = tid_tx.send(0);
        // Non-Windows: just block on commands (no-op)
        for cmd in cmd_rx {
            if let HotkeyCommand::Stop = cmd {
                break;
            }
        }
    }
}

/// Debounce interval for hotkey presses.  When the user holds the hotkey,
/// Windows sends repeated WM_HOTKEY messages (~30/s).  We ignore repeats
/// within this window to prevent the window from rapidly toggling.
const HOTKEY_DEBOUNCE_MS: u128 = 300;

/// Dispatch a hotkey press based on its ID.
/// Called exclusively from the hotkey background thread (single-threaded).
fn handle_hotkey_press(app_handle: &AppHandle, hotkey_id: i32) {
    thread_local! {
        static LAST_PRESS: std::cell::RefCell<HashMap<i32, Instant>> =
            std::cell::RefCell::new(HashMap::new());
    }

    // Debounce per hotkey ID so that e.g. Ctrl+` held down doesn't
    // block a quick Ctrl+1 pressed shortly after.
    let now = Instant::now();
    let should_skip = LAST_PRESS.with(|cell| {
        let mut map = cell.borrow_mut();
        if let Some(last) = map.get(&hotkey_id) {
            if now.duration_since(*last).as_millis() < HOTKEY_DEBOUNCE_MS {
                return true;
            }
        }
        map.insert(hotkey_id, now);
        false
    });

    if should_skip {
        return;
    }

    match hotkey_id {
        ID_MAIN_PRIMARY | ID_MAIN_ALTGR => {
            // Capture before showing: Explorer's F2 Edit may close on activation.
            #[cfg(target_os = "windows")]
            {
                if let Some(state) = app_handle.try_state::<crate::PreviousForegroundWindow>() {
                    *state.0.lock() = window::capture_paste_target();
                }
            }

            if let Some(win) = app_handle.get_webview_window("main") {
                // Use atomic state instead of win.is_visible() — more reliable
                // when WS_EX_NOACTIVATE is set (no-focus mode).
                if crate::WINDOW_VISIBLE.load(std::sync::atomic::Ordering::SeqCst) {
                    window::hide_and_clear_state(&win);
                } else if win.is_always_on_top().unwrap_or(false) {
                    // Pinned — show in place with focus (user positioned it)
                    // Clear stale WS_EX_NOACTIVATE from previous no-focus show
                    crate::window::clear_no_activate(&win);
                    let _ = win.show();
                    let _ = win.set_focus();
                    crate::WINDOW_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
                    crate::NO_FOCUS_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_handle.emit("no-focus-changed", false);
                } else {
                    let mode = app_handle
                        .try_state::<crate::CurrentWindowMode>()
                        .map(|s| *s.0.lock());
                    match mode {
                        Some(crate::WindowMode::FollowCursor) => {
                            window::show_near_cursor(&win, false);
                        }
                        _ => {
                            window::show_on_active_monitor(&win, false);
                        }
                    }
                }
            }
        }
        ID_PLAIN_PRIMARY | ID_PLAIN_ALTGR => {
            // Capture the target window before emitting the paste event so
            // paste_selected_item's is_window_alive() check sees the real
            // foreground app (not a stale HWND from a prior main-hotkey press).
            #[cfg(target_os = "windows")]
            {
                if let Some(state) = app_handle.try_state::<crate::PreviousForegroundWindow>() {
                    *state.0.lock() = window::capture_paste_target();
                }
            }
            if let Err(e) = app_handle.emit("plain-text-paste", ()) {
                error!(error = %e, "failed to emit plain-text-paste event");
            }
        }
        id if (100..=128).contains(&id) => {
            dispatch_nav_hotkey(app_handle, id);
        }
        _ => {
            warn!(hotkey_id, "unknown hotkey ID fired");
        }
    }
}

/// Get the keyboard layout of the currently focused thread, correctly handling
/// WebView2's separate thread when Beetroot itself is the foreground window.
///
/// When another app is focused, returns that app's thread layout (standard).
/// When Beetroot is focused, Win+Space changes the *WebView2* thread's layout
/// (the child window that actually receives keyboard input), not the Tauri main
/// window thread.  `EnumChildWindows` recursively walks ALL descendant windows
/// at every nesting level (unlike `GetWindow(GW_CHILD)` which only iterates
/// direct children), finding the WebView2 renderer thread reliably.
#[cfg(target_os = "windows")]
unsafe fn get_active_keyboard_layout() -> windows::Win32::UI::Input::KeyboardAndMouse::HKL {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::GetKeyboardLayout;
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetForegroundWindow, GetWindowThreadProcessId,
    };

    struct EnumCtx {
        parent_tid: u32,
        found_tid: u32,
    }

    unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
        let ctx = &mut *(lparam.0 as *mut EnumCtx);
        let child_tid = GetWindowThreadProcessId(hwnd, None);
        if child_tid != 0 && child_tid != ctx.parent_tid {
            ctx.found_tid = child_tid;
            return BOOL(0); // stop enumeration
        }
        BOOL(1) // continue
    }

    let fg = GetForegroundWindow();
    let mut fg_pid = 0u32;
    let fg_tid = GetWindowThreadProcessId(fg, Some(&mut fg_pid));

    if fg_pid == std::process::id() {
        let mut ctx = EnumCtx {
            parent_tid: fg_tid,
            found_tid: 0,
        };
        let _ = EnumChildWindows(fg, Some(enum_cb), LPARAM(&mut ctx as *mut EnumCtx as isize));
        if ctx.found_tid != 0 {
            return GetKeyboardLayout(ctx.found_tid);
        }
    }

    GetKeyboardLayout(fg_tid)
}

/// Shared layout-change handler: updates CURRENT_HKL, re-registers hotkeys,
/// and emits the `keyboard-layout-changed` event.  Called from both the
/// WM_TIMER fallback and the WM_LAYOUT_CHANGED message (posted by subclass).
/// Idempotent — if `new_hkl == *last_layout`, this is a no-op.
#[cfg(target_os = "windows")]
fn handle_layout_change(
    new_hkl: isize,
    last_layout: &mut isize,
    registered_hotkeys: &[RegHotkey],
    app_handle: &AppHandle,
    source: &str,
) {
    CURRENT_HKL.store(new_hkl, Ordering::Relaxed);
    if new_hkl == *last_layout {
        return;
    }
    if *last_layout != 0 && !registered_hotkeys.is_empty() {
        info!(
            old = format!("0x{:X}", *last_layout),
            new = format!("0x{:X}", new_hkl),
            count = registered_hotkeys.len(),
            source,
            "keyboard layout changed, re-registering hotkeys"
        );
        for hk in registered_hotkeys {
            unregister_hotkey_win(hk.id);
        }
        for hk in registered_hotkeys {
            if let Err(e) = register_hotkey_win(hk.id, hk.modifiers, hk.code) {
                warn!(
                    id = hk.id,
                    error = %e,
                    "failed to re-register hotkey after layout change"
                );
            }
        }
    }
    // Send cached labels with the event — frontend uses them
    // directly, no extra IPC round-trip needed.
    let labels = LABEL_CACHE
        .lock()
        .ok()
        .and_then(|c| c.get(&new_hkl).cloned())
        .unwrap_or_default();
    if let Err(e) = app_handle.emit("keyboard-layout-changed", &labels) {
        warn!(error = %e, "failed to emit keyboard-layout-changed");
    }
    *last_layout = new_hkl;
}

/// Install a window subclass on the Tauri main HWND to intercept
/// `WM_INPUTLANGCHANGE` and immediately notify the hotkey background thread.
/// This provides zero-latency layout change detection when Beetroot is focused.
#[cfg(target_os = "windows")]
pub fn install_layout_subclass(hwnd: windows::Win32::Foundation::HWND, hotkey_thread_id: u32) {
    use windows::Win32::UI::Shell::SetWindowSubclass;
    // SAFETY: `hwnd` is the live Tauri main window handle (extracted via
    // raw-window-handle 0.6 in lib.rs setup). `layout_subclass_proc` is a valid
    // `unsafe extern "system"` fn with the required subclass signature.
    // `LAYOUT_SUBCLASS_ID` is a unique usize constant that won't collide with
    // other subclasses; `hotkey_thread_id` is stored as dw_ref_data.
    let ok = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(layout_subclass_proc),
            LAYOUT_SUBCLASS_ID,
            hotkey_thread_id as usize,
        )
    };
    if ok.as_bool() {
        info!("installed WM_INPUTLANGCHANGE subclass on main HWND");
    } else {
        warn!("failed to install WM_INPUTLANGCHANGE subclass");
    }
}

/// Subclass window procedure that forwards `WM_INPUTLANGCHANGE` to the hotkey
/// background thread via `PostThreadMessageW`.  The hotkey thread's message loop
/// handles `WM_LAYOUT_CHANGED` to update CURRENT_HKL and re-register hotkeys.
#[cfg(target_os = "windows")]
unsafe extern "system" fn layout_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _uid_subclass: usize,
    dw_ref_data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;

    // --- No-focus mode: block activation and focus messages ---
    // Prevents WebView2/Chromium from stealing focus when the window becomes visible.
    // Without this, F2 rename in Explorer and similar focus-sensitive operations
    // are interrupted when Beetroot opens.
    const WM_ACTIVATE: u32 = 0x0006;
    const WM_SETFOCUS: u32 = 0x0007;
    const WM_MOUSEACTIVATE: u32 = 0x0021;
    const WA_INACTIVE: u32 = 0;
    const MA_NOACTIVATE: i32 = 3;

    if crate::NO_FOCUS_ACTIVE.load(std::sync::atomic::Ordering::Relaxed) {
        match msg {
            WM_ACTIVATE => {
                let activation = (wparam.0 & 0xFFFF) as u32;
                if activation != WA_INACTIVE {
                    // Block activation — WebView2 cannot steal focus
                    return windows::Win32::Foundation::LRESULT(0);
                }
            }
            WM_SETFOCUS => {
                // Block focus entirely in no-focus mode
                return windows::Win32::Foundation::LRESULT(0);
            }
            WM_MOUSEACTIVATE => {
                // Don't activate on click, but still process the click event.
                // When user clicks to search, React calls activateWindow() IPC
                // which sets NO_FOCUS_ACTIVE=false, then SetForegroundWindow works.
                return windows::Win32::Foundation::LRESULT(MA_NOACTIVATE as isize);
            }
            _ => {}
        }
    }

    // --- Layout change forwarding ---
    if msg == WM_INPUTLANGCHANGE {
        let new_hkl = lparam.0 as usize;
        let hotkey_tid = dw_ref_data as u32;
        let _ = PostThreadMessageW(
            hotkey_tid,
            WM_LAYOUT_CHANGED,
            windows::Win32::Foundation::WPARAM(new_hkl),
            windows::Win32::Foundation::LPARAM(0),
        );
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

/// Register a single hotkey with the Windows API.
#[cfg(target_os = "windows")]
fn register_hotkey_win(id: i32, modifiers: u32, code: Code) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyExW, RegisterHotKey, HOT_KEY_MODIFIERS, MAP_VIRTUAL_KEY_TYPE,
    };

    let scan =
        code_to_scancode(&code).ok_or_else(|| format!("unsupported key code: {:?}", code))?;

    // SAFETY: get_active_keyboard_layout is an `unsafe fn` that only calls
    // Win32 APIs (GetForegroundWindow, etc.) with OS-provided handles.
    let layout = unsafe { get_active_keyboard_layout() };
    // SAFETY: MAPVK_VSC_TO_VK_EX (3) is a valid mapping type; `scan` is a
    // legitimate IBM PC AT Set 1 scan code from code_to_scancode(); `layout`
    // is a valid HKL returned by GetKeyboardLayout above. The function returns
    // 0 on failure, which is checked immediately below.
    let vk = unsafe { MapVirtualKeyExW(scan as u32, MAP_VIRTUAL_KEY_TYPE(3), layout) };

    if vk == 0 {
        return Err(format!(
            "MapVirtualKeyExW returned 0 for scan code 0x{:02X} (code={:?})",
            scan, code
        ));
    }

    info!(
        id,
        scan = format!("0x{:02X}", scan),
        vk = format!("0x{:02X}", vk),
        modifiers = format!("0x{:02X}", modifiers),
        "registering hotkey"
    );

    // SAFETY: RegisterHotKey with hwnd=None registers a thread-level hotkey;
    // `id` is a caller-chosen non-zero integer; `HOT_KEY_MODIFIERS(modifiers)`
    // wraps a u32 bitmask of valid modifier flags; `vk` is a non-zero VK
    // code from MapVirtualKeyExW above.  Must be called on the hotkey thread.
    let result = unsafe { RegisterHotKey(None, id, HOT_KEY_MODIFIERS(modifiers), vk) };

    if result.is_err() {
        let err = std::io::Error::last_os_error();
        Err(format!(
            "RegisterHotKey failed for id={}, vk=0x{:02X}: {}",
            id, vk, err
        ))
    } else {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
fn register_hotkey_win(_id: i32, _modifiers: u32, _code: Code) -> Result<(), String> {
    Ok(())
}

/// Unregister a single hotkey by ID.
#[cfg(target_os = "windows")]
fn unregister_hotkey_win(id: i32) {
    use windows::Win32::UI::Input::KeyboardAndMouse::UnregisterHotKey;
    // SAFETY: UnregisterHotKey with hwnd=None targets the thread-level hotkey
    // registered by RegisterHotKey; `id` is the same integer used at
    // registration. Failure (e.g. never registered) is silently ignored.
    unsafe {
        let _ = UnregisterHotKey(None, id);
    }
}

#[cfg(not(target_os = "windows"))]
fn unregister_hotkey_win(_id: i32) {}

/// Map `keyboard_types::Code` to IBM PC AT Set 1 scan codes.
fn code_to_scancode(code: &Code) -> Option<u16> {
    static SCAN_MAP: std::sync::LazyLock<HashMap<Code, u16>> = std::sync::LazyLock::new(|| {
        let mut m = HashMap::new();
        // Letters
        m.insert(Code::KeyA, 0x1E);
        m.insert(Code::KeyB, 0x30);
        m.insert(Code::KeyC, 0x2E);
        m.insert(Code::KeyD, 0x20);
        m.insert(Code::KeyE, 0x12);
        m.insert(Code::KeyF, 0x21);
        m.insert(Code::KeyG, 0x22);
        m.insert(Code::KeyH, 0x23);
        m.insert(Code::KeyI, 0x17);
        m.insert(Code::KeyJ, 0x24);
        m.insert(Code::KeyK, 0x25);
        m.insert(Code::KeyL, 0x26);
        m.insert(Code::KeyM, 0x32);
        m.insert(Code::KeyN, 0x31);
        m.insert(Code::KeyO, 0x18);
        m.insert(Code::KeyP, 0x19);
        m.insert(Code::KeyQ, 0x10);
        m.insert(Code::KeyR, 0x13);
        m.insert(Code::KeyS, 0x1F);
        m.insert(Code::KeyT, 0x14);
        m.insert(Code::KeyU, 0x16);
        m.insert(Code::KeyV, 0x2F);
        m.insert(Code::KeyW, 0x11);
        m.insert(Code::KeyX, 0x2D);
        m.insert(Code::KeyY, 0x15);
        m.insert(Code::KeyZ, 0x2C);
        // Digits
        m.insert(Code::Digit1, 0x02);
        m.insert(Code::Digit2, 0x03);
        m.insert(Code::Digit3, 0x04);
        m.insert(Code::Digit4, 0x05);
        m.insert(Code::Digit5, 0x06);
        m.insert(Code::Digit6, 0x07);
        m.insert(Code::Digit7, 0x08);
        m.insert(Code::Digit8, 0x09);
        m.insert(Code::Digit9, 0x0A);
        m.insert(Code::Digit0, 0x0B);
        // Punctuation / special
        m.insert(Code::Backquote, 0x29);
        m.insert(Code::Minus, 0x0C);
        m.insert(Code::Equal, 0x0D);
        m.insert(Code::BracketLeft, 0x1A);
        m.insert(Code::BracketRight, 0x1B);
        m.insert(Code::Backslash, 0x2B);
        m.insert(Code::Semicolon, 0x27);
        m.insert(Code::Quote, 0x28);
        m.insert(Code::Comma, 0x33);
        m.insert(Code::Period, 0x34);
        m.insert(Code::Slash, 0x35);
        m.insert(Code::IntlBackslash, 0x56);
        m.insert(Code::Space, 0x39);
        // Function keys
        m.insert(Code::F1, 0x3B);
        m.insert(Code::F2, 0x3C);
        m.insert(Code::F3, 0x3D);
        m.insert(Code::F4, 0x3E);
        m.insert(Code::F5, 0x3F);
        m.insert(Code::F6, 0x40);
        m.insert(Code::F7, 0x41);
        m.insert(Code::F8, 0x42);
        m.insert(Code::F9, 0x43);
        m.insert(Code::F10, 0x44);
        m.insert(Code::F11, 0x57);
        m.insert(Code::F12, 0x58);
        m
    });
    SCAN_MAP.get(code).copied()
}

/// All physical key codes that can be displayed with layout-aware characters.
const DISPLAY_CODES: &[(&str, Code)] = &[
    ("KeyA", Code::KeyA),
    ("KeyB", Code::KeyB),
    ("KeyC", Code::KeyC),
    ("KeyD", Code::KeyD),
    ("KeyE", Code::KeyE),
    ("KeyF", Code::KeyF),
    ("KeyG", Code::KeyG),
    ("KeyH", Code::KeyH),
    ("KeyI", Code::KeyI),
    ("KeyJ", Code::KeyJ),
    ("KeyK", Code::KeyK),
    ("KeyL", Code::KeyL),
    ("KeyM", Code::KeyM),
    ("KeyN", Code::KeyN),
    ("KeyO", Code::KeyO),
    ("KeyP", Code::KeyP),
    ("KeyQ", Code::KeyQ),
    ("KeyR", Code::KeyR),
    ("KeyS", Code::KeyS),
    ("KeyT", Code::KeyT),
    ("KeyU", Code::KeyU),
    ("KeyV", Code::KeyV),
    ("KeyW", Code::KeyW),
    ("KeyX", Code::KeyX),
    ("KeyY", Code::KeyY),
    ("KeyZ", Code::KeyZ),
    ("Digit0", Code::Digit0),
    ("Digit1", Code::Digit1),
    ("Digit2", Code::Digit2),
    ("Digit3", Code::Digit3),
    ("Digit4", Code::Digit4),
    ("Digit5", Code::Digit5),
    ("Digit6", Code::Digit6),
    ("Digit7", Code::Digit7),
    ("Digit8", Code::Digit8),
    ("Digit9", Code::Digit9),
    ("Backquote", Code::Backquote),
    ("Minus", Code::Minus),
    ("Equal", Code::Equal),
    ("BracketLeft", Code::BracketLeft),
    ("BracketRight", Code::BracketRight),
    ("Backslash", Code::Backslash),
    ("Semicolon", Code::Semicolon),
    ("Quote", Code::Quote),
    ("Comma", Code::Comma),
    ("Period", Code::Period),
    ("Slash", Code::Slash),
    ("IntlBackslash", Code::IntlBackslash),
];

/// Per-layout label cache.  `ToUnicodeEx` is expensive and modifies internal
/// keyboard state — calling it 40+ times every 500ms during rapid layout
/// switching corrupts the state and returns stale/mixed results.  We compute
/// labels once per HKL and serve subsequent requests from the cache.
/// The cache is pre-warmed at startup for all installed layouts.
static LABEL_CACHE: std::sync::LazyLock<std::sync::Mutex<HashMap<isize, HashMap<String, String>>>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

/// Compute key labels for a specific keyboard layout handle.
#[cfg(target_os = "windows")]
fn compute_labels_for_layout(
    layout: windows::Win32::UI::Input::KeyboardAndMouse::HKL,
) -> HashMap<String, String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyExW, ToUnicodeEx, MAP_VIRTUAL_KEY_TYPE,
    };

    let mut result = HashMap::new();
    let key_state = [0u8; 256];

    for &(name, code) in DISPLAY_CODES {
        let Some(scan) = code_to_scancode(&code) else {
            continue;
        };
        // SAFETY: MAPVK_VSC_TO_VK_EX (3) is valid; `scan` is a known IBM PC AT
        // Set 1 code; `layout` is an HKL returned by GetKeyboardLayout/GetKeyboardLayoutList.
        let vk = unsafe { MapVirtualKeyExW(scan as u32, MAP_VIRTUAL_KEY_TYPE(3), layout) };
        if vk == 0 {
            continue;
        }

        let mut buf = [0u16; 4];
        // SAFETY: `vk` is a non-zero VK code from MapVirtualKeyExW; `scan` is
        // the matching scan code; `key_state` is an all-zeros 256-byte array
        // (no modifiers held); `buf` is a writable 4-element UTF-16 output buffer;
        // `layout` is a valid HKL. ToUnicodeEx modifies internal keyboard state —
        // the dead-key flush below restores it.
        let ret = unsafe { ToUnicodeEx(vk, scan as u32, &key_state, &mut buf, 0, layout) };

        if ret == -1 {
            // Dead key — extract the combining character, then flush keyboard buffer
            // (VS Code technique: press VK_DECIMAL to consume dead key state)
            if buf[0] != 0 {
                let ch = String::from_utf16_lossy(&buf[..1]);
                result.insert(name.to_string(), ch);
            }
            let mut flush = [0u16; 4];
            // SAFETY: VK_DECIMAL (0x6E) with scan 0x53 is used to consume the
            // dead-key state left by the previous ToUnicodeEx call; `key_state`
            // is all-zeros; `flush` is a valid output buffer. This is the
            // standard VS Code technique for flushing dead-key state.
            unsafe {
                ToUnicodeEx(0x6E, 0x53, &key_state, &mut flush, 0, layout);
            }
        } else if ret > 0 {
            let ch = String::from_utf16_lossy(&buf[..ret as usize]);
            if !ch.is_empty() && ch.chars().next().is_some_and(|c| !c.is_control()) {
                result.insert(name.to_string(), ch);
            }
        }
    }

    result
}

/// Pre-warm the label cache for ALL installed keyboard layouts at startup.
/// Called once during app init so that runtime layout switching is instant.
pub fn warm_label_cache() {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyboardLayoutList, HKL};

        // SAFETY: GetKeyboardLayoutList with buf=None returns the count of
        // installed layouts without writing anything — safe as a read-only query.
        let count = unsafe { GetKeyboardLayoutList(None) };
        if count <= 0 {
            return;
        }
        let mut layouts = vec![HKL::default(); count as usize];
        // SAFETY: `layouts` has exactly `count` elements (allocated above);
        // GetKeyboardLayoutList writes at most `count` HKL values into the slice.
        unsafe {
            GetKeyboardLayoutList(Some(&mut layouts));
        }

        let mut cache = LABEL_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        for layout in &layouts {
            let hkl = layout.0 as isize;
            if cache.contains_key(&hkl) {
                continue;
            }
            let labels = compute_labels_for_layout(*layout);
            info!(
                hkl = format!("0x{:08X}", hkl),
                keys = labels.len(),
                "pre-cached key labels for layout"
            );
            cache.insert(hkl, labels);
        }
    }
}

/// Returns display characters for all known key codes on the current keyboard layout.
/// Reads `CURRENT_HKL` (set by the hotkey timer thread which polls the foreground
/// window every 250ms) instead of calling `GetForegroundWindow()` directly — the
/// command thread's query returns stale data when Beetroot itself is focused.
/// Results are cached per HKL — safe to call frequently.
pub fn get_layout_key_labels() -> HashMap<String, String> {
    let hkl = CURRENT_HKL.load(Ordering::Relaxed);
    if hkl == 0 {
        // Timer hasn't fired yet — return empty, first tick is <250ms away
        return HashMap::new();
    }

    if let Ok(cache) = LABEL_CACHE.lock() {
        if let Some(labels) = cache.get(&hkl) {
            return labels.clone();
        }
    }

    // HKL not in cache (layout added after startup) — compute via ToUnicodeEx
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::HKL;
        let layout = HKL(hkl as *mut _);
        let result = compute_labels_for_layout(layout);
        if let Ok(mut cache) = LABEL_CACHE.lock() {
            cache.insert(hkl, result.clone());
        }
        result
    }

    #[cfg(not(target_os = "windows"))]
    HashMap::new()
}

/// Parse modifier string flags into Windows API modifier bitmask.
pub fn parse_modifiers_to_win(modifiers: keyboard_types::Modifiers) -> u32 {
    let mut mods = 0u32;
    if modifiers.contains(keyboard_types::Modifiers::CONTROL) {
        mods |= MOD_CONTROL;
    }
    if modifiers.contains(keyboard_types::Modifiers::ALT) {
        mods |= MOD_ALT;
    }
    if modifiers.contains(keyboard_types::Modifiers::SHIFT) {
        mods |= MOD_SHIFT;
    }
    if modifiers.contains(keyboard_types::Modifiers::META) {
        mods |= MOD_WIN;
    }
    mods
}

// ---------------------------------------------------------------------------
// Dispatch modifier-less nav key from keyboard hook (WM_NAV_KEY)
// ---------------------------------------------------------------------------

/// Queue intercepted navigation on the main thread with its no-focus generation.
fn dispatch_nav_vk(app_handle: &AppHandle, vk: u32, generation: u64) {
    dispatch_nav_attempt(app_handle, vk, generation, true);
}

pub(crate) fn retry_no_focus_navigation(app: AppHandle, vk: u32, generation: u64) {
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(150));
        dispatch_nav_attempt(&app, vk, generation, false);
    });
}

fn dispatch_nav_attempt(app_handle: &AppHandle, vk: u32, generation: u64, allow_retry: bool) {
    let app = app_handle.clone();
    let _ = app_handle.run_on_main_thread(move || {
        crate::keyboard_hook::dispatch_navigation_if_current(
            generation,
            crate::NOFOCUS_GENERATION.load(std::sync::atomic::Ordering::SeqCst),
            crate::NO_FOCUS_ACTIVE.load(std::sync::atomic::Ordering::SeqCst),
            || dispatch_current_nav_vk(&app, vk, generation, allow_retry),
        );
    });
}

fn dispatch_current_nav_vk(app_handle: &AppHandle, vk: u32, generation: u64, allow_retry: bool) {
    const VK_UP: u32 = 0x26;
    const VK_DOWN: u32 = 0x28;
    const VK_HOME: u32 = 0x24;
    const VK_END: u32 = 0x23;
    const VK_PRIOR: u32 = 0x21;
    const VK_NEXT: u32 = 0x22;
    const VK_SPACE: u32 = 0x20;
    const VK_RETURN: u32 = 0x0D;
    const VK_ESCAPE: u32 = 0x1B;

    let Some(win) = app_handle.get_webview_window("main") else {
        return;
    };

    match vk {
        VK_ESCAPE => {
            window::hide_and_clear_state(&win);
        }
        _ => {
            // eval() bypasses Tauri's event system which fails to deliver events
            // to WebView without focus. Direct JS execution via eval() is reliable
            // regardless of window focus state.
            let (handler, action) = match vk {
                VK_DOWN => ("__beetrootNav", "down"),
                VK_UP => ("__beetrootNav", "up"),
                VK_HOME => ("__beetrootNav", "home"),
                VK_END => ("__beetrootNav", "end"),
                VK_PRIOR => ("__beetrootNav", "pageup"),
                VK_NEXT => ("__beetrootNav", "pagedown"),
                VK_SPACE => ("__beetrootAction", "space"),
                VK_RETURN => ("__beetrootAction", "enter"),
                _ => return,
            };
            let guarded_js = format!(
                "{}\ndispatchNoFocusNavigation('{handler}', '{action}', {vk}, {generation}, {allow_retry});",
                include_str!("navigation-dispatch.js")
            );
            if let Err(e) = win.eval(&guarded_js) {
                warn!("eval failed: {e}");
            }
        }
    }
}

/// Hide the no-focus window when a click lands outside it. Runs on the hotkey
/// thread — moved out of the mouse hook callback to keep the hook fast.
#[cfg(target_os = "windows")]
fn handle_click_outside(app: &tauri::AppHandle, x: i32, y: i32) {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;
    if !crate::NO_FOCUS_ACTIVE.load(std::sync::atomic::Ordering::SeqCst) {
        return; // state changed between post and handle
    }
    if let Some(win) = app.get_webview_window("main") {
        let inside = crate::window::get_hwnd(&win)
            .map(|hwnd| {
                let mut rect = RECT::default();
                // SAFETY: hwnd is a live window handle obtained from Tauri; rect is a valid out-param.
                let ok = unsafe { GetWindowRect(hwnd, &mut rect).is_ok() };
                ok && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
            })
            .unwrap_or(false);
        if !inside {
            crate::window::hide_and_clear_state(&win);
        }
    }
}

// ---------------------------------------------------------------------------
// Navigation hotkeys for no-focus mode (modifier combos via RegisterHotKey)
// ---------------------------------------------------------------------------

mod nav_id {
    // IDs 100-108 removed: modifier-less keys (arrows, Space, Enter, Escape)
    // are handled by WH_KEYBOARD_LL in keyboard_hook.rs, not RegisterHotKey.
    pub const ALT_DELETE: i32 = 110;
    pub const ALT_S: i32 = 111;
    pub const ALT_P: i32 = 112;
    pub const ALT_F: i32 = 113;
    pub const ALT_T: i32 = 114;
    pub const CTRL_C: i32 = 115;
    pub const CTRL_1: i32 = 120; // 120-128 for Ctrl+1 through Ctrl+9
}

const MOD_NOREPEAT: u32 = 0x4000;

/// Register a raw VK hotkey. Returns true on success.
#[cfg(target_os = "windows")]
fn register_raw_vk(id: i32, modifiers: u32, vk: u32, label: &str) -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, HOT_KEY_MODIFIERS};
    // SAFETY: RegisterHotKey with hwnd=None registers a thread-level hotkey;
    // `id`, `modifiers`, and `vk` are plain integers validated by the caller.
    let ok = unsafe { RegisterHotKey(None, id, HOT_KEY_MODIFIERS(modifiers), vk) };
    if ok.is_err() {
        warn!("RegisterHotKey FAILED: {label} (id={id}, mod=0x{modifiers:04x}, vk=0x{vk:02x})");
        false
    } else {
        info!("RegisterHotKey OK: {label} (id={id})");
        true
    }
}

/// Register all navigation hotkeys on the current (hotkey) thread.
#[cfg(target_os = "windows")]
fn register_nav_hotkeys() {
    // Modifier-less keys (arrows, Space, Enter, Escape) are handled by
    // WH_KEYBOARD_LL in keyboard_hook.rs — RegisterHotKey doesn't work
    // without modifiers on Win11.

    // Alt+key
    register_raw_vk(nav_id::ALT_DELETE, MOD_ALT | MOD_NOREPEAT, 0x2E, "Alt+Del");
    register_raw_vk(nav_id::ALT_S, MOD_ALT | MOD_NOREPEAT, 0x53, "Alt+S");
    register_raw_vk(nav_id::ALT_P, MOD_ALT | MOD_NOREPEAT, 0x50, "Alt+P");
    register_raw_vk(nav_id::ALT_F, MOD_ALT | MOD_NOREPEAT, 0x46, "Alt+F");
    register_raw_vk(nav_id::ALT_T, MOD_ALT | MOD_NOREPEAT, 0x54, "Alt+T");
    // Ctrl+C
    register_raw_vk(nav_id::CTRL_C, MOD_CONTROL | MOD_NOREPEAT, 0x43, "Ctrl+C");
    // Ctrl+1..9
    for i in 0..9i32 {
        register_raw_vk(
            nav_id::CTRL_1 + i,
            MOD_CONTROL | MOD_NOREPEAT,
            0x31 + i as u32,
            &format!("Ctrl+{}", i + 1),
        );
    }
    info!("nav hotkeys registered");
}

/// Unregister all navigation hotkeys.
#[cfg(target_os = "windows")]
fn unregister_nav_hotkeys() {
    for id in [
        nav_id::ALT_DELETE,
        nav_id::ALT_S,
        nav_id::ALT_P,
        nav_id::ALT_F,
        nav_id::ALT_T,
        nav_id::CTRL_C,
    ] {
        unregister_hotkey_win(id);
    }
    for i in 0..9i32 {
        unregister_hotkey_win(nav_id::CTRL_1 + i);
    }
    info!("nav hotkeys unregistered");
}

#[cfg(not(target_os = "windows"))]
fn register_nav_hotkeys() {}
#[cfg(not(target_os = "windows"))]
fn unregister_nav_hotkeys() {}

/// Dispatch a navigation hotkey to the frontend via eval().
/// Uses win.eval() instead of app_handle.emit() because Tauri's event system
/// doesn't reliably deliver events to the WebView when the window has no focus.
fn dispatch_nav_hotkey(app_handle: &AppHandle, id: i32) {
    let Some(win) = app_handle.get_webview_window("main") else {
        return;
    };

    match id {
        nav_id::ALT_DELETE => eval_action(&win, "delete"),
        nav_id::ALT_S => eval_action(&win, "star"),
        nav_id::ALT_P => eval_action(&win, "pin"),
        nav_id::ALT_F => eval_action(&win, "follow"),
        nav_id::ALT_T => eval_action(&win, "transform"),
        nav_id::CTRL_C => eval_action(&win, "copy"),
        k if (nav_id::CTRL_1..=nav_id::CTRL_1 + 8).contains(&k) => {
            let digit = k - nav_id::CTRL_1;
            eval_action(&win, &format!("quick-select-{digit}"));
        }
        _ => {}
    }
}

/// Call window.__beetrootAction(action) via eval.
/// Wraps in try/catch with retry — on first show after startup,
/// React useEffect may not have defined __beetrootAction yet.
fn eval_action(win: &tauri::WebviewWindow, action: &str) {
    let call = format!("window.__beetrootAction('{action}')");
    if let Err(e) = win.eval(format!(
        "try {{ {call} }} catch(_) {{ setTimeout(() => {{ try {{ {call} }} catch(_) {{}} }}, 150) }}"
    )) {
        warn!("eval_action failed: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scancode_letters() {
        assert_eq!(code_to_scancode(&Code::KeyA), Some(0x1E));
        assert_eq!(code_to_scancode(&Code::KeyZ), Some(0x2C));
        assert_eq!(code_to_scancode(&Code::KeyQ), Some(0x10));
    }

    #[test]
    fn scancode_digits() {
        assert_eq!(code_to_scancode(&Code::Digit0), Some(0x0B));
        assert_eq!(code_to_scancode(&Code::Digit1), Some(0x02));
        assert_eq!(code_to_scancode(&Code::Digit9), Some(0x0A));
    }

    #[test]
    fn scancode_punctuation() {
        assert_eq!(code_to_scancode(&Code::Backquote), Some(0x29));
        assert_eq!(code_to_scancode(&Code::IntlBackslash), Some(0x56));
        assert_eq!(code_to_scancode(&Code::Semicolon), Some(0x27));
        assert_eq!(code_to_scancode(&Code::Slash), Some(0x35));
    }

    #[test]
    fn scancode_function_keys() {
        assert_eq!(code_to_scancode(&Code::F1), Some(0x3B));
        assert_eq!(code_to_scancode(&Code::F12), Some(0x58));
    }

    #[test]
    fn scancode_unknown_returns_none() {
        assert_eq!(code_to_scancode(&Code::Escape), None);
    }

    #[test]
    fn modifier_parsing() {
        let ctrl = keyboard_types::Modifiers::CONTROL;
        assert_eq!(parse_modifiers_to_win(ctrl), MOD_CONTROL);

        let ctrl_alt = keyboard_types::Modifiers::CONTROL | keyboard_types::Modifiers::ALT;
        assert_eq!(parse_modifiers_to_win(ctrl_alt), MOD_CONTROL | MOD_ALT);

        let all = keyboard_types::Modifiers::CONTROL
            | keyboard_types::Modifiers::ALT
            | keyboard_types::Modifiers::SHIFT
            | keyboard_types::Modifiers::META;
        assert_eq!(
            parse_modifiers_to_win(all),
            MOD_CONTROL | MOD_ALT | MOD_SHIFT | MOD_WIN
        );
    }
}
