#![warn(clippy::undocumented_unsafe_blocks)]
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use tauri::Manager;
use tracing::{error, info, warn};

/// Thread-safe wrapper around a rusqlite connection for direct DB access from commands.
/// Uses parking_lot::Mutex (non-poisoning) — panics in closures won't cascade.
pub struct DbPool(pub parking_lot::Mutex<rusqlite::Connection>);

pub mod ai;
pub(crate) mod backup;
mod build_profile;
mod commands;
pub use commands::check_data_path_relationship;
pub use commands::read_clipboard_image_file;
pub mod error;
pub mod hotkey;
pub mod jobs;
mod keyboard_hook;
pub mod migrations;
mod ocr;
mod search;
pub mod secrets;
#[cfg(target_os = "windows")]
pub mod startup_task;
mod tray;
pub mod validation;
mod window;

pub struct DataDir(pub PathBuf);

/// Detect if running as an MSIX/Store package.
/// Packaged apps run from `C:\Program Files\WindowsApps\<identity>\`.
pub(crate) fn is_store_package() -> bool {
    if let Ok(exe) = std::env::current_exe() {
        let path = exe.to_string_lossy().to_lowercase();
        return path.contains("\\windowsapps\\");
    }
    false
}
/// Stores the current shortcut string (for rollback on change_hotkey failure).
pub struct CurrentShortcutStr(pub parking_lot::Mutex<String>);

/// Window positioning mode, set by the frontend via `set_window_mode` IPC.
#[derive(Clone, Copy, PartialEq)]
pub enum WindowMode {
    Normal,
    Pinned,
    FollowCursor,
}

pub struct CurrentWindowMode(pub parking_lot::Mutex<WindowMode>);

/// Window position on the monitor, set by the frontend via `set_window_position` IPC.
#[derive(Clone, Debug, PartialEq)]
pub enum WindowPosition {
    Center,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

pub struct CurrentWindowPosition(pub parking_lot::Mutex<WindowPosition>);

/// Original application and any transient classic Edit used for paste safety.
pub(crate) struct PreviousForegroundWindow(pub parking_lot::Mutex<window::PasteTarget>);

impl PreviousForegroundWindow {
    pub fn clear(&self) {
        *self.0.lock() = window::PasteTarget::default();
    }
}

/// Whether the Beetroot window is currently visible (set on show/hide).
pub static WINDOW_VISIBLE: AtomicBool = AtomicBool::new(false);

/// Whether no-focus mode is active (visible but not activated).
/// When true, the keyboard hook intercepts navigation keys.
pub static NO_FOCUS_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Monotonic counter incremented on each no-focus show. Used by the 30s safety
/// timeout to avoid unlocking LSFW_LOCK from a stale thread.
pub static NOFOCUS_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Monotonic counter for overlay hide timer — prevents stale threads from
/// hiding a freshly-shown overlay during rapid copies.
pub static OVERLAY_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Show a native error dialog on Windows, eprintln on other platforms.
#[cfg(target_os = "windows")]
fn show_fatal_error(msg: &str) {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::*;
    let wide: Vec<u16> = msg.encode_utf16().chain(std::iter::once(0)).collect();
    let title: Vec<u16> = "Beetroot"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    // SAFETY: `wide` and `title` are NUL-terminated UTF-16 buffers that
    // outlive the call; HWND::default() is the null handle (valid for
    // top-level MessageBox with no parent).
    unsafe {
        MessageBoxW(
            HWND::default(),
            PCWSTR(wide.as_ptr()),
            PCWSTR(title.as_ptr()),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn show_fatal_error(msg: &str) {
    eprintln!("FATAL: {}", msg);
}

/// Open a rusqlite connection with retry for transient locks (AV scan, etc.).
/// Retries 3 times with 2-second delay. Calls `fatal()` if all attempts fail.
fn open_db_with_retry(db_path: &std::path::Path, context: &str) -> rusqlite::Connection {
    let mut last_err = String::new();
    for attempt in 1..=3 {
        match rusqlite::Connection::open(db_path) {
            Ok(c) => return c,
            Err(e) => {
                last_err = e.to_string();
                if attempt < 3 {
                    warn!(attempt, error = %e, "{context}, retrying in 2s");
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            }
        }
    }
    fatal(&format!(
        "Failed to open database after 3 attempts ({}): {}",
        context, last_err
    ))
}

/// Log an error, show a native dialog, and exit the process.
fn fatal(msg: &str) -> ! {
    error!("{}", msg);
    show_fatal_error(msg);
    std::process::exit(1);
}

/// Set safe PRAGMAs on a connection; the startup caller decides on recovery.
/// Uses `synchronous=FULL` when WAL mode is unavailable (e.g. network/FAT32 drive).
fn configure_pragmas(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    let mode: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))?;
    if mode != "wal" {
        warn!(mode = %mode, "WAL not available, using synchronous=FULL for safety");
        conn.execute_batch("PRAGMA synchronous=FULL;")?;
    } else {
        conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    }
    Ok(())
}

fn prepare_database(
    conn: rusqlite::Connection,
    db_path: &std::path::Path,
    force_recovery: bool,
) -> Result<rusqlite::Connection, error::AppError> {
    let needs_recovery = if force_recovery {
        true
    } else {
        let check = configure_pragmas(&conn).and_then(|()| {
            if backup::is_first_launch_of_version(db_path) {
                backup::full_integrity_check(&conn)
            } else {
                backup::integrity_ok(&conn)
            }
        });
        match check {
            Ok(healthy) => !healthy,
            Err(rusqlite::Error::SqliteFailure(e, _))
                if matches!(e.extended_code & 0xFF, 11 | 26) =>
            {
                true
            }
            Err(e) => return Err(e.into()),
        }
    };
    if needs_recovery {
        drop(conn);
        backup::recovery_flow(db_path)?;
        let recovered = rusqlite::Connection::open(db_path)?;
        configure_pragmas(&recovered)?;
        backup::clear_force_recovery(db_path);
        Ok(recovered)
    } else {
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE)");
        backup::backup_rotate(db_path, &conn);
        Ok(conn)
    }
}

/// Returns the default data directory for the app.
/// On Windows, prefers `%APPDATA%/<build identifier>`.
/// Falls back to `dirs_next::data_dir()` or `temp_dir()`.
pub fn default_data_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        match std::env::var("APPDATA") {
            Ok(appdata) => PathBuf::from(appdata).join(build_profile::identifier()),
            Err(_) => dirs_next::data_dir()
                .unwrap_or_else(std::env::temp_dir)
                .join(build_profile::identifier()),
        }
    } else {
        dirs_next::data_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join(build_profile::identifier())
    }
}

/// Cache our own app icon so it appears in the Apps dropdown (Windows only).
#[cfg(target_os = "windows")]
fn seed_own_app_icon(conn: &rusqlite::Connection) {
    if let Ok(our_exe) = std::env::current_exe() {
        let exe_str = our_exe.to_string_lossy().to_string();
        let exe_file = our_exe
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        let display = commands::get_file_description_pub(&exe_str).unwrap_or_else(|| {
            exe_file
                .strip_suffix(".exe")
                .unwrap_or(&exe_file)
                .to_string()
        });
        let has_icon: bool = conn
            .prepare(
                "SELECT COUNT(*) FROM app_icons WHERE exe_name = ?1 AND icon_base64 IS NOT NULL",
            )
            .and_then(|mut s| s.query_row([&display], |r| r.get::<_, i64>(0)))
            .unwrap_or(0)
            > 0;
        if !has_icon {
            let (_, icon) = commands::extract_app_icon_pub(&exe_file, Some(&exe_str));
            if icon.is_some() {
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO app_icons (exe_name, display_name, icon_base64, exe_path, updated_at) VALUES (?1, ?1, ?2, ?3, datetime('now'))",
                    rusqlite::params![display, icon, exe_str],
                );
            }
        }
    }
}

fn resolve_data_dir() -> PathBuf {
    let default = default_data_dir();
    if let Err(e) = fs::create_dir_all(&default) {
        warn!(path = ?default, error = %e, "failed to create data dir");
    }
    let config = default.join("data_path.txt");
    if config.exists() {
        if let Ok(p) = fs::read_to_string(&config) {
            let trimmed = p.strip_prefix('\u{FEFF}').unwrap_or(&p).trim();
            if validation::is_safe_data_path(trimmed) {
                let custom = PathBuf::from(trimmed);
                if custom.is_dir() {
                    return custom;
                }
                // Keep data_path.txt — drive may be temporarily ejected
                warn!(
                    path = trimmed,
                    "custom data directory not found, falling back to default (keeping pointer)"
                );
            } else {
                warn!(path = trimmed, "ignoring unsafe custom data path");
                if let Err(e) = fs::remove_file(&config) {
                    warn!(error = %e, "failed to remove invalid data_path.txt");
                }
            }
        }
    }
    default
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if std::env::args().any(|arg| arg == "--print-build-profile") {
        println!(
            "{}",
            serde_json::json!({
                "smoke": build_profile::BuildProfile::current() == build_profile::BuildProfile::Smoke,
                "identifier": build_profile::identifier(),
                "dataDirectory": default_data_dir(),
            })
        );
        return;
    }
    let mut context = tauri::generate_context!();
    build_profile::configure(&mut context);
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        "beetroot=info"
            .parse()
            .expect("hard-coded filter string is always valid")
    });
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    let store_build = is_store_package();
    if store_build {
        info!("running as MSIX/Store package — updater disabled");
    }

    let mut builder = tauri::Builder::default()
        .manage(commands::PlainTextShortcut(parking_lot::Mutex::new(
            String::new(),
        )))
        .manage(CurrentWindowMode(parking_lot::Mutex::new(
            WindowMode::Normal,
        )))
        .manage(CurrentWindowPosition(parking_lot::Mutex::new(
            WindowPosition::Center,
        )))
        .manage(PreviousForegroundWindow(parking_lot::Mutex::new(
            window::PasteTarget::default(),
        )))
        .manage(jobs::JobManager::new())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, show with focus (intentional user action)
            if let Some(target) = app.try_state::<PreviousForegroundWindow>() {
                target.clear();
            }
            if let Some(w) = app.get_webview_window("main") {
                window::show_on_active_monitor(&w, true); // force focus
            }
        }))
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());

    // Isolated builds must not update the installed app or rewrite its startup entry.
    if !build_profile::isolated() {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }
    if !store_build && !build_profile::isolated() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder.setup(|app| {
            // Plugins initialize first: a second instance must exit before touching the profile.
            let data_dir = resolve_data_dir();
            info!(path = %data_dir.display(), "resolved data directory");
            let db_path = data_dir.join("clipboard.db");

            // A damaged header may prevent opening the DB, so check the marker first.
            let force_recovery = backup::check_force_recovery(&db_path);
            let conn = open_db_with_retry(&db_path, "startup");
            let mut conn = prepare_database(conn, &db_path, force_recovery)
                .unwrap_or_else(|e| fatal(&format!("Database startup failed: {e}")));

            backup::backup_before_migration(&db_path, &conn);
            if let Err(e) = migrations::run_migrations(&mut conn) {
                fatal(&format!("Database migrations failed: {e}"));
            }
            info!("database migrations complete");
            #[cfg(target_os = "windows")]
            seed_own_app_icon(&conn);

            commands::cleanup_broken_image_records(&conn);
            commands::reconcile_orphaned_images(&conn, &data_dir);
            app.manage(DataDir(data_dir));
            app.manage(DbPool(parking_lot::Mutex::new(conn)));

            // Build tray icon
            tray::create_tray(app)?;

            // Pre-warm key label cache for all installed keyboard layouts
            // so that runtime layout switching shows correct symbols instantly.
            hotkey::warm_label_cache();

            // Create layout-aware HotkeyManager (spawns background thread)
            let manager = hotkey::HotkeyManager::new(app.handle().clone());

            // Register default hotkey: Ctrl+Backquote
            app.manage(commands::initialize_main_shortcut(&manager));

            // Install WM_INPUTLANGCHANGE subclass for instant layout detection
            // when Beetroot is the focused window (complements the 250ms timer
            // fallback that handles external-window layout changes).
            #[cfg(target_os = "windows")]
            {
                use raw_window_handle::{HasWindowHandle, RawWindowHandle};
                if let Some(ref main_window) = app.get_webview_window("main") {
                    if let Ok(handle) = main_window.window_handle() {
                        if let RawWindowHandle::Win32(h) = handle.as_raw() {
                            let hwnd = windows::Win32::Foundation::HWND(h.hwnd.get() as *mut _);
                            hotkey::install_layout_subclass(hwnd, manager.thread_id());
                        }
                    }
                }
            }

            // Tell the keyboard hook which thread to post nav key events to
            keyboard_hook::set_hotkey_thread_id(manager.thread_id());
            app.manage(manager);

            // Install keyboard hook for no-focus navigation
            keyboard_hook::install();

            // Start background job worker
            jobs::start_worker(app.handle().clone());

            // Run periodic DB backups off the main thread
            backup::start_backup_thread(app.handle().clone());

            // Keep app running when window is closed
            if let Some(main_window) = app.get_webview_window("main") {
                let close_window = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        window::close_to_tray(|| api.prevent_close(), || window::hide_and_clear_state(&close_window));
                    }
                });
            } else {
                warn!("main window not found during setup");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::paste_selected_item,
            commands::change_hotkey,
            commands::replace_hotkey,
            commands::register_plain_text_hotkey,
            commands::unregister_plain_text_hotkey,
            commands::retry_no_focus_navigation,
            commands::delete_image,
            commands::read_clipboard_image_file,
            commands::read_image_base64,
            commands::read_image_thumbnail,
            commands::show_in_explorer,
            commands::pick_folder,
            commands::get_data_path,
            commands::check_data_path_drive,
            commands::check_cloud_sync,
            commands::change_data_path,
            commands::switch_data_path,
            commands::ocr_image,
            commands::get_clipboard_formats,
            commands::get_clipboard_sequence,
            commands::get_key_labels,
            commands::set_window_mode,
            commands::set_window_position,
            commands::check_recovery_notice,
            commands::get_os_build,
            // Window management
            commands::activate_window,
            commands::hide_window,
            commands::show_copy_overlay,
            commands::is_store_build,
            commands::is_isolated_build,
            #[cfg(target_os = "windows")]
            commands::autostart_enable,
            #[cfg(target_os = "windows")]
            commands::autostart_disable,
            #[cfg(target_os = "windows")]
            commands::autostart_is_enabled,
            // Search
            commands::search_items,
            // Database commands
            commands::db_get_item,
            commands::db_restore_item,
            commands::db_save_image_item,
            commands::db_get_all_items,
            commands::db_upsert_item,
            commands::db_delete_item,
            commands::db_batch_delete_items,
            commands::db_toggle_star,
            commands::db_touch_item,
            commands::db_update_note,
            commands::db_clear_unstarred,
            commands::db_delete_older_than,
            commands::db_prune_old_items,
            commands::db_get_stats,
            commands::get_clipboard_source,
            commands::get_app_icon,
            commands::get_all_app_icons,
            commands::test_local_endpoint,
            commands::list_local_models,
            commands::submit_job,
            commands::save_api_key,
            commands::delete_api_key,
            commands::get_api_key_status,
            commands::validate_api_key,
            commands::cancel_job,
        ])
        .build(context)
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { code, api, .. } => {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
            tauri::RunEvent::Exit => {
                keyboard_hook::shutdown();
                if let Some(m) = app_handle.try_state::<jobs::JobManager>() {
                    m.stop();
                }
                if let Some(pool) = app_handle.try_state::<DbPool>() {
                    {
                        let conn = pool.0.lock();
                        if let Err(e) =
                            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
                        {
                            error!(error = %e, "shutdown checkpoint failed — WAL may not be flushed");
                        }
                    }
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod startup_recovery_tests {
    use super::*;

    #[test]
    fn damaged_header_recovers_with_or_without_backup_and_preserves_original() {
        for has_backup in [true, false] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("clipboard.db");
            if has_backup {
                let backup =
                    rusqlite::Connection::open(dir.path().join("clipboard.db.backup")).unwrap();
                backup
                    .execute_batch(
                        "CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ('kept');",
                    )
                    .unwrap();
            }
            let damaged = vec![0xA5; 4096];
            fs::write(&path, &damaged).unwrap();
            let conn =
                prepare_database(rusqlite::Connection::open(&path).unwrap(), &path, false).unwrap();
            assert!(backup::full_integrity_check(&conn).unwrap());
            if has_backup {
                assert_eq!(
                    conn.query_row("SELECT value FROM sentinel", [], |r| r.get::<_, String>(0))
                        .unwrap(),
                    "kept"
                );
            } else {
                assert_eq!(
                    conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r
                        .get::<_, i64>(0))
                        .unwrap(),
                    0
                );
            }
            let preserved = fs::read_dir(dir.path())
                .unwrap()
                .map(Result::unwrap)
                .find(|e| {
                    e.file_name()
                        .to_string_lossy()
                        .starts_with("clipboard.db.corrupt.")
                })
                .unwrap();
            assert_eq!(fs::read(preserved.path()).unwrap(), damaged);
            assert!(dir.path().join("RECOVERY_NOTICE.txt").exists());
        }
    }

    #[test]
    fn read_only_setup_error_does_not_recover_or_replace_database() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("clipboard.db");
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ('kept');",
        )
        .unwrap();
        drop(conn);
        let before = fs::read(&path).unwrap();
        let read_only = rusqlite::Connection::open_with_flags(
            &path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .unwrap();
        assert!(prepare_database(read_only, &path, false).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn recovery_aborts_when_original_cannot_be_preserved() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("clipboard.db");
        fs::write(&path, b"damaged but irreplaceable").unwrap();
        let _deny_delete = fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .open(&path)
            .unwrap();
        assert!(backup::recovery_flow(&path).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"damaged but irreplaceable");
        assert!(!dir.path().join("RECOVERY_NOTICE.txt").exists());
    }
}
