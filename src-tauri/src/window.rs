//! Window show/hide with multi-monitor positioning and no-focus mode.
//! All show paths MUST go through show_on_active_monitor() — never raw show().

use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{Emitter, Manager, PhysicalPosition, WebviewWindow};

use crate::{CurrentWindowMode, CurrentWindowPosition, WindowMode, WindowPosition};

/// A classic Edit can disappear on focus loss while its application survives.
#[derive(Clone, Copy, Default)]
pub(crate) struct PasteTarget {
    pub window: isize,
    pub edit: isize,
}

impl PasteTarget {
    pub fn is_alive(self, alive: impl Fn(isize) -> bool) -> bool {
        self.window != 0 && alive(self.window) && (self.edit == 0 || alive(self.edit))
    }

    pub fn matches_focus(self, focus: isize) -> bool {
        self.edit == 0 || self.edit == focus
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn focused_control(window: isize) -> isize {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO,
    };
    if window == 0 {
        return 0;
    }
    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: read-only queries; info is a correctly sized stack buffer. Invalid
    // handles/threads return failure. No foreign memory or input is modified.
    unsafe {
        let thread = GetWindowThreadProcessId(HWND(window as *mut _), None);
        if thread != 0 && GetGUIThreadInfo(thread, &mut info).is_ok() {
            return info.hwndFocus.0 as isize;
        }
    }
    0
}

#[cfg(target_os = "windows")]
pub(crate) fn capture_paste_target() -> PasteTarget {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow};
    // SAFETY: GetForegroundWindow is a read-only query without arguments.
    let window = unsafe { GetForegroundWindow() }.0 as isize;
    let focus = focused_control(window);
    let mut class = [0u16; 32];
    // SAFETY: class is a bounded writable buffer; stale HWNDs yield zero.
    let len = unsafe { GetClassNameW(HWND(focus as *mut _), &mut class) };
    let edit = if len > 0 && String::from_utf16_lossy(&class[..len as usize]) == "Edit" {
        focus
    } else {
        0
    };
    PasteTarget { window, edit }
}

#[cfg(test)]
mod paste_target_tests {
    use super::PasteTarget;

    #[test]
    fn uncaptured_target_is_copy_only() {
        assert!(!PasteTarget::default().is_alive(|_| true));
    }

    #[test]
    fn surviving_application_does_not_make_a_destroyed_edit_safe() {
        let target = PasteTarget { window: 1, edit: 2 };
        assert!(!target.is_alive(|hwnd| hwnd == 1));
        assert!(target.is_alive(|_| true));
        assert!(!target.is_alive(|hwnd| hwnd == 2));
    }

    #[test]
    fn surviving_edit_must_still_receive_keyboard_focus() {
        let target = PasteTarget { window: 1, edit: 2 };
        assert!(target.matches_focus(2));
        assert!(!target.matches_focus(3));
        assert!(!target.matches_focus(0));
    }

    #[test]
    fn non_edit_targets_keep_existing_behavior() {
        let target = PasteTarget { window: 1, edit: 0 };
        assert!(target.is_alive(|hwnd| hwnd == 1));
        assert!(!target.is_alive(|_| false));
        assert!(target.matches_focus(3));
        assert!(!PasteTarget::default().is_alive(|_| panic!("no captured HWND")));
    }
}

pub(crate) fn close_to_tray(prevent_close: impl FnOnce(), hide_and_clear: impl FnOnce()) {
    prevent_close();
    hide_and_clear();
}

#[cfg(test)]
mod close_to_tray_tests {
    #[test]
    fn close_request_prevents_destruction_and_hides_once() {
        let events = std::cell::RefCell::new(Vec::new());
        super::close_to_tray(
            || events.borrow_mut().push("prevent"),
            || events.borrow_mut().push("hide-and-clear"),
        );
        assert_eq!(*events.borrow(), ["prevent", "hide-and-clear"]);
    }
}

// ---------------------------------------------------------------------------
// WS_EX_NOACTIVATE helpers (Windows-only)
// ---------------------------------------------------------------------------

/// Extract HWND from a WebviewWindow using raw-window-handle.
/// Returns our windows 0.58 HWND type (avoids version mismatch with Tauri's internal windows crate).
#[cfg(target_os = "windows")]
pub(crate) fn get_hwnd(win: &WebviewWindow) -> Option<windows::Win32::Foundation::HWND> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    let handle = win.window_handle().ok()?;
    if let RawWindowHandle::Win32(h) = handle.as_raw() {
        Some(windows::Win32::Foundation::HWND(h.hwnd.get() as *mut _))
    } else {
        None
    }
}

/// Apply or remove WS_EX_NOACTIVATE extended style to prevent focus theft.
#[cfg(target_os = "windows")]
fn set_no_activate_style(win: &WebviewWindow, enable: bool) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE,
    };

    let Some(hwnd) = get_hwnd(win) else { return };

    const WS_EX_NOACTIVATE: isize = 0x08000000;
    // SAFETY: `hwnd` was obtained from Tauri's own window handle and is a live
    // window on the UI thread; GetWindowLongPtrW and SetWindowLongPtrW are safe
    // to call with a valid HWND and the GWL_EXSTYLE index.
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let new_style = if enable {
            ex_style | WS_EX_NOACTIVATE
        } else {
            ex_style & !WS_EX_NOACTIVATE
        };
        if new_style != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
        }
    }
}

/// Show window without stealing focus from the current foreground app.
///
/// Uses LockSetForegroundWindow(LSFW_LOCK) to prevent ANY process
/// (including WebView2/Chromium child processes) from changing the
/// foreground window. The lock stays until activate_window() is called.
///
/// This is the nuclear option — works regardless of WebView2's internal
/// focus management because the OS itself rejects all SetForegroundWindow
/// calls while locked.
#[cfg(target_os = "windows")]
fn show_window_no_activate(win: &WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        LockSetForegroundWindow, SetWindowPos, ShowWindow, HWND_TOPMOST, LSFW_LOCK, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SW_SHOWNOACTIVATE,
    };

    if let Some(hwnd) = get_hwnd(win) {
        // SAFETY: `hwnd` is a live window handle from Tauri's own window.
        // LockSetForegroundWindow, ShowWindow, SetWindowPos all accept any valid
        // HWND and integer flag arguments; no pointer lifetimes are involved.
        // The foreground lock is released later by activate_no_focus_window /
        // hide_and_clear_state or the 30 s safety timer.
        unsafe {
            // Lock foreground — no process can steal focus
            let _ = LockSetForegroundWindow(LSFW_LOCK);
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
            );
            // Lock stays until activate/hide. Safety: auto-unlock after 30s.
            // Generation counter prevents stale timeout threads from unlocking.
        }
        // Reinstall keyboard hooks — recovers from silent removal by Windows.
        // Win11 removes LL hooks if callbacks take too long; reinstalling on
        // every show ensures the hook is always fresh.
        crate::keyboard_hook::reinstall();
        // Register nav hotkeys on the proven hotkey thread
        if let Some(mgr) = win.app_handle().try_state::<crate::hotkey::HotkeyManager>() {
            mgr.register_nav();
        }
        let gen = crate::NOFOCUS_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
        std::thread::Builder::new()
            .name("nofocus-timeout".into())
            .spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(30));
                if crate::NOFOCUS_GENERATION.load(Ordering::SeqCst) == gen
                    && crate::NO_FOCUS_ACTIVE.load(Ordering::SeqCst)
                {
                    use windows::Win32::UI::WindowsAndMessaging::{
                        LockSetForegroundWindow, LSFW_UNLOCK,
                    };
                    // SAFETY: LockSetForegroundWindow takes a plain integer flag;
                    // LSFW_UNLOCK is always safe to call (it's idempotent if not locked).
                    unsafe {
                        let _ = LockSetForegroundWindow(LSFW_UNLOCK);
                    }
                    tracing::debug!("foreground lock auto-released after 30s timeout");
                }
            })
            .ok();
    } else {
        let _ = win.show();
    }
}

#[cfg(target_os = "windows")]
fn activation_z_order(mode: Option<WindowMode>) -> windows::Win32::Foundation::HWND {
    use windows::Win32::UI::WindowsAndMessaging::{HWND_NOTOPMOST, HWND_TOPMOST};
    if mode == Some(WindowMode::Pinned) {
        HWND_TOPMOST
    } else {
        HWND_NOTOPMOST
    }
}

#[cfg(all(test, target_os = "windows"))]
mod activation_z_order_tests {
    use super::*;
    use windows::Win32::UI::WindowsAndMessaging::{HWND_NOTOPMOST, HWND_TOPMOST};

    #[test]
    fn search_activation_preserves_pinned_topmost() {
        assert_eq!(activation_z_order(Some(WindowMode::Pinned)), HWND_TOPMOST);
    }

    #[test]
    fn search_activation_removes_only_temporary_topmost() {
        for mode in [
            Some(WindowMode::Normal),
            Some(WindowMode::FollowCursor),
            None,
        ] {
            assert_eq!(activation_z_order(mode), HWND_NOTOPMOST);
        }
    }
}

/// Remove WS_EX_NOACTIVATE, unlock foreground, and bring window to foreground.
/// Called when user clicks on the window to interact (e.g., search).
#[cfg(target_os = "windows")]
pub fn activate_no_focus_window(win: &WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        LockSetForegroundWindow, SetForegroundWindow, LSFW_UNLOCK,
    };

    // Must set NO_FOCUS_ACTIVE=false BEFORE unlocking, so the subclass
    // stops blocking WM_ACTIVATE/WM_SETFOCUS
    crate::NO_FOCUS_ACTIVE.store(false, Ordering::SeqCst);
    if let Some(mgr) = win.app_handle().try_state::<crate::hotkey::HotkeyManager>() {
        mgr.unregister_nav();
    }
    set_no_activate_style(win, false);

    // SAFETY: LockSetForegroundWindow takes a plain integer flag; safe to call
    // from any thread; idempotent if no lock is held.
    unsafe {
        // Unlock foreground so SetForegroundWindow can work
        let _ = LockSetForegroundWindow(LSFW_UNLOCK);
    }

    // No-focus shows use raw Win32. Sync Tao's cached visibility before later
    // style changes (notably pinning) can reapply its stale hidden flag.
    // Changing settings while hidden must not open the popup.
    if win.is_visible().unwrap_or(false) {
        let _ = win.show();
    }

    if let Some(hwnd) = get_hwnd(win) {
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOMOVE, SWP_NOSIZE};
        let mode = win
            .app_handle()
            .try_state::<CurrentWindowMode>()
            .map(|state| *state.0.lock());
        // SAFETY: `hwnd` is a live window handle from Tauri's own window;
        // SetForegroundWindow and SetWindowPos accept valid HWNDs and integer
        // flags; no pointer lifetimes are involved.
        unsafe {
            let _ = SetForegroundWindow(hwnd);
            // Clear temporary no-focus TOPMOST, but preserve explicit pinning.
            let _ = SetWindowPos(
                hwnd,
                activation_z_order(mode),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE,
            );
        }
    }
    let _ = win.set_focus();
    let _ = win.app_handle().emit("no-focus-changed", false);
}

/// Clear WS_EX_NOACTIVATE style (called from hotkey.rs for pinned mode).
pub fn clear_no_activate(win: &WebviewWindow) {
    crate::NO_FOCUS_ACTIVE.store(false, Ordering::SeqCst);
    if let Some(mgr) = win.app_handle().try_state::<crate::hotkey::HotkeyManager>() {
        mgr.unregister_nav();
    }
    #[cfg(target_os = "windows")]
    {
        set_no_activate_style(win, false);
        // SAFETY: releasing our no-focus lock takes no pointers and is idempotent.
        unsafe {
            use windows::Win32::UI::WindowsAndMessaging::{LockSetForegroundWindow, LSFW_UNLOCK};
            let _ = LockSetForegroundWindow(LSFW_UNLOCK);
        }
    }
    let _ = win.app_handle().emit("no-focus-changed", false);
}

/// Hide the window and reset no-focus state.
/// Uses both raw ShowWindow(SW_HIDE) and Tauri's win.hide() to keep
/// both OS state and Tauri's internal state in sync.
pub fn hide_and_clear_state(win: &WebviewWindow) {
    if let Some(target) = win
        .app_handle()
        .try_state::<crate::PreviousForegroundWindow>()
    {
        target.clear();
    }
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            LockSetForegroundWindow, ShowWindow, LSFW_UNLOCK, SW_HIDE,
        };
        // Raw hide ensures window is actually hidden even if Tauri state is stale
        if let Some(hwnd) = get_hwnd(win) {
            // SAFETY: `hwnd` is a live window handle from Tauri's own window;
            // ShowWindow accepts any valid HWND and SW_HIDE is a plain integer.
            unsafe {
                let _ = ShowWindow(hwnd, SW_HIDE);
            }
        }
        set_no_activate_style(win, false);
        // Unlock foreground lock set during show
        // SAFETY: LockSetForegroundWindow takes a plain integer flag; safe to
        // call from any thread; idempotent if no lock is held.
        unsafe {
            let _ = LockSetForegroundWindow(LSFW_UNLOCK);
        }
    }
    // Tauri hide to sync internal state (harmless no-op if already hidden)
    let _ = win.hide();
    crate::WINDOW_VISIBLE.store(false, Ordering::SeqCst);
    crate::NO_FOCUS_ACTIVE.store(false, Ordering::SeqCst);
    if let Some(mgr) = win.app_handle().try_state::<crate::hotkey::HotkeyManager>() {
        mgr.unregister_nav();
    }
    let _ = win.app_handle().emit("no-focus-changed", false);
}

// ---------------------------------------------------------------------------
// Show functions
// ---------------------------------------------------------------------------

/// Check if the current foreground window belongs to a console/terminal app.
/// When true, no-focus mode is skipped (auto-activate) because WH_KEYBOARD_LL
/// cannot reliably suppress keys in terminals — arrows navigate history,
/// Space types, Enter executes commands.
#[cfg(target_os = "windows")]
fn is_console_foreground() -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    const TERMINALS: &[&str] = &[
        "wt.exe",
        "windowsterminal.exe",
        "cmd.exe",
        "powershell.exe",
        "pwsh.exe",
        "conemu.exe",
        "conemu64.exe",
        "mintty.exe",
        "alacritty.exe",
        "kitty.exe",
        "hyper.exe",
        "wezterm-gui.exe",
        "tabby.exe",
    ];

    // SAFETY: GetForegroundWindow returns an OS-provided HWND (or null, checked).
    // GetWindowThreadProcessId writes into a caller-supplied u32 on the stack.
    // OpenProcess returns a kernel handle (or Err); QueryFullProcessImageNameW
    // writes at most `len` wide chars into `buf`; CloseHandle releases the
    // handle exactly once after the query.
    unsafe {
        let fg = GetForegroundWindow();
        if fg.is_invalid() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(fg, Some(&mut pid));
        if pid == 0 {
            return false;
        }
        let Ok(proc) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return false;
        };
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            proc,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(proc);
        if ok.is_err() || len == 0 {
            return false;
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        let exe = path.rsplit('\\').next().unwrap_or("").to_ascii_lowercase();
        TERMINALS.iter().any(|t| exe == *t)
    }
}

#[cfg(not(target_os = "windows"))]
fn is_console_foreground() -> bool {
    false
}

/// Show the window on the active monitor, respecting the configured position setting.
/// In Normal/Follow-Cursor modes (is_pinned=false): shows WITHOUT stealing focus.
/// In Pinned mode (is_pinned=true): shows WITH focus (user wants persistent interaction).
pub fn show_on_active_monitor(win: &WebviewWindow, is_pinned: bool) {
    let no_focus = !is_pinned && !is_console_foreground();

    // Set NO_FOCUS_ACTIVE BEFORE positioning/show so the keyboard hook
    // starts intercepting immediately — prevents race where arrows
    // don't work in the first milliseconds after opening.
    if no_focus {
        crate::NO_FOCUS_ACTIVE.store(true, Ordering::SeqCst);
        #[cfg(target_os = "windows")]
        set_no_activate_style(win, true);
    } else {
        // Clear stale WS_EX_NOACTIVATE from a previous no-focus show
        clear_no_activate(win);
        ensure_on_top(win, is_pinned);
    }

    if let Err(e) = try_position_on_cursor_monitor(win, no_focus) {
        tracing::warn!("Failed to position on cursor monitor: {e}");
        show_or_focus(win, no_focus);
    }

    set_visible_state(win, no_focus);
}

/// Show the window near the mouse cursor (like a context menu).
/// Falls back to `show_on_active_monitor` on error.
pub fn show_near_cursor(win: &WebviewWindow, is_pinned: bool) {
    let no_focus = !is_pinned && !is_console_foreground();

    if no_focus {
        crate::NO_FOCUS_ACTIVE.store(true, Ordering::SeqCst);
        #[cfg(target_os = "windows")]
        set_no_activate_style(win, true);
    } else {
        clear_no_activate(win);
        ensure_on_top(win, is_pinned);
    }

    if let Err(e) = try_show_near_cursor(win, no_focus) {
        tracing::warn!("Failed to position near cursor: {e}");
        show_on_active_monitor(win, is_pinned);
        return; // show_on_active_monitor already sets state
    }

    set_visible_state(win, no_focus);
}

/// Set WINDOW_VISIBLE and emit no-focus event.
/// NO_FOCUS_ACTIVE is set earlier (before positioning) to avoid race.
fn set_visible_state(win: &WebviewWindow, no_focus: bool) {
    crate::WINDOW_VISIBLE.store(true, Ordering::SeqCst);
    if no_focus {
        let _ = win.app_handle().emit("no-focus-changed", true);
    }
}

/// Show and optionally focus, depending on no_focus flag.
fn show_or_focus(win: &WebviewWindow, no_focus: bool) {
    if no_focus {
        #[cfg(target_os = "windows")]
        show_window_no_activate(win);
        #[cfg(not(target_os = "windows"))]
        {
            let _ = win.show();
            let _ = win.set_focus();
        }
    } else {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Temporarily set always-on-top so the window appears above other always-on-top windows.
/// After 200ms, removes always-on-top unless the user has pinned the window.
fn ensure_on_top(win: &WebviewWindow, is_pinned: bool) {
    if is_pinned {
        return; // already always-on-top
    }
    let _ = win.set_always_on_top(true);
    let app = win.app_handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        // Check if user toggled pinned mode during the 200ms window
        let still_unpinned = app
            .try_state::<CurrentWindowMode>()
            .map(|s| *s.0.lock() != WindowMode::Pinned)
            .unwrap_or(true);
        if still_unpinned {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_always_on_top(false);
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Positioning helpers
// ---------------------------------------------------------------------------

const CURSOR_OFFSET_Y: f64 = 12.0;

/// Work area rectangle (physical pixels) — monitor bounds minus taskbar.
struct WorkArea {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

/// Get the work area (excludes taskbar) for the monitor containing the given point.
#[cfg(target_os = "windows")]
fn get_work_area(px: i32, py: i32) -> Option<WorkArea> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let pt = POINT { x: px, y: py };
    // SAFETY: MonitorFromPoint accepts any POINT; MONITOR_DEFAULTTONEAREST means
    // it always returns a valid handle (or null for a system with no monitors,
    // checked via is_invalid()).
    let hmon = unsafe { MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST) };
    if hmon.is_invalid() {
        return None;
    }
    let mut mi = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: `hmon` is a valid handle returned above; `mi` is properly
    // initialised with cbSize as required by GetMonitorInfoW.
    let ok = unsafe { GetMonitorInfoW(hmon, &mut mi) };
    if !ok.as_bool() {
        return None;
    }
    let rc = mi.rcWork;
    Some(WorkArea {
        x: rc.left as f64,
        y: rc.top as f64,
        w: (rc.right - rc.left) as f64,
        h: (rc.bottom - rc.top) as f64,
    })
}

#[cfg(not(target_os = "windows"))]
fn get_work_area(_px: i32, _py: i32) -> Option<WorkArea> {
    None
}

fn try_show_near_cursor(
    win: &WebviewWindow,
    no_focus: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let cursor = win.cursor_position()?;
    let win_size = win.outer_size()?;
    let win_w = win_size.width as f64;
    let win_h = win_size.height as f64;

    // Use work area (excludes taskbar) for clamping
    let wa = get_work_area(cursor.x as i32, cursor.y as i32);
    let (mon_x, mon_y, mon_w, mon_h) = if let Some(ref wa) = wa {
        (wa.x, wa.y, wa.w, wa.h)
    } else {
        // Fallback: find monitor via Tauri API (full bounds)
        let monitors = win.available_monitors()?;
        let target = monitors.iter().find(|m| {
            let pos = m.position();
            let size = m.size();
            let (x, y, w, h) = (
                pos.x as f64,
                pos.y as f64,
                size.width as f64,
                size.height as f64,
            );
            cursor.x >= x && cursor.x < x + w && cursor.y >= y && cursor.y < y + h
        });
        if let Some(m) = target {
            let p = m.position();
            let s = m.size();
            (p.x as f64, p.y as f64, s.width as f64, s.height as f64)
        } else {
            return Err("cursor not on any known monitor".into());
        }
    };

    // X: align with cursor, clamp to work area
    let x = cursor.x.max(mon_x).min(mon_x + mon_w - win_w);

    // Y: prefer below cursor; if overflow, flip above
    let y_below = cursor.y + CURSOR_OFFSET_Y;
    let y = if y_below + win_h <= mon_y + mon_h {
        y_below
    } else {
        (cursor.y - win_h - CURSOR_OFFSET_Y).max(mon_y)
    };

    tracing::debug!("Follow-cursor: placing window at physical ({x}, {y})");
    win.set_position(PhysicalPosition::new(x as i32, y as i32))?;

    if no_focus {
        #[cfg(target_os = "windows")]
        show_window_no_activate(win);
        #[cfg(not(target_os = "windows"))]
        {
            win.show()?;
            win.set_focus()?;
        }
    } else {
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

/// Margin in logical pixels for corner positions (20px × scale_factor for DPI).
const CORNER_MARGIN_LP: f64 = 20.0;

fn try_position_on_cursor_monitor(
    win: &WebviewWindow,
    no_focus: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let cursor = win.cursor_position()?;

    tracing::debug!("Cursor at ({}, {})", cursor.x, cursor.y);

    let win_size = win.outer_size()?;
    let win_w = win_size.width as f64;
    let win_h = win_size.height as f64;

    // Use work area (excludes taskbar) instead of full monitor bounds
    let wa = get_work_area(cursor.x as i32, cursor.y as i32);
    let (mon_x, mon_y, mon_w, mon_h, scale) = if let Some(ref wa) = wa {
        let monitors = win.available_monitors()?;
        let scale = monitors
            .iter()
            .find(|m| {
                let pos = m.position();
                let size = m.size();
                let (x, y, w, h) = (
                    pos.x as f64,
                    pos.y as f64,
                    size.width as f64,
                    size.height as f64,
                );
                cursor.x >= x && cursor.x < x + w && cursor.y >= y && cursor.y < y + h
            })
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);
        tracing::debug!(
            "  Work area: pos=({},{}) size=({}x{}) scale={scale}",
            wa.x,
            wa.y,
            wa.w,
            wa.h
        );
        (wa.x, wa.y, wa.w, wa.h, scale)
    } else {
        // Fallback: full monitor bounds via Tauri API
        let monitors = win.available_monitors()?;
        let target = monitors.iter().find(|m| {
            let pos = m.position();
            let size = m.size();
            let (x, y, w, h) = (
                pos.x as f64,
                pos.y as f64,
                size.width as f64,
                size.height as f64,
            );
            cursor.x >= x && cursor.x < x + w && cursor.y >= y && cursor.y < y + h
        });
        if let Some(m) = target {
            let p = m.position();
            let s = m.size();
            (
                p.x as f64,
                p.y as f64,
                s.width as f64,
                s.height as f64,
                m.scale_factor(),
            )
        } else {
            tracing::warn!("Cursor not on any known monitor, showing on current");
            show_or_focus(win, no_focus);
            return Ok(());
        }
    };

    let margin = CORNER_MARGIN_LP * scale;

    // Read window position setting from managed state
    let position = win
        .app_handle()
        .try_state::<CurrentWindowPosition>()
        .map(|s| s.0.lock().clone())
        .unwrap_or(WindowPosition::Center);

    let (x, y) = match position {
        WindowPosition::Center => {
            let x = (mon_x + (mon_w - win_w) / 2.0)
                .max(mon_x)
                .min(mon_x + mon_w - win_w);
            let y = (mon_y + (mon_h - win_h) / 2.0)
                .max(mon_y)
                .min(mon_y + mon_h - win_h);
            (x, y)
        }
        WindowPosition::TopLeft => (mon_x + margin, mon_y + margin),
        WindowPosition::TopRight => (mon_x + mon_w - win_w - margin, mon_y + margin),
        WindowPosition::BottomLeft => (mon_x + margin, mon_y + mon_h - win_h - margin),
        WindowPosition::BottomRight => (
            mon_x + mon_w - win_w - margin,
            mon_y + mon_h - win_h - margin,
        ),
    };

    tracing::debug!("Positioning window at physical ({x}, {y}), position={position:?}");
    win.set_position(PhysicalPosition::new(x as i32, y as i32))?;

    if no_focus {
        #[cfg(target_os = "windows")]
        show_window_no_activate(win);
        #[cfg(not(target_os = "windows"))]
        {
            win.show()?;
            win.set_focus()?;
        }
    } else {
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Copy overlay — system-wide "Copied" notification pill
// ---------------------------------------------------------------------------

/// Overlay window dimensions (logical pixels).
const OVERLAY_WIDTH: f64 = 180.0;
const OVERLAY_HEIGHT: f64 = 36.0;
/// Cursor offsets for overlay positioning (physical pixels).
const OVERLAY_OFFSET_X: f64 = 16.0;
const OVERLAY_OFFSET_Y: f64 = 20.0;
/// Fade-out animation durations by show duration (ms).
fn overlay_fade_ms(show_ms: u64) -> u64 {
    if show_ms <= 350 {
        200
    } else {
        300
    }
}

fn queue_overlay_action(
    generation: u64,
    current: impl FnOnce() -> u64 + Send + 'static,
    queue: impl FnOnce(Box<dyn FnOnce() + Send>),
    action: impl FnOnce() + Send + 'static,
) {
    queue(Box::new(move || {
        if current() == generation {
            action();
        }
    }));
}

fn run_for_current_overlay(
    app: &tauri::AppHandle,
    generation: u64,
    action: impl FnOnce(&tauri::AppHandle) + Send + 'static,
) {
    let target = app.clone();
    queue_overlay_action(
        generation,
        || crate::OVERLAY_GENERATION.load(Ordering::SeqCst),
        |work| {
            let _ = app.run_on_main_thread(work);
        },
        move || action(&target),
    );
}

#[cfg(test)]
mod overlay_generation_tests {
    use super::*;
    use std::sync::{atomic::AtomicU64, Arc};

    #[test]
    fn queued_old_timer_cannot_hide_a_new_overlay() {
        let generation = Arc::new(AtomicU64::new(1));
        let visible = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let current = generation.clone();
        let target = visible.clone();
        let mut queued = None;
        queue_overlay_action(
            1,
            move || current.load(Ordering::SeqCst),
            |work| queued = Some(work),
            move || {
                target.store(false, Ordering::SeqCst);
            },
        );
        generation.store(2, Ordering::SeqCst);
        queued.take().unwrap()();
        assert!(visible.load(Ordering::SeqCst));
    }

    #[test]
    fn current_overlay_timer_hides() {
        let visible = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let target = visible.clone();
        queue_overlay_action(
            2,
            || 2,
            |work| work(),
            move || {
                target.store(false, Ordering::SeqCst);
            },
        );
        assert!(!visible.load(Ordering::SeqCst));
    }
}

/// Show a brief "Copied" pill overlay. Creates the window lazily.
/// The `label` is a pre-localized string from the frontend (e.g. "Copied", "Kopiert").
/// Colors (bg, fg, accent) come from the active theme's CSS variables.
/// `position`: "cursor" | "top-center" | "bottom-center"
/// `duration_ms`: how long the pill stays visible before fade-out
/// `animation`: exit animation name ("fade-down", "fade-up", "fade", "scale-down", "pop", "blur")
// TODO: refactor to take &OverlayConfig (mirrors commands.rs IPC).
#[allow(clippy::too_many_arguments)]
pub fn show_copy_overlay(
    app: &tauri::AppHandle,
    label: &str,
    bg: &str,
    fg: &str,
    accent: &str,
    position: &str,
    duration_ms: u64,
    animation: &str,
) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // Get or create overlay window
    let win = match app.get_webview_window("overlay") {
        Some(w) => {
            // Reapply extended styles — WebView2 may reset them after reloads
            apply_overlay_styles(&w);
            w
        }
        None => {
            match WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
                .title("")
                .inner_size(OVERLAY_WIDTH, OVERLAY_HEIGHT)
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .resizable(false)
                .focused(false)
                .build()
            {
                Ok(w) => {
                    apply_overlay_styles(&w);
                    w
                }
                Err(e) => {
                    tracing::warn!("Failed to create overlay window: {e}");
                    return;
                }
            }
        }
    };

    // Position based on user preference
    if let Err(e) = position_overlay(&win, position) {
        tracing::debug!("Overlay positioning failed: {e}");
        return;
    }

    // Set label text and theme colors via JS, then trigger animation.
    // serde_json::to_string() handles all JS escaping (quotes, newlines, U+2028/2029, NUL).
    let jl = serde_json::to_string(label).unwrap_or_default();
    let jb = serde_json::to_string(bg).unwrap_or_default();
    let jf = serde_json::to_string(fg).unwrap_or_default();
    let ja = serde_json::to_string(accent).unwrap_or_default();
    let jan = serde_json::to_string(animation).unwrap_or_default();
    let fade_ms = overlay_fade_ms(duration_ms);
    // Guard: on first creation overlay.html may not have finished loading yet.
    // Retry via setTimeout if __overlay_show is not defined yet.
    let _ = win.eval(format!(
        "if(typeof window.__overlay_show==='function'){{window.__overlay_show({jl},{jb},{jf},{ja},{fade_ms},{jan})}}else{{setTimeout(()=>window.__overlay_show?.({jl},{jb},{jf},{ja},{fade_ms},{jan}),50)}}"
    ));

    // Show without focus (Windows)
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
            SW_SHOWNOACTIVATE,
        };
        if let Some(hwnd) = get_hwnd(&win) {
            // SAFETY: `hwnd` is a live overlay window handle created above (or
            // retrieved via get_webview_window); ShowWindow and SetWindowPos
            // accept valid HWNDs and plain integer flags; no pointer lifetimes.
            unsafe {
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
                );
            }
        } else {
            let _ = win.show();
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = win.show();
    }

    // Hide after duration_ms with generation guard for rapid copies
    let gen = crate::OVERLAY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let fade_ms = overlay_fade_ms(duration_ms);
    let app_clone = app.clone();
    std::thread::Builder::new()
        .name("overlay-hide".into())
        .spawn(move || {
            std::thread::sleep(Duration::from_millis(duration_ms));
            run_for_current_overlay(&app_clone, gen, |app| {
                if let Some(w) = app.get_webview_window("overlay") {
                    let _ = w.eval("window.__overlay_hide()");
                }
            });
            std::thread::sleep(Duration::from_millis(fade_ms));
            run_for_current_overlay(&app_clone, gen, |app| {
                if let Some(w) = app.get_webview_window("overlay") {
                    force_hide_overlay(&w);
                }
            });
            std::thread::sleep(Duration::from_millis(500));
            run_for_current_overlay(&app_clone, gen, safety_verify_hidden);
        })
        .ok();
}

/// Safety check: verify overlay is hidden. If still visible, force-hide again.
#[cfg(target_os = "windows")]
fn safety_verify_hidden(app: &tauri::AppHandle) {
    use windows::Win32::UI::WindowsAndMessaging::IsWindowVisible;
    if let Some(w) = app.get_webview_window("overlay") {
        if let Some(hwnd) = get_hwnd(&w) {
            // SAFETY: `hwnd` is a live overlay window handle; IsWindowVisible
            // accepts any HWND (returns FALSE for invalid ones) — no dereference.
            if unsafe { IsWindowVisible(hwnd) }.as_bool() {
                tracing::warn!("Overlay still visible after hide — forcing again");
                force_hide_overlay(&w);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn safety_verify_hidden(_app: &tauri::AppHandle) {}

/// Force-hide the overlay window using raw Win32 API.
/// Tauri's `w.hide()` can fail silently for WebView2 windows,
/// leaving an invisible but click-intercepting window.
/// Belt-and-suspenders: move offscreen THEN hide.
#[cfg(target_os = "windows")]
fn force_hide_overlay(win: &WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, ShowWindow, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE,
    };
    if let Some(hwnd) = get_hwnd(win) {
        // SAFETY: `hwnd` is a live overlay window handle; SetWindowPos and
        // ShowWindow accept valid HWNDs and plain integer flags; moving offscreen
        // to (-32000, -32000) is a well-known Windows idiom and always safe.
        unsafe {
            // Move offscreen first — instant, guarantees no click blocking
            // even if ShowWindow somehow fails
            let _ = SetWindowPos(
                hwnd,
                None,
                -32000,
                -32000,
                0,
                0,
                SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOZORDER,
            );
            // Then hide via raw Win32 API (bypasses Tauri)
            let _ = ShowWindow(hwnd, SW_HIDE);
        }
    } else {
        // Fallback: try Tauri's hide
        let _ = win.hide();
    }
}

#[cfg(not(target_os = "windows"))]
fn force_hide_overlay(win: &WebviewWindow) {
    let _ = win.hide();
}

/// Apply WS_EX_NOACTIVATE + WS_EX_TOOLWINDOW + WS_EX_TRANSPARENT to overlay.
#[cfg(target_os = "windows")]
fn apply_overlay_styles(win: &WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE,
    };
    if let Some(hwnd) = get_hwnd(win) {
        const WS_EX_NOACTIVATE: isize = 0x0800_0000;
        const WS_EX_TOOLWINDOW: isize = 0x0000_0080;
        const WS_EX_TRANSPARENT_CLICK: isize = 0x0000_0020;
        // SAFETY: `hwnd` is a live overlay window handle from Tauri; reading
        // and writing GWL_EXSTYLE via Get/SetWindowLongPtrW is safe with a
        // valid HWND and the GWL_EXSTYLE index.
        unsafe {
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(
                hwnd,
                GWL_EXSTYLE,
                ex | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TRANSPARENT_CLICK,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn apply_overlay_styles(_win: &WebviewWindow) {}

/// Position overlay based on user preference.
fn position_overlay(win: &WebviewWindow, position: &str) -> Result<(), Box<dyn std::error::Error>> {
    let cursor = win.cursor_position()?;

    // Get monitor scale factor for DPI-aware sizing
    let scale = win
        .available_monitors()?
        .iter()
        .find(|m| {
            let p = m.position();
            let s = m.size();
            cursor.x >= p.x as f64
                && cursor.x < (p.x as f64 + s.width as f64)
                && cursor.y >= p.y as f64
                && cursor.y < (p.y as f64 + s.height as f64)
        })
        .map(|m| m.scale_factor())
        .unwrap_or(1.0);

    let phys_w = OVERLAY_WIDTH * scale;
    let phys_h = OVERLAY_HEIGHT * scale;

    // Use work area (excludes taskbar) for clamping
    let wa = get_work_area(cursor.x as i32, cursor.y as i32);
    let (mon_x, mon_y, mon_w, mon_h) = if let Some(ref wa) = wa {
        (wa.x, wa.y, wa.w, wa.h)
    } else {
        (0.0, 0.0, 3840.0, 2160.0)
    };

    let (x, y) = match position {
        "top-center" => {
            let x = mon_x + (mon_w - phys_w) / 2.0;
            let y = mon_y + 40.0 * scale;
            (x, y)
        }
        "bottom-center" => {
            let x = mon_x + (mon_w - phys_w) / 2.0;
            let y = mon_y + mon_h - phys_h - 60.0 * scale;
            (x, y)
        }
        _ => {
            // "cursor" — prefer right+below cursor; flip if overflow
            let x_right = cursor.x + OVERLAY_OFFSET_X;
            let x = if x_right + phys_w <= mon_x + mon_w {
                x_right
            } else {
                (cursor.x - phys_w - OVERLAY_OFFSET_X).max(mon_x)
            };
            let y_below = cursor.y + OVERLAY_OFFSET_Y;
            let y = if y_below + phys_h <= mon_y + mon_h {
                y_below
            } else {
                (cursor.y - phys_h - OVERLAY_OFFSET_Y).max(mon_y)
            };
            (x, y)
        }
    };

    win.set_position(PhysicalPosition::new(x as i32, y as i32))?;
    Ok(())
}
