//! System tray icon and context menu.

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewWindow,
};

use crate::window;

/// Show the window from tray click — always WITH focus (intentional user action).
/// Tray clicks bypass no-focus mode: is_pinned=true forces focused show.
fn show_window(win: &WebviewWindow, app: &tauri::AppHandle) {
    // The taskbar/menu can own foreground here, so no application target is reliable.
    if let Some(target) = app.try_state::<crate::PreviousForegroundWindow>() {
        target.clear();
    }
    let is_pinned = win.is_always_on_top().unwrap_or(false);
    if is_pinned {
        let _ = win.show();
        let _ = win.set_focus();
        crate::WINDOW_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
    } else {
        let mode = app
            .try_state::<crate::CurrentWindowMode>()
            .map(|s| *s.0.lock());
        match mode {
            // Force is_pinned=true to get focused show (not no-focus)
            Some(crate::WindowMode::FollowCursor) => window::show_near_cursor(win, true),
            _ => window::show_on_active_monitor(win, true),
        }
    }
}

/// Light icon (white) for dark taskbar
const TRAY_LIGHT: &[u8] = include_bytes!("../icons/tray-light.png");
/// Dark icon (black) for light taskbar
const TRAY_DARK: &[u8] = include_bytes!("../icons/tray-dark.png");

/// Check Windows registry to determine if the taskbar uses a light theme.
/// Returns true when the system taskbar is light (so we need a dark icon).
fn is_light_taskbar() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) =
            hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize")
        {
            // SystemUsesLightTheme: 1 = light, 0 = dark
            if let Ok(val) = key.get_value::<u32, _>("SystemUsesLightTheme") {
                return val == 1;
            }
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

pub fn create_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Menu items in English — standard for system tray on Windows (most apps don't localize)
    let show_i = MenuItem::with_id(app, "show", "Show Clipboard", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&show_i)
        .item(&settings_i)
        .separator()
        .item(&quit_i)
        .build()?;

    let icon_bytes = if is_light_taskbar() {
        TRAY_DARK
    } else {
        TRAY_LIGHT
    };
    let icon = Image::from_bytes(icon_bytes)?;

    let _tray = TrayIconBuilder::with_id("tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("Beetroot")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    show_window(&win, app);
                }
            }
            "settings" => {
                if let Some(win) = app.get_webview_window("main") {
                    show_window(&win, app);
                    let _ = win.emit("open-settings", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if crate::WINDOW_VISIBLE.load(std::sync::atomic::Ordering::SeqCst) {
                        window::hide_and_clear_state(&win);
                    } else {
                        show_window(&win, app);
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
