//! Window/runtime IPC: show/hide, mode, position, recovery notice, OS build.

use std::fs;

use tauri::Manager;
use tracing::info;

use crate::error::AppError;
use crate::{CurrentWindowMode, WindowMode};

/// Activate the Beetroot window (called when user clicks to interact).
/// Removes WS_EX_NOACTIVATE and brings window to foreground.
#[tauri::command]
pub fn activate_window(app: tauri::AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("main") {
        #[cfg(target_os = "windows")]
        {
            crate::window::activate_no_focus_window(&win);
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = win.set_focus();
        }
    }
    Ok(())
}

/// Check if running as MSIX/Store package.
#[tauri::command]
pub fn is_store_build() -> bool {
    crate::is_store_package()
}

/// Show a brief "Copied" overlay with a localized label.
/// Must run on main thread because WebviewWindowBuilder::build() requires it.
// TODO: refactor to OverlayConfig struct (8 args > 7 threshold).
// IPC contract is per-arg, but internal calls can adopt a struct.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn show_copy_overlay(
    app: tauri::AppHandle,
    label: String,
    bg: String,
    fg: String,
    accent: String,
    position: String,
    duration_ms: u64,
    animation: String,
) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        crate::window::show_copy_overlay(
            &app2,
            &label,
            &bg,
            &fg,
            &accent,
            &position,
            duration_ms,
            &animation,
        );
    });
}

/// Hide the window and clear no-focus state.
#[tauri::command]
pub fn hide_window(app: tauri::AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("main") {
        crate::window::hide_and_clear_state(&win);
    }
    Ok(())
}

/// Set the window positioning mode (normal / pinned / follow-cursor).
/// Syncs always-on-top native flag when switching to/from pinned.
#[tauri::command]
pub fn set_window_mode(app: tauri::AppHandle, mode: String) -> Result<(), AppError> {
    let new_mode = match mode.as_str() {
        "pinned" => WindowMode::Pinned,
        "follow-cursor" => WindowMode::FollowCursor,
        _ => WindowMode::Normal,
    };

    let win = app.get_webview_window("main");
    apply_window_mode(
        new_mode,
        &app.state::<CurrentWindowMode>(),
        || {
            if let Some(win) = &win {
                #[cfg(target_os = "windows")]
                crate::window::activate_no_focus_window(win);
            }
        },
        |topmost| {
            if let Some(win) = &win {
                let _ = win.set_always_on_top(topmost);
            }
        },
    );

    info!(mode = %mode, "window mode set");
    Ok(())
}

/// Set the window position on the monitor (center / top-left / top-right / bottom-left / bottom-right).
#[tauri::command]
pub fn set_window_position(app: tauri::AppHandle, position: String) -> Result<(), AppError> {
    use crate::{CurrentWindowPosition, WindowPosition};

    let new_pos = match position.as_str() {
        "top-left" => WindowPosition::TopLeft,
        "top-right" => WindowPosition::TopRight,
        "bottom-left" => WindowPosition::BottomLeft,
        "bottom-right" => WindowPosition::BottomRight,
        _ => WindowPosition::Center,
    };

    *app.state::<CurrentWindowPosition>().0.lock() = new_pos;

    info!(position = %position, "window position set");
    Ok(())
}

/// Check if a recovery notice exists (written after DB corruption recovery).
/// Returns the notice message and deletes the file, or None if no recovery happened.
#[tauri::command]
pub fn check_recovery_notice(app: tauri::AppHandle) -> Option<String> {
    let data_dir = app.state::<crate::DataDir>();
    let notice_path = data_dir.0.join("RECOVERY_NOTICE.txt");
    if notice_path.exists() {
        let msg = fs::read_to_string(&notice_path).ok();
        let _ = fs::remove_file(&notice_path);
        info!("recovery notice read and cleaned up");
        msg
    } else {
        None
    }
}

/// Return the Windows build number (e.g. 22621 for Win11 23H2).
/// Used by frontend to show OS-appropriate window effect options.
#[tauri::command]
pub fn get_os_build() -> u32 {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    hklm.open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .ok()
        .and_then(|k| k.get_value::<String, _>("CurrentBuild").ok())
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
}

fn apply_window_mode(
    mode: WindowMode,
    current: &CurrentWindowMode,
    activate: impl FnOnce(),
    set_topmost: impl FnOnce(bool),
) {
    // Activation reads this state to distinguish explicit pinning from temporary TOPMOST.
    *current.0.lock() = mode;
    let pinned = mode == WindowMode::Pinned;
    if pinned {
        activate();
    }
    set_topmost(pinned);
}

#[cfg(test)]
mod mode_transition_tests {
    use super::*;

    #[test]
    fn pinning_clears_no_focus_before_restoring_topmost() {
        let events = std::cell::RefCell::new(Vec::new());
        let current = CurrentWindowMode(parking_lot::Mutex::new(WindowMode::Normal));
        apply_window_mode(
            WindowMode::Pinned,
            &current,
            || {
                assert!(*current.0.lock() == WindowMode::Pinned);
                events.borrow_mut().push("activate-and-clear");
            },
            |topmost| {
                events
                    .borrow_mut()
                    .push(if topmost { "topmost" } else { "not-topmost" })
            },
        );
        assert_eq!(*events.borrow(), ["activate-and-clear", "topmost"]);
    }

    #[test]
    fn unpinning_does_not_activate() {
        let mut topmost = true;
        let current = CurrentWindowMode(parking_lot::Mutex::new(WindowMode::Pinned));
        apply_window_mode(
            WindowMode::Normal,
            &current,
            || panic!("must not activate"),
            |value| topmost = value,
        );
        assert!(!topmost);
        assert!(*current.0.lock() == WindowMode::Normal);
    }

    #[test]
    fn cold_start_pinning_does_not_clear_an_already_cached_topmost_flag() {
        let current = CurrentWindowMode(parking_lot::Mutex::new(WindowMode::Normal));
        let native_topmost = std::cell::Cell::new(true);
        apply_window_mode(
            WindowMode::Pinned,
            &current,
            || native_topmost.set(*current.0.lock() == WindowMode::Pinned),
            |topmost| {
                // The configured Tauri flag is already true, so its setter is a no-op.
                assert!(topmost);
            },
        );
        assert!(native_topmost.get());
    }

    #[test]
    fn follow_cursor_publishes_mode_before_removing_topmost_without_activation() {
        let current = CurrentWindowMode(parking_lot::Mutex::new(WindowMode::Pinned));
        apply_window_mode(
            WindowMode::FollowCursor,
            &current,
            || panic!("must not activate"),
            |topmost| {
                assert!(*current.0.lock() == WindowMode::FollowCursor);
                assert!(!topmost);
            },
        );
    }
}

#[tauri::command]
pub fn is_isolated_build() -> bool {
    crate::build_profile::isolated()
}
