//! SendInput-based paste: clipboard write → suppress → hide → Ctrl+V. Timing-sensitive.

use std::time::Duration;

use serde::Serialize;
use tauri::Manager;
use tracing::info;

use crate::error::AppError;

#[cfg(target_os = "windows")]
mod clipboard_formats {
    use std::time::Duration;
    use windows::Win32::Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EnumClipboardFormats, GetClipboardFormatNameW, OpenClipboard,
    };

    fn open_with_retry(
        mut open: impl FnMut() -> Result<(), String>,
        mut sleep: impl FnMut(Duration),
    ) -> Result<(), String> {
        for attempt in 0..3 {
            match open() {
                Ok(()) => return Ok(()),
                Err(error) if attempt == 2 => return Err(error),
                Err(_) => sleep(Duration::from_millis(25)),
            }
        }
        unreachable!()
    }

    fn read_format_names(
        mut next: impl FnMut(u32) -> Result<Option<u32>, String>,
        mut name: impl FnMut(u32) -> Result<String, String>,
    ) -> Result<Vec<String>, String> {
        let mut names = Vec::new();
        let mut previous = 0;
        while let Some(format) = next(previous)? {
            if format >= 0xc000 {
                names.push(name(format)?);
            }
            previous = format;
        }
        Ok(names)
    }

    /// A partial format list cannot establish the absence of exclusion markers.
    pub fn get_format_names() -> Result<Vec<String>, String> {
        // SAFETY: all calls use the same thread-owned open interval and no borrowed data
        // survives it. CloseClipboard is called even if enumeration or name lookup fails.
        unsafe {
            open_with_retry(
                || OpenClipboard(HWND::default()).map_err(|e| format!("OpenClipboard failed: {e}")),
                std::thread::sleep,
            )?;
            let result = read_format_names(
                |previous| {
                    SetLastError(ERROR_SUCCESS);
                    let format = EnumClipboardFormats(previous);
                    if format != 0 {
                        return Ok(Some(format));
                    }
                    let error = GetLastError();
                    if error != ERROR_SUCCESS {
                        return Err(format!("EnumClipboardFormats failed: {error:?}"));
                    }
                    Ok(None)
                },
                |format| {
                    let mut buf = [0u16; 256];
                    let len = GetClipboardFormatNameW(format, &mut buf);
                    if len == 0 {
                        return Err("GetClipboardFormatNameW failed".into());
                    }
                    Ok(String::from_utf16_lossy(&buf[..len as usize]))
                },
            );
            let _ = CloseClipboard();
            result
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn transient_clipboard_owner_lock_is_retried_before_enumeration() {
            let mut attempts = 0;
            let mut delays = Vec::new();
            open_with_retry(
                || {
                    attempts += 1;
                    if attempts < 3 {
                        Err("busy".into())
                    } else {
                        Ok(())
                    }
                },
                |duration| delays.push(duration),
            )
            .unwrap();
            assert_eq!(attempts, 3);
            assert_eq!(delays, [Duration::from_millis(25); 2]);
        }

        #[test]
        fn persistent_clipboard_lock_remains_fail_closed_and_bounded() {
            let mut attempts = 0;
            let result = open_with_retry(
                || {
                    attempts += 1;
                    Err("busy".into())
                },
                |_| {},
            );
            assert_eq!(attempts, 3);
            assert_eq!(result, Err("busy".into()));
        }

        #[test]
        fn incomplete_enumeration_cannot_authorize_capture() {
            let result = read_format_names(
                |previous| {
                    if previous == 0 {
                        Ok(Some(0xc001))
                    } else {
                        Err("enumeration failed".into())
                    }
                },
                |_| Ok("ordinary format".into()),
            );
            assert_eq!(result, Err("enumeration failed".into()));
        }

        #[test]
        fn unreadable_registered_name_cannot_be_omitted() {
            let result = read_format_names(
                |previous| {
                    if previous == 0 {
                        Ok(Some(0xc001))
                    } else {
                        Ok(None)
                    }
                },
                |_| Err("name failed".into()),
            );
            assert_eq!(result, Err("name failed".into()));
        }

        #[test]
        fn complete_formats_preserve_registered_names_only() {
            let result = read_format_names(
                |previous| {
                    Ok(match previous {
                        0 => Some(13),
                        13 => Some(0xc001),
                        _ => None,
                    })
                },
                |format| {
                    assert_eq!(format, 0xc001);
                    Ok("Clipboard Viewer Ignore".into())
                },
            );
            assert_eq!(result.unwrap(), ["Clipboard Viewer Ignore"]);
        }

        /// Retain the IPC error contract without opening the real clipboard.
        #[test]
        fn signature_returns_result() {
            let _: fn() -> Result<Vec<String>, String> = get_format_names;
        }
    }
}

#[cfg(target_os = "windows")]
mod win_paste {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY, VK_CONTROL, VK_V,
    };

    fn key(vk: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    /// Simulates a Ctrl+V keystroke using the Windows `SendInput` API.
    ///
    /// The array is serialized, but still inherits the user's held modifiers.
    /// The caller must use the bounded physical-key/foreground decision boundary.
    pub fn simulate_ctrl_v() -> Result<(), String> {
        let inputs = [
            key(VK_CONTROL, KEYBD_EVENT_FLAGS(0)),
            key(VK_V, KEYBD_EVENT_FLAGS(0)),
            key(VK_V, KEYEVENTF_KEYUP),
            key(VK_CONTROL, KEYEVENTF_KEYUP),
        ];
        // SAFETY: `inputs` is a valid array of initialized INPUT structs; cbSize
        // matches the system layout.
        let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
        if sent != inputs.len() as u32 {
            return Err(format!(
                "SendInput delivered {sent}/{} events",
                inputs.len()
            ));
        }
        Ok(())
    }

    #[cfg(test)]
    mod simulate_ctrl_v_tests {
        use super::*;

        // Compile-time signature lock — does NOT call simulate_ctrl_v at
        // runtime, since the real function dispatches Ctrl+V via SendInput
        // and would paste the dev machine's clipboard into whichever window
        // happens to have focus during `cargo test`. Coercing the function
        // pointer to its expected type catches accidental signature changes
        // (e.g. dropping the Result, changing the error variant) at the same
        // moment as a regular cargo build, without the side effect.
        #[cfg(target_os = "windows")]
        #[test]
        fn simulate_ctrl_v_signature_is_result() {
            let _f: fn() -> Result<(), String> = simulate_ctrl_v;
        }
    }
}

/// Result of paste: "pasted" if Ctrl+V was sent, "copied" if no current
/// target can be verified or the user's held modifiers prevent safe injection.
#[derive(Serialize)]
pub struct PasteResult {
    pub status: String,
}

#[tauri::command]
pub async fn paste_selected_item(app: tauri::AppHandle) -> Result<PasteResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || paste_selected_item_inner(app))
        .await
        .map_err(|error| AppError::Other(error.to_string()))?
}

fn paste_selected_item_inner(app: tauri::AppHandle) -> Result<PasteResult, AppError> {
    // Read the saved foreground window HWND (set when hotkey was pressed)
    #[cfg(target_os = "windows")]
    let target = app
        .try_state::<crate::PreviousForegroundWindow>()
        .map(|s| *s.0.lock())
        .unwrap_or_default();
    #[cfg(target_os = "windows")]
    let prev_hwnd = target.window;

    if let Some(win) = app.get_webview_window("main") {
        // This function runs on a blocking worker. Complete the native handoff on
        // the window's UI thread before waiting for modifiers or sending input.
        let (done, hidden) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            // Keep the popup visible for the existing copied toast. Restoring only
            // Explorer's top-level HWND cannot revive a closed F2 edit control.
            #[cfg(target_os = "windows")]
            if !target.is_alive(is_window_alive) {
                let _ = done.send(false);
                return;
            }
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = crate::window::get_hwnd(&win) {
                restore_before_hide(
                    hwnd.0 as isize,
                    prev_hwnd,
                    is_window_alive,
                    current_foreground_hwnd,
                    |target| {
                        use windows::Win32::Foundation::HWND;
                        use windows::Win32::UI::WindowsAndMessaging::{
                            LockSetForegroundWindow, SetForegroundWindow, LSFW_UNLOCK,
                        };
                        // SAFETY: target was checked for liveness and visibility;
                        // the current foreground is still our own window. Failure
                        // is harmless: the final foreground guard remains mandatory.
                        unsafe {
                            let _ = LockSetForegroundWindow(LSFW_UNLOCK);
                            let _ = SetForegroundWindow(HWND(target as *mut _));
                        }
                    },
                );
            }
            crate::window::hide_and_clear_state(&win);
            let _ = done.send(true);
        })
        .map_err(|error| AppError::Other(error.to_string()))?;
        if !hidden
            .recv()
            .map_err(|error| AppError::Other(error.to_string()))?
        {
            info!("paste target absent or closed; keeping copied feedback visible");
            return Ok(PasteResult {
                status: "copied".into(),
            });
        }
    }

    // Wait for the target window to regain focus after our window hides
    std::thread::sleep(Duration::from_millis(50));

    #[cfg(target_os = "windows")]
    {
        let started = std::time::Instant::now();
        let pasted = inject_when_ready(
            physical_modifiers_down,
            || {
                target_ready(
                    target,
                    is_window_alive,
                    crate::window::focused_control,
                    current_foreground_hwnd,
                )
            },
            || started.elapsed(),
            std::thread::sleep,
            win_paste::simulate_ctrl_v,
        )
        .map_err(AppError::Other)?;
        if !pasted {
            info!("paste target or held modifiers unsafe; content remains copied");
            return Ok(PasteResult {
                status: "copied".into(),
            });
        }
    }

    Ok(PasteResult {
        status: "pasted".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn restore_before_hide(
    own: isize,
    target: isize,
    alive: impl FnOnce(isize) -> bool,
    foreground: impl FnOnce() -> isize,
    restore: impl FnOnce(isize),
) {
    // Restore only while relinquishing our own focus, never after a user switch.
    if own != 0 && target != 0 && target != own && alive(target) && foreground() == own {
        restore(target);
    }
}

/// Read both sides of modifiers that would change the meaning of Ctrl+V/navigation.
#[cfg(target_os = "windows")]
pub(crate) fn physical_modifiers_down() -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_RCONTROL, VK_RMENU,
        VK_RSHIFT, VK_RWIN,
    };
    [
        VK_LCONTROL,
        VK_RCONTROL,
        VK_LSHIFT,
        VK_RSHIFT,
        VK_LMENU,
        VK_RMENU,
        VK_LWIN,
        VK_RWIN,
    ]
    .iter()
    // SAFETY: read-only key state query; high bit means physically held.
    .any(|key| unsafe { GetAsyncKeyState(key.0 as i32) < 0 })
}

/// Check if a window handle is still valid and visible.
#[cfg(target_os = "windows")]
fn is_window_alive(hwnd: isize) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{IsWindow, IsWindowVisible};
    let h = HWND(hwnd as *mut _);
    // SAFETY: IsWindow and IsWindowVisible accept any HWND value (including
    // stale/invalid ones) and safely return FALSE rather than crashing;
    // no pointer dereference or ownership transfer occurs.
    unsafe { IsWindow(h).as_bool() && IsWindowVisible(h).as_bool() }
}

/// Get the current foreground window HWND as isize. Returns 0 if none.
#[cfg(target_os = "windows")]
fn current_foreground_hwnd() -> isize {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    // SAFETY: GetForegroundWindow takes no arguments and always returns a valid
    // HWND (or null if no foreground window); casting the opaque pointer to
    // isize for storage is safe as we never dereference it.
    unsafe { GetForegroundWindow().0 as isize }
}

/// Decide whether to proceed with SendInput based on the saved target HWND
/// and the current foreground HWND. Returns true if it's safe to paste.
///
/// Decision matrix:
/// - prev_hwnd == 0: no target for this invocation (e.g. tray show).
///   Fail closed and copy-only; never inherit an earlier popup's target.
/// - prev_hwnd != 0, current_fg == 0: foreground is in transition (lock
///   screen, alt-tab in progress, focused app dying). Cannot prove the
///   target is still in front → fail closed and copy-only.
/// - prev_hwnd != 0, current_fg != 0: equality check.
#[cfg(target_os = "windows")]
fn should_paste_into_foreground(prev_hwnd: isize, current_fg: isize) -> bool {
    prev_hwnd != 0 && prev_hwnd == current_fg
}

#[cfg(target_os = "windows")]
fn target_ready(
    target: crate::window::PasteTarget,
    alive: impl Fn(isize) -> bool,
    focus: impl FnOnce(isize) -> isize,
    foreground: impl FnOnce() -> isize,
) -> bool {
    target.is_alive(alive)
        && target.matches_focus(focus(target.window))
        && should_paste_into_foreground(target.window, foreground())
}

#[tauri::command]
pub fn get_clipboard_formats() -> Result<Vec<String>, AppError> {
    #[cfg(target_os = "windows")]
    {
        clipboard_formats::get_format_names().map_err(AppError::Other)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "windows")]
fn inject_when_ready(
    mut modifiers_down: impl FnMut() -> bool,
    mut target_ready: impl FnMut() -> bool,
    mut elapsed: impl FnMut() -> Duration,
    mut sleep: impl FnMut(Duration),
    inject: impl FnOnce() -> Result<(), String>,
) -> Result<bool, String> {
    while modifiers_down() {
        if elapsed() >= Duration::from_millis(500) {
            return Ok(false);
        }
        sleep(Duration::from_millis(10));
    }
    if !target_ready() {
        return Ok(false);
    }
    inject()?;
    Ok(true)
}

#[tauri::command]
pub fn get_clipboard_sequence() -> Result<u32, AppError> {
    #[cfg(target_os = "windows")]
    {
        // SAFETY: no arguments or borrowed buffers; zero means unavailable, not identity.
        let sequence =
            unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() };
        if sequence == 0 {
            return Err(AppError::Other("Clipboard sequence unavailable".into()));
        }
        Ok(sequence)
    }
    #[cfg(not(target_os = "windows"))]
    Err(AppError::Other("Clipboard sequence unavailable".into()))
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "windows")]
    #[test]
    fn dismissed_target_cannot_be_restored_or_pasted_after_tray_reopen() {
        use crate::{window::PasteTarget, PreviousForegroundWindow};
        for edit in [0, 4] {
            let saved =
                PreviousForegroundWindow(parking_lot::Mutex::new(PasteTarget { window: 2, edit }));
            // Hide and non-hotkey show both invalidate the previous invocation.
            saved.clear();
            saved.clear();
            let target = *saved.0.lock();
            super::restore_before_hide(
                1,
                target.window,
                |_| true,
                || 1,
                |_| panic!("must not restore the previous application"),
            );
            for foreground in [1, 2, 3] {
                let pasted = super::inject_when_ready(
                    || false,
                    || super::target_ready(target, |_| true, |_| edit, || foreground),
                    || std::time::Duration::ZERO,
                    |_| panic!("no held modifiers"),
                    || panic!("must not inject after a non-hotkey reopen"),
                )
                .unwrap();
                assert!(!pasted);
            }
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn fresh_hotkey_capture_after_dismissal_uses_the_new_application() {
        use crate::{window::PasteTarget, PreviousForegroundWindow};
        let saved =
            PreviousForegroundWindow(parking_lot::Mutex::new(PasteTarget { window: 2, edit: 4 }));
        saved.clear();
        *saved.0.lock() = PasteTarget { window: 3, edit: 5 };
        let target = *saved.0.lock();
        assert!(super::target_ready(
            target,
            |hwnd| [3, 5].contains(&hwnd),
            |_| 5,
            || 3
        ));
        assert!(!super::target_ready(
            target,
            |hwnd| [3, 5].contains(&hwnd),
            |_| 5,
            || 2
        ));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn target_readiness_requires_live_handles_matching_edit_and_foreground() {
        use crate::window::PasteTarget;
        for (target, live, focus, foreground, expected) in [
            (PasteTarget { window: 2, edit: 4 }, vec![2, 4], 4, 2, true),
            (PasteTarget { window: 2, edit: 4 }, vec![2], 4, 2, false),
            (PasteTarget { window: 2, edit: 4 }, vec![4], 4, 2, false),
            (PasteTarget { window: 2, edit: 4 }, vec![2, 4], 5, 2, false),
            (PasteTarget { window: 2, edit: 4 }, vec![2, 4], 0, 2, false),
            (PasteTarget { window: 2, edit: 4 }, vec![2, 4], 4, 3, false),
            (PasteTarget { window: 2, edit: 4 }, vec![2, 4], 4, 0, false),
            (PasteTarget { window: 2, edit: 0 }, vec![2], 5, 2, true),
            (PasteTarget::default(), vec![0], 0, 0, false),
        ] {
            assert_eq!(
                super::target_ready(
                    target,
                    |hwnd| live.contains(&hwnd),
                    |_| focus,
                    || foreground
                ),
                expected,
                "window={}, edit={}, live={live:?}, focus={focus}, foreground={foreground}",
                target.window,
                target.edit,
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn target_readiness_short_circuits_before_later_native_queries() {
        use crate::window::PasteTarget;
        assert!(!super::target_ready(
            PasteTarget { window: 2, edit: 4 },
            |_| false,
            |_| panic!("closed window must not query its focus"),
            || panic!("closed window must not query foreground"),
        ));
        assert!(!super::target_ready(
            PasteTarget { window: 2, edit: 4 },
            |_| true,
            |_| 5,
            || panic!("changed Edit must short-circuit"),
        ));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn uncaptured_target_cannot_inject_into_any_foreground() {
        for foreground in [0, 1, 2] {
            let pasted = super::inject_when_ready(
                || false,
                || super::should_paste_into_foreground(0, foreground),
                || std::time::Duration::ZERO,
                |_| panic!("no held modifiers"),
                || panic!("uncaptured target must stay copy-only"),
            )
            .unwrap();
            assert!(!pasted);
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn focused_paste_hands_focus_back_only_from_our_own_window() {
        use std::cell::Cell;
        for (own, target, foreground, alive, expected) in [
            (1, 2, 1, true, true),
            (1, 2, 2, true, false),
            (1, 2, 3, true, false),
            (1, 2, 0, true, false),
            (1, 2, 1, false, false),
            (1, 0, 1, true, false),
            (1, 1, 1, true, false),
            (0, 2, 0, true, false),
        ] {
            let restored = Cell::new(false);
            super::restore_before_hide(
                own,
                target,
                |_| alive,
                || foreground,
                |value| {
                    assert_eq!(value, target);
                    restored.set(true);
                },
            );
            assert_eq!(restored.get(), expected);
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn held_modifiers_timeout_without_injection() {
        use std::cell::Cell;
        use std::time::Duration;
        let elapsed = Cell::new(Duration::ZERO);
        let sent = Cell::new(false);
        let pasted = super::inject_when_ready(
            || true,
            || true,
            || elapsed.get(),
            |duration| elapsed.set(elapsed.get() + duration),
            || {
                sent.set(true);
                Ok(())
            },
        )
        .unwrap();
        assert!(!pasted);
        assert!(!sent.get());
        assert_eq!(elapsed.get(), Duration::from_millis(500));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn released_modifiers_are_waited_for_before_target_recheck_and_injection() {
        use std::cell::{Cell, RefCell};
        use std::time::Duration;
        let elapsed = Cell::new(Duration::ZERO);
        let events = RefCell::new(Vec::new());
        let pasted = super::inject_when_ready(
            || {
                events.borrow_mut().push("keys");
                elapsed.get() < Duration::from_millis(30)
            },
            || {
                events.borrow_mut().push("target");
                true
            },
            || elapsed.get(),
            |duration| elapsed.set(elapsed.get() + duration),
            || {
                events.borrow_mut().push("inject");
                Ok(())
            },
        )
        .unwrap();
        assert!(pasted);
        assert_eq!(elapsed.get(), Duration::from_millis(30));
        assert_eq!(
            &events.borrow()[events.borrow().len() - 2..],
            &["target", "inject"]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn foreground_change_during_modifier_wait_is_copy_only() {
        use std::cell::Cell;
        use std::time::Duration;
        let elapsed = Cell::new(Duration::ZERO);
        let pasted = super::inject_when_ready(
            || elapsed.get() < Duration::from_millis(20),
            || elapsed.get() == Duration::ZERO,
            || elapsed.get(),
            |duration| elapsed.set(elapsed.get() + duration),
            || panic!("must not inject into the changed foreground"),
        )
        .unwrap();
        assert!(!pasted);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn should_paste_into_foreground_matrix() {
        // No captured target: fail closed, including tray/second-instance shows.
        assert!(!super::should_paste_into_foreground(0, 0));
        assert!(!super::should_paste_into_foreground(0, 0x1234));
        // Saved target present, current unset: foreground in transition,
        // fail closed (copy-only). Cannot prove target is still in front.
        assert!(!super::should_paste_into_foreground(0x1234, 0));
        // Match: paste.
        assert!(super::should_paste_into_foreground(0x1234, 0x1234));
        // Mismatch: do NOT paste.
        assert!(!super::should_paste_into_foreground(0x1234, 0x5678));
    }
}
