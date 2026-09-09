//! IPC command surface. Domain logic lives in submodules; this root holds the
//! shared DB access helpers (with_db/with_db_async), corruption detection, and
//! image-path validation used across domains. Register new commands in their
//! domain submodule AND in lib.rs invoke_handler!.

use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use tracing::error;

use crate::error::AppError;
use crate::validation;
use crate::DbPool;

use crate::backup;
use crate::DataDir;

fn validate_image_path(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, AppError> {
    let images_dir = get_images_dir(app)?;
    validation::validate_image_path(&images_dir, path).map_err(AppError::Security)
}

fn get_images_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app.state::<DataDir>();
    let images_dir = data_dir.0.join("images");
    fs::create_dir_all(&images_dir)?;
    Ok(images_dir)
}

/// Check if an error indicates database corruption and write a force-recovery marker.
/// Matches SQLITE_CORRUPT (11) and SQLITE_NOTADB (26) error codes, with string
/// fallback for edge cases where rusqlite wraps errors differently.
fn check_corruption(app: &tauri::AppHandle, err: &AppError) {
    let is_corrupt = match err {
        AppError::Database(rusqlite::Error::SqliteFailure(e, _)) => {
            let primary = e.extended_code & 0xFF;
            primary == 11 || primary == 26 // SQLITE_CORRUPT || SQLITE_NOTADB
        }
        _ => {
            let msg = err.to_string();
            msg.contains("disk image is malformed")
        }
    };
    if is_corrupt {
        error!("runtime corruption detected: {err}");
        let data_dir = app.state::<DataDir>();
        let db_path = data_dir.0.join("clipboard.db");
        backup::write_force_recovery_marker(&db_path);
        // Notify frontend so it can prompt user to restart
        let _ = app.emit("db-corruption-detected", ());
    }
}

fn with_db<F, T>(app: &tauri::AppHandle, f: F) -> Result<T, AppError>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, AppError>,
{
    let pool = app.state::<DbPool>();
    let conn = pool.0.lock();
    let result = f(&conn);
    if let Err(ref e) = result {
        check_corruption(app, e);
    }
    result
}

/// Run a read closure on the blocking pool — keeps SQLite work off the
/// Tauri main thread. Lock is acquired inside the pool thread.
pub(crate) async fn with_db_async<T, F>(app: tauri::AppHandle, f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&rusqlite::Connection) -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || with_db(&app, f))
        .await
        .map_err(|e| AppError::Other(format!("DB task failed to join: {e}")))?
}

mod db;
pub use db::*;

mod ai_cmds;
pub use ai_cmds::*;

mod autostart;
pub use autostart::*;

mod data_path;
pub use data_path::*;

mod hotkey_cmds;
pub use hotkey_cmds::*;

mod images;
pub use images::*;

mod paste;
pub use paste::*;

mod source_app;
pub use source_app::*;

mod window_cmds;
pub use window_cmds::*;
