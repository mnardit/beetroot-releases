//! Low-level keyboard + mouse hooks for no-focus mode.
//!
//! - WH_KEYBOARD_LL: intercepts modifier-less navigation keys (arrows, Space,
//!   Enter, Escape). Posts WM_NAV_KEY to the hotkey thread (which has a proven
//!   message loop for reliable app.emit()). Returns LRESULT(1) to suppress keys.
//!
//! - WH_MOUSE_LL: hides Beetroot on click outside (like Win+V).
//!
//! The hooks are reinstalled on every no-focus show via `reinstall()` to
//! recover from silent removal by Windows (Win11 removes hooks if callbacks
//! take >LowLevelHooksTimeout).
//!
//! Modifier combinations (Ctrl+C, Alt+S, etc.) are handled by RegisterHotKey
//! on the hotkey thread in hotkey.rs.

use tracing::{debug, info, warn};

#[cfg(target_os = "windows")]
struct NavigationKeys {
    down: [Option<(bool, u64)>; 256],
}

#[cfg(target_os = "windows")]
impl Default for NavigationKeys {
    fn default() -> Self {
        Self { down: [None; 256] }
    }
}

#[cfg(target_os = "windows")]
impl NavigationKeys {
    fn is_navigation(key: u32) -> bool {
        matches!(
            key,
            vk::UP
                | vk::DOWN
                | vk::HOME
                | vk::END
                | vk::PRIOR
                | vk::NEXT
                | vk::SPACE
                | vk::RETURN
                | vk::ESCAPE
        )
    }

    fn event(
        &mut self,
        key: u32,
        down: bool,
        active: bool,
        modified: bool,
        generation: u64,
    ) -> (bool, bool) {
        if !Self::is_navigation(key) {
            return (false, false);
        }
        let state = &mut self.down[key as usize];
        if !down {
            return (
                state.take().is_some_and(|(intercepted, _)| intercepted),
                false,
            );
        }
        let (intercepted, started) = *state.get_or_insert((active && !modified, generation));
        (
            intercepted,
            intercepted && active && !modified && started == generation,
        )
    }
}

#[cfg(target_os = "windows")]
thread_local! {
    static NAVIGATION_KEYS: std::cell::RefCell<NavigationKeys> = std::cell::RefCell::new(NavigationKeys::default());
}

pub(crate) fn dispatch_navigation_if_current(
    posted: u64,
    current: u64,
    active: bool,
    dispatch: impl FnOnce(),
) {
    if active && posted == current {
        dispatch();
    }
}

#[cfg(all(test, target_os = "windows"))]
mod navigation_tests {
    use super::*;

    #[test]
    fn modified_navigation_and_space_pass_both_halves() {
        for key in [
            vk::UP,
            vk::DOWN,
            vk::HOME,
            vk::END,
            vk::PRIOR,
            vk::NEXT,
            vk::SPACE,
            vk::RETURN,
            vk::ESCAPE,
        ] {
            let mut keys = NavigationKeys::default();
            assert_eq!(keys.event(key, true, true, true, 1), (false, false));
            assert_eq!(keys.event(key, false, true, false, 1), (false, false));
        }
    }

    #[test]
    fn intercepted_down_keeps_its_up_and_repeats_after_mode_change() {
        let mut keys = NavigationKeys::default();
        assert_eq!(keys.event(vk::DOWN, true, true, false, 1), (true, true));
        assert_eq!(keys.event(vk::DOWN, true, false, false, 1), (true, false));
        assert_eq!(keys.event(vk::DOWN, true, true, false, 2), (true, false));
        assert_eq!(keys.event(vk::DOWN, false, false, false, 2), (true, false));
        assert_eq!(keys.event(vk::DOWN, true, true, false, 2), (true, true));
    }

    #[test]
    fn forwarded_down_never_loses_its_up_on_entering_no_focus() {
        let mut keys = NavigationKeys::default();
        assert_eq!(keys.event(vk::SPACE, true, false, false, 1), (false, false));
        assert_eq!(keys.event(vk::SPACE, true, true, false, 2), (false, false));
        assert_eq!(keys.event(vk::SPACE, false, true, false, 2), (false, false));
    }

    #[test]
    fn orphan_up_is_not_swallowed() {
        assert_eq!(
            NavigationKeys::default().event(vk::SPACE, false, true, false, 1),
            (false, false)
        );
    }

    #[test]
    fn queued_navigation_does_not_reach_a_new_or_inactive_mode() {
        let mut delivered = Vec::new();
        dispatch_navigation_if_current(1, 1, false, || delivered.push("inactive"));
        dispatch_navigation_if_current(1, 2, true, || delivered.push("stale"));
        dispatch_navigation_if_current(2, 2, true, || delivered.push("current"));
        assert_eq!(delivered, ["current"]);
    }

    #[test]
    fn readiness_handoff_checks_mode_at_delivery_not_when_queued() {
        use std::cell::Cell;

        for (current, active, expected) in [(7, true, 1), (8, true, 0), (7, false, 0)] {
            let generation = Cell::new(7);
            let mode = Cell::new(true);
            let ready = Cell::new(false);
            let delivered = Cell::new(0);
            let queued = || {
                dispatch_navigation_if_current(7, generation.get(), mode.get(), || {
                    if ready.get() {
                        delivered.set(delivered.get() + 1);
                    }
                });
            };
            ready.set(true);
            generation.set(current);
            mode.set(active);
            queued();
            assert_eq!(delivered.get(), expected);
        }
    }
}

#[cfg(target_os = "windows")]
mod vk {
    pub const UP: u32 = 0x26;
    pub const DOWN: u32 = 0x28;
    pub const RETURN: u32 = 0x0D;
    pub const ESCAPE: u32 = 0x1B;
    pub const HOME: u32 = 0x24;
    pub const END: u32 = 0x23;
    pub const PRIOR: u32 = 0x21; // Page Up
    pub const NEXT: u32 = 0x22; // Page Down
    pub const SPACE: u32 = 0x20;
}

/// Thread ID of the hook thread — used for messages (reinstall, shutdown).
#[cfg(target_os = "windows")]
static HOOK_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Thread ID of the hotkey thread — nav key events are posted here via WM_NAV_KEY.
/// Set by `set_hotkey_thread_id()` during startup.
#[cfg(target_os = "windows")]
static HOTKEY_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Custom message: reinstall hooks (sent on every no-focus show).
#[cfg(target_os = "windows")]
const WM_REINSTALL_HOOKS: u32 = 0x0400 + 42; // WM_USER + 42

/// Tell the keyboard hook which thread to post WM_NAV_KEY to.
#[cfg(target_os = "windows")]
pub fn set_hotkey_thread_id(tid: u32) {
    HOTKEY_THREAD_ID.store(tid, std::sync::atomic::Ordering::SeqCst);
}

/// Install the keyboard + mouse hooks. Call once at startup.
#[cfg(target_os = "windows")]
pub fn install() {
    // No worker thread needed — nav events are posted to the hotkey thread
    // via PostThreadMessageW(WM_NAV_KEY), keeping the hook callback ultra-fast.

    std::thread::Builder::new()
        .name("keyboard-hook".into())
        .spawn(|| {
            use windows::Win32::System::Threading::GetCurrentThreadId;
            use windows::Win32::UI::WindowsAndMessaging::{
                GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, MSG, WH_KEYBOARD_LL,
                WH_MOUSE_LL,
            };

            // SAFETY: GetCurrentThreadId always succeeds and returns the caller's
            // thread ID; no pointers involved.
            let tid = unsafe { GetCurrentThreadId() };
            HOOK_THREAD_ID.store(tid, std::sync::atomic::Ordering::SeqCst);

            // SAFETY: SetWindowsHookExW with WH_KEYBOARD_LL and thread-id=0
            // installs a global low-level keyboard hook. `keyboard_hook_proc` is
            // a valid `unsafe extern "system"` fn with the required signature;
            // hmod=None is correct for LL hooks (OS-managed).
            let mut kb_hook =
                unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0) };
            // SAFETY: Same invariants as the keyboard hook above — WH_MOUSE_LL,
            // `mouse_hook_proc` is a valid `unsafe extern "system"` fn, hmod=None.
            let mut mouse_hook =
                unsafe { SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0) };

            match (&kb_hook, &mouse_hook) {
                (Ok(_), Ok(_)) => debug!("keyboard + mouse hooks installed"),
                (Ok(_), Err(e)) => warn!("keyboard hook ok, mouse hook failed: {e}"),
                (Err(e), Ok(_)) => warn!("keyboard hook failed: {e}, mouse hook ok"),
                (Err(e1), Err(e2)) => warn!("both hooks failed: kb={e1}, mouse={e2}"),
            }

            let mut msg = MSG::default();
            loop {
                // SAFETY: GetMessageW writes into `msg` (stack-allocated MSG);
                // hwnd=None means retrieve messages for any window on this thread;
                // min=0/max=0 means no filtering — all messages are retrieved.
                let ret = unsafe { GetMessageW(&mut msg, None, 0, 0) };
                if !ret.as_bool() {
                    break; // WM_QUIT
                }

                if msg.message == WM_REINSTALL_HOOKS {
                    if let Ok(ref h) = kb_hook {
                        // SAFETY: `*h` is a live HHOOK handle returned by
                        // SetWindowsHookExW above; UnhookWindowsHookEx releases it.
                        unsafe {
                            let _ = UnhookWindowsHookEx(*h);
                        }
                    }
                    if let Ok(ref h) = mouse_hook {
                        // SAFETY: same as kb_hook — live HHOOK being released.
                        unsafe {
                            let _ = UnhookWindowsHookEx(*h);
                        }
                    }
                    // SAFETY: same invariants as the initial WH_KEYBOARD_LL install above.
                    kb_hook = unsafe {
                        SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0)
                    };
                    // SAFETY: same invariants as the initial WH_MOUSE_LL install above.
                    mouse_hook =
                        unsafe { SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0) };
                    info!(
                        "hooks reinstalled: kb={}, mouse={}",
                        kb_hook.is_ok(),
                        mouse_hook.is_ok()
                    );
                }
            }

            if let Ok(ref h) = kb_hook {
                // SAFETY: `*h` is a live HHOOK — final cleanup on thread exit.
                unsafe {
                    let _ = UnhookWindowsHookEx(*h);
                }
            }
            if let Ok(ref h) = mouse_hook {
                // SAFETY: `*h` is a live HHOOK — final cleanup on thread exit.
                unsafe {
                    let _ = UnhookWindowsHookEx(*h);
                }
            }
            debug!("hooks uninstalled");
        })
        .expect("failed to spawn keyboard hook thread");
}

/// Reinstall hooks — call on every no-focus show to recover from silent removal.
#[cfg(target_os = "windows")]
pub fn reinstall() {
    use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
    let tid = HOOK_THREAD_ID.load(std::sync::atomic::Ordering::SeqCst);
    if tid != 0 {
        // SAFETY: `tid` is the hook thread's ID (stored at thread start);
        // PostThreadMessageW with integer wParam/lParam is always safe to call
        // from any thread for any valid thread ID.
        unsafe {
            use windows::Win32::Foundation::{LPARAM, WPARAM};
            let _ = PostThreadMessageW(tid, WM_REINSTALL_HOOKS, WPARAM(0), LPARAM(0));
        }
    }
}

/// Gracefully stop the hook thread (call on app exit).
#[cfg(target_os = "windows")]
pub fn shutdown() {
    use windows::Win32::UI::WindowsAndMessaging::{PostThreadMessageW, WM_QUIT};
    let tid = HOOK_THREAD_ID.load(std::sync::atomic::Ordering::SeqCst);
    if tid != 0 {
        // SAFETY: `tid` is the hook thread's ID; PostThreadMessageW with
        // WM_QUIT causes GetMessageW to return FALSE, breaking the message loop.
        unsafe {
            use windows::Win32::Foundation::{LPARAM, WPARAM};
            let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn install() {}

#[cfg(not(target_os = "windows"))]
pub fn reinstall() {}

#[cfg(not(target_os = "windows"))]
pub fn shutdown() {}

#[cfg(not(target_os = "windows"))]
pub fn set_hotkey_thread_id(_tid: u32) {}

/// Keyboard hook callback — intercepts modifier-less navigation keys.
/// Posts WM_NAV_KEY to the hotkey thread (ultra-fast: just a PostThreadMessageW).
/// The hotkey thread has a proven message loop and calls app.emit() reliably.
#[cfg(target_os = "windows")]
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    if code < 0 {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let msg = wparam.0 as u32;
    let is_down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
    let is_up = msg == WM_KEYUP || msg == WM_SYSKEYUP;

    if !is_down && !is_up {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    // SAFETY: lparam points to a KBDLLHOOKSTRUCT for the lifetime of this
    // WH_KEYBOARD_LL callback (contract of the low-level keyboard hook API);
    // we only read from it and the struct is valid for the duration of the call.
    let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
    let vk_code = kb.vkCode;
    if !NavigationKeys::is_navigation(vk_code) {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let generation = crate::NOFOCUS_GENERATION.load(std::sync::atomic::Ordering::SeqCst);
    let active = crate::NO_FOCUS_ACTIVE.load(std::sync::atomic::Ordering::SeqCst);
    let modified = is_down && active && crate::commands::physical_modifiers_down();
    let (suppress, dispatch) = NAVIGATION_KEYS.with(|keys| {
        keys.borrow_mut()
            .event(vk_code, is_down, active, modified, generation)
    });
    if !suppress {
        return CallNextHookEx(None, code, wparam, lparam);
    }
    if !dispatch {
        return windows::Win32::Foundation::LRESULT(1);
    }

    // Post VK code to the hotkey thread.
    let hotkey_tid = HOTKEY_THREAD_ID.load(std::sync::atomic::Ordering::SeqCst);
    if hotkey_tid == 0 {
        // Hotkey thread ID not set — can't deliver event
        return windows::Win32::Foundation::LRESULT(1);
    }
    {
        use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
        let _ = PostThreadMessageW(
            hotkey_tid,
            crate::hotkey::WM_NAV_KEY,
            windows::Win32::Foundation::WPARAM(vk_code as usize),
            windows::Win32::Foundation::LPARAM(generation as isize),
        );
    }

    // Suppress key from reaching the foreground app
    windows::Win32::Foundation::LRESULT(1)
}

/// Mouse hook callback — posts WM_CLICK_OUTSIDE to the hotkey thread on every
/// L/R/NC button-down while no-focus mode is active; the inside/outside rect
/// test runs in the handler on the hotkey thread.
/// Window work is done off the hook callback to keep it fast and avoid silent
/// removal by Windows (LowLevelHooksTimeout).
#[cfg(target_os = "windows")]
unsafe extern "system" fn mouse_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, MSLLHOOKSTRUCT, WM_LBUTTONDOWN, WM_NCLBUTTONDOWN, WM_RBUTTONDOWN,
    };

    if code >= 0
        && (wparam.0 as u32 == WM_LBUTTONDOWN
            || wparam.0 as u32 == WM_RBUTTONDOWN
            || wparam.0 as u32 == WM_NCLBUTTONDOWN)
        && crate::NO_FOCUS_ACTIVE.load(std::sync::atomic::Ordering::SeqCst)
    {
        // SAFETY: lparam points to an MSLLHOOKSTRUCT for the lifetime of this
        // WH_MOUSE_LL callback (contract of the low-level mouse hook API);
        // we only read ms.pt.x/y and the struct is valid for the duration of
        // the call.  PostThreadMessageW passes the coordinates as plain integers.
        let ms = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        let tid = HOTKEY_THREAD_ID.load(std::sync::atomic::Ordering::SeqCst);
        if tid != 0 {
            use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
            let _ = PostThreadMessageW(
                tid,
                crate::hotkey::WM_CLICK_OUTSIDE,
                windows::Win32::Foundation::WPARAM(ms.pt.x as u32 as usize),
                windows::Win32::Foundation::LPARAM(ms.pt.y as isize),
            );
        }
    }

    CallNextHookEx(None, code, wparam, lparam)
}
