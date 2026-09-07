//! Move/Switch data directory with copy + rollback; drive and cloud-sync checks.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tracing::{info, warn};

use crate::backup;
use crate::error::AppError;
use crate::validation;
use crate::DataDir;
use crate::DbPool;

/// Reject paths that would cause recursive self-copy: new path inside current,
/// or current inside new (the inverse — would also confuse copy semantics).
/// Both paths must be canonicalized by the caller.
pub fn check_data_path_relationship(current: &Path, new: &Path) -> Result<(), String> {
    if new.starts_with(current) || current.starts_with(new) {
        return Err(
            "New path must not be inside the current data directory or contain it".to_string(),
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn pick_folder(window: tauri::Window) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .pick_folder(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });
    let result = rx
        .recv()
        .map_err(|e| AppError::Other(format!("dialog channel error: {e}")))?;
    Ok(result)
}

#[tauri::command]
pub async fn get_data_path(app: tauri::AppHandle) -> Result<String, AppError> {
    let data_dir = app.state::<DataDir>();
    Ok(data_dir.0.to_string_lossy().to_string())
}

fn get_default_data_dir() -> PathBuf {
    crate::default_data_dir()
}

fn copy_dir_contents(src: &Path, dst: &Path) -> Result<(), AppError> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_contents(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Check if a path is on a removable or network drive. Returns drive kind or null.
#[tauri::command]
pub fn check_data_path_drive(path: String) -> Result<Option<String>, AppError> {
    let dir = validation::validate_data_path(&path).map_err(AppError::Validation)?;
    Ok(backup::check_drive_type(&dir).map(|s| s.to_string()))
}

/// Check if a path is inside a cloud sync folder. Returns service name or null.
#[tauri::command]
pub fn check_cloud_sync(path: String) -> Option<String> {
    validation::detect_cloud_sync(&path).map(|s| s.to_string())
}

#[tauri::command]
#[allow(unreachable_code)]
pub async fn change_data_path(app: tauri::AppHandle, new_path: String) -> Result<(), AppError> {
    info!(new_path = %new_path, "changing data path");
    let new_dir = validation::validate_data_path(&new_path).map_err(AppError::Validation)?;
    fs::create_dir_all(&new_dir)?;

    let current_dir = app.state::<DataDir>().0.clone();

    // Don't copy to the same directory
    if new_dir.canonicalize().ok() == current_dir.canonicalize().ok() {
        return Err(AppError::Validation(
            "New path is the same as current path".to_string(),
        ));
    }

    // Reject parent/child relationships — recursive copy of a dir into a
    // subdirectory of itself (or vice-versa) would loop or duplicate.
    let current_canon = current_dir
        .canonicalize()
        .map_err(|e| AppError::Validation(format!("Cannot canonicalize current data dir: {e}")))?;
    let new_canon = new_dir
        .canonicalize()
        .map_err(|e| AppError::Validation(format!("Cannot canonicalize new data dir: {e}")))?;
    check_data_path_relationship(&current_canon, &new_canon).map_err(AppError::Validation)?;

    // Block network drives — SQLite requires local filesystem locking
    if let Some(drive_kind) = backup::check_drive_type(&new_dir) {
        if drive_kind == "network" {
            return Err(AppError::Validation(
                "Network drives are not supported. SQLite requires local filesystem locking."
                    .to_string(),
            ));
        }
        warn!(kind = drive_kind, path = %new_path, "target path is on a {} drive", drive_kind);
    }

    // Flush WAL + copy under single lock to prevent writes between checkpoint and copy
    {
        let pool = app.state::<DbPool>();
        let conn = pool.0.lock();
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
            .map_err(AppError::Database)?;

        // Copy while lock held — prevents writes between checkpoint and copy
        if let Err(e) = copy_data_to_new_dir(&current_dir, &new_dir) {
            drop(conn);
            return Err(AppError::Other(format!(
                "Migration failed (rolled back): {}",
                e
            )));
        }
    }
    // Lock released — proceed to write data_path.txt (no DB writes needed)

    // Write data_path.txt in default app data dir
    let default_dir = get_default_data_dir();
    if let Err(e) = fs::create_dir_all(&default_dir)
        .and_then(|_| fs::write(default_dir.join("data_path.txt"), &new_path))
    {
        // Rollback: remove copied data since we can't persist the new path
        rollback_copy(&new_dir);
        return Err(AppError::Other(format!(
            "Failed to write data_path.txt (rolled back): {}",
            e
        )));
    }

    info!("data migration complete, restarting app");
    app.restart();
    Ok(())
}

#[tauri::command]
#[allow(unreachable_code)]
pub async fn switch_data_path(app: tauri::AppHandle, new_path: String) -> Result<(), AppError> {
    info!(new_path = %new_path, "switching data path (no copy)");
    let new_dir = validation::validate_data_path(&new_path).map_err(AppError::Validation)?;
    fs::create_dir_all(&new_dir)?;

    let current_dir = app.state::<DataDir>().0.clone();
    if new_dir.canonicalize().ok() == current_dir.canonicalize().ok() {
        return Err(AppError::Validation(
            "New path is the same as current path".to_string(),
        ));
    }

    // Block network drives — SQLite requires local filesystem locking
    if let Some(drive_kind) = backup::check_drive_type(&new_dir) {
        if drive_kind == "network" {
            return Err(AppError::Validation(
                "Network drives are not supported. SQLite requires local filesystem locking."
                    .to_string(),
            ));
        }
        warn!(kind = drive_kind, path = %new_path, "target path is on a {} drive", drive_kind);
    }

    // Flush WAL before restart to prevent data loss
    super::with_db(&app, |conn| {
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")?;
        Ok(())
    })?;

    let default_dir = get_default_data_dir();
    fs::create_dir_all(&default_dir)?;
    fs::write(default_dir.join("data_path.txt"), &new_path)?;

    info!("data path switched, restarting app");
    app.restart();
    Ok(())
}

/// Copy database and images from current dir to new dir
fn copy_data_to_new_dir(current_dir: &Path, new_dir: &Path) -> Result<(), AppError> {
    if fs::read_dir(new_dir)?.next().transpose()?.is_some() {
        return Err(AppError::Validation(
            "Move requires an empty destination. Use Switch to open existing data.".to_string(),
        ));
    }
    // Reserve the database name without ever replacing an existing profile.
    let destination = new_dir.join("clipboard.db");
    fs::File::options()
        .write(true)
        .create_new(true)
        .open(&destination)?;
    let result = (|| {
        let source = rusqlite::Connection::open_with_flags(
            current_dir.join("clipboard.db"),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;
        let mut copied = rusqlite::Connection::open(&destination)?;
        // SQLite backup includes committed WAL records even if checkpoint was busy.
        rusqlite::backup::Backup::new(&source, &mut copied)?.run_to_completion(
            100,
            std::time::Duration::from_millis(10),
            None,
        )?;
        let src_images = current_dir.join("images");
        let dst_images = new_dir.join("images");
        fs::create_dir_all(&dst_images)?;
        if src_images.is_dir() {
            copy_dir_contents(&src_images, &dst_images)?;
        }
        let tx = copied.transaction()?;
        let paths: Vec<(i64, String)> = {
            let mut stmt = tx.prepare(
                "SELECT id, image_path FROM clipboard_items WHERE image_path IS NOT NULL",
            )?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
            rows.collect::<Result<_, _>>()?
        };
        for (id, path) in paths {
            fs::metadata(&path).map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    AppError::Validation(
                        "An image referenced by history is missing. Exit Beetroot from the tray, \
                         reopen it, and retry Move. No data was moved."
                            .to_string(),
                    )
                } else {
                    AppError::Io(e)
                }
            })?;
            let validated =
                validation::validate_image_path(&src_images, &path).map_err(AppError::Security)?;
            let root = src_images.canonicalize()?;
            let relative = validated
                .strip_prefix(&root)
                .map_err(|e| AppError::Validation(e.to_string()))?;
            let new_path = dst_images.join(relative);
            validation::validate_image_path(&dst_images, &new_path.to_string_lossy())
                .map_err(AppError::Security)?;
            tx.execute(
                "UPDATE clipboard_items SET image_path = ?1 WHERE id = ?2",
                rusqlite::params![new_path.to_string_lossy(), id],
            )?;
        }
        tx.commit()?;
        if !backup::full_integrity_check(&copied)? {
            return Err(AppError::Validation(
                "Copied database failed integrity check".to_string(),
            ));
        }
        copied.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")?;
        Ok(())
    })();
    if result.is_err() {
        rollback_copy(new_dir);
    }
    result
}

/// Only called after this Move reserved an empty destination.
fn rollback_copy(new_dir: &Path) {
    for name in [
        "clipboard.db",
        "clipboard.db-wal",
        "clipboard.db-shm",
        "clipboard.db-journal",
    ] {
        if let Err(e) = fs::remove_file(new_dir.join(name)) {
            if e.kind() == std::io::ErrorKind::NotFound {
                continue;
            }
            warn!(error = %e, "rollback: failed to remove copied db");
        }
    }
    if new_dir.join("images").exists() {
        if let Err(e) = fs::remove_dir_all(new_dir.join("images")) {
            warn!(error = %e, "rollback: failed to remove copied images");
        }
    }
}

#[cfg(test)]
mod move_tests {
    use super::*;

    fn profile(dir: &Path, text: &str) -> rusqlite::Connection {
        let mut conn = rusqlite::Connection::open(dir.join("clipboard.db")).unwrap();
        crate::migrations::run_migrations(&mut conn).unwrap();
        super::super::db::upsert_item_core(&conn, text, text, None, None, None).unwrap();
        conn
    }

    #[test]
    fn move_rewrites_root_and_month_paths_before_reconciliation() {
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let conn = profile(source.path(), "source");
        for relative in ["legacy.png", "2026-01/month.png"] {
            let path = source.path().join("images").join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, b"synthetic image").unwrap();
            super::super::db::upsert_image_item_core(
                &conn,
                relative,
                path.to_str().unwrap(),
                None,
                None,
            )
            .unwrap();
        }
        drop(conn);
        copy_data_to_new_dir(source.path(), target.path()).unwrap();
        let conn = rusqlite::Connection::open(target.path().join("clipboard.db")).unwrap();
        let mut stmt = conn
            .prepare("SELECT image_path FROM clipboard_items WHERE image_path IS NOT NULL")
            .unwrap();
        let paths: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect();
        for path in &paths {
            let validated =
                validation::validate_image_path(&target.path().join("images"), path).unwrap();
            assert_eq!(fs::read(&validated).unwrap(), b"synthetic image");
            fs::File::options()
                .write(true)
                .open(validated)
                .unwrap()
                .set_times(fs::FileTimes::new().set_modified(
                    std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000),
                ))
                .unwrap();
        }
        super::super::db::reconcile_orphaned_images(&conn, target.path());
        for path in paths {
            assert!(Path::new(&path).exists());
        }
        assert!(source.path().join("images/legacy.png").exists());
        assert!(source.path().join("images/2026-01/month.png").exists());
    }

    #[test]
    fn move_rejects_existing_destination_without_writes() {
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        drop(profile(source.path(), "source"));
        drop(profile(target.path(), "destination-sentinel"));
        let before = fs::read(target.path().join("clipboard.db")).unwrap();
        assert!(copy_data_to_new_dir(source.path(), target.path()).is_err());
        assert_eq!(
            fs::read(target.path().join("clipboard.db")).unwrap(),
            before
        );
        assert_eq!(fs::read_dir(target.path()).unwrap().count(), 1);
    }

    #[test]
    fn move_rolls_back_copied_data_when_an_image_reference_is_missing() {
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let conn = profile(source.path(), "source");
        super::super::db::upsert_image_item_core(
            &conn,
            "missing-image-hash",
            source.path().join("images/missing.png").to_str().unwrap(),
            None,
            None,
        )
        .unwrap();
        drop(conn);
        let error = copy_data_to_new_dir(source.path(), target.path()).unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));
        assert!(error
            .to_string()
            .contains("image referenced by history is missing"));
        assert!(error.to_string().contains("Exit Beetroot from the tray"));
        assert_eq!(fs::read_dir(target.path()).unwrap().count(), 0);
        assert!(source.path().join("clipboard.db").exists());
        let conn = rusqlite::Connection::open(source.path().join("clipboard.db")).unwrap();
        let original: String = conn
            .query_row(
                "SELECT image_path FROM clipboard_items WHERE content_hash = 'missing-image-hash'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            std::path::Path::new(&original),
            source.path().join("images/missing.png")
        );
    }

    #[test]
    fn move_rejects_destination_sidecars_and_image_data() {
        for name in ["clipboard.db-wal", "clipboard.db.backup", "images"] {
            let source = tempfile::tempdir().unwrap();
            let target = tempfile::tempdir().unwrap();
            drop(profile(source.path(), "source"));
            fs::write(target.path().join(name), b"destination-sentinel").unwrap();
            assert!(copy_data_to_new_dir(source.path(), target.path()).is_err());
            assert_eq!(
                fs::read(target.path().join(name)).unwrap(),
                b"destination-sentinel"
            );
            assert!(!target.path().join("clipboard.db").exists());
        }
    }

    #[test]
    fn move_includes_committed_wal_rows() {
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let conn = profile(source.path(), "before-wal");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;")
            .unwrap();
        super::super::db::upsert_item_core(&conn, "wal-sentinel", "wal-sentinel", None, None, None)
            .unwrap();
        assert!(source.path().join("clipboard.db-wal").exists());
        copy_data_to_new_dir(source.path(), target.path()).unwrap();
        let copied = rusqlite::Connection::open(target.path().join("clipboard.db")).unwrap();
        assert_eq!(
            copied
                .query_row(
                    "SELECT count(*) FROM clipboard_items WHERE content='wal-sentinel'",
                    [],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            1
        );
    }

    #[cfg(windows)]
    #[test]
    fn move_rolls_back_on_file_copy_failure() {
        use std::os::windows::fs::OpenOptionsExt;
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        drop(profile(source.path(), "source"));
        fs::create_dir_all(source.path().join("images")).unwrap();
        let path = source.path().join("images/locked.png");
        fs::write(&path, b"source image").unwrap();
        let locked = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .unwrap();
        assert!(copy_data_to_new_dir(source.path(), target.path()).is_err());
        assert_eq!(fs::read_dir(target.path()).unwrap().count(), 0);
        drop(locked);
        assert_eq!(fs::read(path).unwrap(), b"source image");
    }
}
