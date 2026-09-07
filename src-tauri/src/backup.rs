//! Backup, integrity and recovery protocol for clipboard.db: timestamped
//! rotating backups every N writes (executed on the db-backup thread),
//! pre-migration snapshots, FORCE_RECOVERY marker handling, and the startup
//! recovery flow. See recovery_flow() for the restore order.

use std::fs;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use tauri::Manager;
use tracing::{error, info, warn};

use crate::error::AppError;
use crate::DbPool;

/// Number of upserts since the last runtime backup.
pub static WRITES_SINCE_BACKUP: AtomicU32 = AtomicU32::new(0);

/// How many upserts between runtime backups.
const BACKUP_INTERVAL: u32 = 100;

/// Channel to the background backup thread. Signals trigger a backup.
static BACKUP_TX: OnceLock<std::sync::mpsc::Sender<()>> = OnceLock::new();

/// Spawn the backup worker. Coalesces signals: multiple sends while a backup
/// runs result in at most one extra backup.
pub fn start_backup_thread(app: tauri::AppHandle) {
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    if BACKUP_TX.set(tx).is_err() {
        return; // already started
    }
    if let Err(e) = std::thread::Builder::new()
        .name("db-backup".into())
        .spawn(move || {
            while rx.recv().is_ok() {
                while rx.try_recv().is_ok() {} // drain queued signals — coalesce
                let db_path = app.state::<crate::DataDir>().0.join("clipboard.db");
                let result = catch_unwind(AssertUnwindSafe(|| backup_db(&app, &db_path)));
                if let Err(e) = result {
                    let msg = if let Some(s) = e.downcast_ref::<&str>() {
                        s.to_string()
                    } else if let Some(s) = e.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "unknown panic".to_string()
                    };
                    warn!("backup thread panic recovered: {msg}");
                }
            }
        })
    {
        tracing::warn!(error = %e, "failed to spawn backup thread — runtime backups disabled");
    }
}

/// How many timestamped backups to keep.
const MAX_TIMESTAMPED_BACKUPS: usize = 3;

/// How many `.pre-v*` version snapshots to keep.
const MAX_VERSION_SNAPSHOTS: usize = 3;

/// Run `PRAGMA quick_check(1)` and return whether the database is healthy.
///
/// Uses `quick_check` (structure only) instead of `integrity_check` (full scan)
/// for faster startup. Same return format ("ok" or error string).
///
/// - `Ok(true)`  → healthy
/// - `Ok(false)` → genuinely corrupt
/// - `Err(e)`    -> caller distinguishes SQLite corruption codes from access/IO errors
pub fn integrity_ok(conn: &rusqlite::Connection) -> Result<bool, rusqlite::Error> {
    let result = conn.query_row("PRAGMA quick_check(1)", [], |r| r.get::<_, String>(0))?;
    Ok(result == "ok")
}

/// Run full `PRAGMA integrity_check(1)` — catches data page corruption that
/// `quick_check` misses. Used on first launch of a new version.
pub fn full_integrity_check(conn: &rusqlite::Connection) -> Result<bool, rusqlite::Error> {
    let result = conn.query_row("PRAGMA integrity_check(1)", [], |r| r.get::<_, String>(0))?;
    Ok(result == "ok")
}

/// Check if this is the first launch of a new app version (no pre-v snapshot yet).
pub fn is_first_launch_of_version(db_path: &Path) -> bool {
    let version = env!("CARGO_PKG_VERSION");
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();
    let snap = db_path.with_file_name(format!("{stem}.pre-v{version}.backup"));
    !snap.exists()
}

/// Create a point-in-time backup using the SQLite Backup API.
///
/// Writes to a `.tmp` sibling first, then atomically renames to `dest`.
/// Returns Ok(()) on success, Err on any failure (tmp is cleaned up).
fn sqlite_backup_to_file(
    conn: &rusqlite::Connection,
    dest: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let tmp = dest.with_extension("tmp");
    // Run backup into tmp file; clean up on any error
    let copy_result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let mut dst = rusqlite::Connection::open(&tmp)?;
        let backup = rusqlite::backup::Backup::new(conn, &mut dst)?;
        backup.run_to_completion(100, Duration::from_millis(10), None)?;
        drop(backup);
        // Checkpoint WAL into main file then switch to DELETE journal mode
        // so no -wal/-shm sidecar files remain after close.
        let _ = dst.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;");
        drop(dst);
        Ok(())
    })();
    if let Err(e) = copy_result {
        let _ = fs::remove_file(&tmp);
        let _ = fs::remove_file(tmp.with_extension("tmp-wal"));
        let _ = fs::remove_file(tmp.with_extension("tmp-shm"));
        return Err(e);
    }
    // Clean up any leftover sidecar files from the tmp
    let _ = fs::remove_file(tmp.with_extension("tmp-wal"));
    let _ = fs::remove_file(tmp.with_extension("tmp-shm"));
    fs::rename(&tmp, dest).inspect_err(|_e| {
        let _ = fs::remove_file(&tmp);
    })?;
    // Clean up sidecar files from the dest (if renamed from WAL-mode tmp)
    let dest_str = dest.to_string_lossy();
    let _ = fs::remove_file(format!("{dest_str}-wal"));
    let _ = fs::remove_file(format!("{dest_str}-shm"));
    Ok(())
}

/// Build a timestamped backup path: `clipboard.2026-03-05T07.00.backup`
fn backup_path_for_now(db_path: &Path) -> PathBuf {
    let ts = chrono::Local::now().format("%Y-%m-%dT%H.%M");
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();
    db_path.with_file_name(format!("{stem}.{ts}.backup"))
}

/// List timestamped backup files sorted newest-first (lexicographic on ISO timestamps).
/// Excludes `.pre-v*` version snapshots.
fn list_timestamped_backups(db_path: &Path) -> Vec<PathBuf> {
    let parent = match db_path.parent() {
        Some(p) => p,
        None => return vec![],
    };
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();

    let mut backups: Vec<PathBuf> = fs::read_dir(parent)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // Match: clipboard.YYYY-MM-DDTHH.MM.backup (not .pre-v*)
            if name.starts_with(&*stem)
                && name.ends_with(".backup")
                && !name.contains(".pre-v")
                && name.len() > stem.len() + ".backup".len() + 1
            {
                // Verify it has a timestamp-like middle segment
                let middle = &name[stem.len() + 1..name.len() - ".backup".len()];
                if middle.len() >= 16 && middle.contains('T') {
                    return Some(e.path());
                }
            }
            None
        })
        .collect();

    // Sort newest-first (reverse lexicographic on ISO timestamp in filename)
    backups.sort_unstable_by(|a, b| b.cmp(a));
    backups
}

/// Delete old timestamped backups, keeping only the latest `MAX_TIMESTAMPED_BACKUPS`.
fn prune_old_backups(db_path: &Path) {
    let backups = list_timestamped_backups(db_path);
    for old in backups.into_iter().skip(MAX_TIMESTAMPED_BACKUPS) {
        if let Err(e) = fs::remove_file(&old) {
            warn!(path = %old.display(), error = %e, "failed to prune old backup");
        } else {
            info!(path = %old.display(), "pruned old backup");
        }
    }
}

/// List `.pre-v*` version snapshot files sorted newest-first (reverse lexicographic).
fn list_version_snapshots(db_path: &Path) -> Vec<PathBuf> {
    let parent = match db_path.parent() {
        Some(p) => p,
        None => return vec![],
    };
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();

    let mut snapshots: Vec<PathBuf> = fs::read_dir(parent)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with(&*stem) && name.contains(".pre-v") && name.ends_with(".backup") {
                Some(e.path())
            } else {
                None
            }
        })
        .collect();

    // Sort newest-first by parsed semver, falling back to reverse lexicographic
    snapshots.sort_unstable_by(|a, b| {
        let ver = |p: &Path| -> Option<(u32, u32, u32)> {
            let name = p.file_name()?.to_string_lossy().to_string();
            let start = name.find(".pre-v")? + 6;
            let end = name.rfind(".backup")?;
            let parts: Vec<&str> = name[start..end].split('.').collect();
            if parts.len() == 3 {
                Some((
                    parts[0].parse().ok()?,
                    parts[1].parse().ok()?,
                    parts[2].parse().ok()?,
                ))
            } else {
                None
            }
        };
        match (ver(a), ver(b)) {
            (Some(va), Some(vb)) => vb.cmp(&va),
            _ => b.cmp(a),
        }
    });
    snapshots
}

/// Delete old version snapshots, keeping only the latest `MAX_VERSION_SNAPSHOTS`.
fn prune_old_version_snapshots(db_path: &Path) {
    let snapshots = list_version_snapshots(db_path);
    for old in snapshots.into_iter().skip(MAX_VERSION_SNAPSHOTS) {
        if let Err(e) = fs::remove_file(&old) {
            warn!(path = %old.display(), error = %e, "failed to prune old version snapshot");
        } else {
            info!(path = %old.display(), "pruned old version snapshot");
        }
    }
}

/// Remove orphaned `-wal`, `-shm` sidecar files next to `.backup` files, and
/// `clipboard.*.tmp` files left by a process kill mid-backup.
/// Cleans up leftovers from pre-fix builds that didn't checkpoint before close.
fn cleanup_backup_sidecars(db_path: &Path) {
    let parent = match db_path.parent() {
        Some(p) => p,
        None => return,
    };
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();
    let tmp_prefix = format!("{stem}.");
    let entries = match fs::read_dir(parent) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".backup-wal")
            || name.ends_with(".backup-shm")
            || (name.starts_with(&*tmp_prefix) && name.ends_with(".tmp"))
        {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Verify a backup file's integrity using `PRAGMA integrity_check(1)`.
/// Returns true if healthy, false if corrupt or unreadable.
fn verify_backup(path: &Path) -> bool {
    let conn = match rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(c) => c,
        Err(_) => return false,
    };
    match conn.query_row("PRAGMA integrity_check(1)", [], |r| r.get::<_, String>(0)) {
        Ok(result) => result == "ok",
        Err(_) => false,
    }
}

/// Rotate backup files using timestamped names and SQLite Backup API.
///
/// Creates `clipboard.YYYY-MM-DDTHH.MM.backup` via atomic tmp+rename.
/// Prunes to keep latest 3 timestamped backups. Verifies backup integrity.
pub fn backup_rotate(db_path: &Path, conn: &rusqlite::Connection) {
    // Guard: don't overwrite valid backups with an empty/fresh database.
    // Scenario: AV quarantines DB → recovery creates fresh DB → backup_rotate
    // would create a backup of the empty DB → prune would delete valid old ones.
    let has_any_backup = !list_timestamped_backups(db_path).is_empty()
        || db_path.with_extension("db.backup").exists();
    if has_any_backup {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap_or(0);
        if count == 0 {
            warn!("skipping backup rotation — database is empty but backup exists");
            return;
        }
    }

    let dest = backup_path_for_now(db_path);

    if let Err(e) = sqlite_backup_to_file(conn, &dest) {
        warn!(error = %e, "backup failed");
        return;
    }

    // Verify the backup we just created
    if !verify_backup(&dest) {
        warn!("backup integrity check failed, removing suspect backup");
        let _ = fs::remove_file(&dest);
        return;
    }

    info!(path = %dest.display(), "database backup created and verified");
    prune_old_backups(db_path);

    // Clean up legacy backup files (from pre-timestamped era)
    let legacy = db_path.with_extension("db.backup");
    let legacy1 = db_path.with_extension("db.backup.1");
    if legacy.exists() {
        let _ = fs::remove_file(&legacy);
    }
    if legacy1.exists() {
        let _ = fs::remove_file(&legacy1);
    }

    // Remove orphaned -wal/-shm sidecar files from older builds
    cleanup_backup_sidecars(db_path);

    // Prune old version snapshots (keep latest 3)
    prune_old_version_snapshots(db_path);
}

/// Flush WAL to main file, then rotate backups. Called from runtime counter.
/// Holds Mutex lock through the entire operation (checkpoint + backup) to
/// prevent new writes between flush and copy.
pub fn backup_db(app: &tauri::AppHandle, db_path: &Path) {
    let pool = app.state::<DbPool>();
    let conn = pool.0.lock();
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE)");
    backup_rotate(db_path, &conn);
    // Counter is reset by maybe_backup's compare_exchange — no store(0) here
    // to avoid losing writes that happen between CAS and backup completion.
}

/// Increment writes counter; trigger backup when threshold reached.
/// Signals the dedicated backup thread when available; falls back to inline
/// execution in unit tests where `start_backup_thread` is not called.
pub fn maybe_backup(app: &tauri::AppHandle, db_path: &Path) {
    let prev = WRITES_SINCE_BACKUP.fetch_add(1, Ordering::Relaxed);
    if prev >= BACKUP_INTERVAL
        && WRITES_SINCE_BACKUP
            .compare_exchange(prev + 1, 0, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
    {
        match BACKUP_TX.get() {
            Some(tx) => {
                if tx.send(()).is_err() {
                    warn!("backup thread unavailable — signal dropped");
                }
            }
            // Thread not started (unit tests) — run inline as before.
            None => backup_db(app, db_path),
        }
    }
}

/// Write a recovery notice file for the frontend to pick up on next startup.
fn write_recovery_notice(db_path: &Path, msg: &str) {
    let notice = db_path
        .parent()
        .unwrap_or(Path::new("."))
        .join("RECOVERY_NOTICE.txt");
    if let Err(e) = fs::write(&notice, msg) {
        warn!(error = %e, "failed to write recovery notice");
    }
}

/// Write a `FORCE_RECOVERY` marker file so the next startup triggers recovery.
/// Called when a runtime DB command encounters "disk image malformed".
pub fn write_force_recovery_marker(db_path: &Path) {
    let marker = db_path
        .parent()
        .unwrap_or(Path::new("."))
        .join("FORCE_RECOVERY");
    if let Err(e) = fs::write(&marker, "corruption detected at runtime") {
        warn!(error = %e, "failed to write FORCE_RECOVERY marker");
    } else {
        error!("FORCE_RECOVERY marker written — recovery will run on next startup");
    }
}

/// Check if a `FORCE_RECOVERY` marker exists.
/// Returns `true` if recovery should be forced.
/// Call `clear_force_recovery()` after successful recovery.
pub fn check_force_recovery(db_path: &Path) -> bool {
    let marker = db_path
        .parent()
        .unwrap_or(Path::new("."))
        .join("FORCE_RECOVERY");
    marker.exists()
}

/// Remove the `FORCE_RECOVERY` marker after successful recovery.
pub fn clear_force_recovery(db_path: &Path) {
    let marker = db_path
        .parent()
        .unwrap_or(Path::new("."))
        .join("FORCE_RECOVERY");
    let _ = fs::remove_file(&marker);
}

/// Attempt to recover from a corrupted database.
///
/// Returns the path of a valid DB file (restored backup or fresh), or Err if
/// recovery failed entirely. Writes `RECOVERY_NOTICE.txt` so the frontend can
/// show a notification on next startup.
pub fn recovery_flow(db_path: &Path) -> Result<PathBuf, AppError> {
    error!("database integrity check failed, starting recovery");

    // Preserve the corrupt file for analysis (timestamped to avoid overwrites)
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S_%f");
    let corrupt = db_path.with_extension(format!("db.corrupt.{}", timestamp));
    fs::rename(db_path, &corrupt)?;

    // Remove stale WAL/SHM/journal sidecar files
    let _ = fs::remove_file(db_path.with_extension("db-wal"));
    let _ = fs::remove_file(db_path.with_extension("db-shm"));
    let _ = fs::remove_file(db_path.with_extension("db-journal"));

    // Try timestamped backups newest-first, then legacy, then pre-version snapshots
    let mut candidates = list_timestamped_backups(db_path);
    // Legacy backup files (from pre-timestamped era)
    let legacy = db_path.with_extension("db.backup");
    let legacy1 = db_path.with_extension("db.backup.1");
    if legacy.exists() {
        candidates.push(legacy);
    }
    if legacy1.exists() {
        candidates.push(legacy1);
    }
    // Version snapshots as last resort (sorted newest-first)
    candidates.extend(list_version_snapshots(db_path));

    for candidate in &candidates {
        if !candidate.exists() {
            continue;
        }
        // Verify the backup is itself healthy
        if let Ok(test_conn) = rusqlite::Connection::open_with_flags(
            candidate,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        ) {
            let ok = full_integrity_check(&test_conn).unwrap_or(false);
            drop(test_conn);
            if ok {
                match fs::copy(candidate, db_path) {
                    Ok(_) => {
                        info!(
                            source = %candidate.display(),
                            "database restored from backup"
                        );
                        write_recovery_notice(
                            db_path,
                            "Database was corrupted and restored from backup.",
                        );
                        return Ok(db_path.to_path_buf());
                    }
                    Err(e) => {
                        warn!(
                            error = %e,
                            path = %candidate.display(),
                            "failed to copy backup, trying next"
                        );
                        continue;
                    }
                }
            }
            warn!(path = %candidate.display(), "backup also corrupted, trying next");
        }
    }

    // No valid backup — create fresh DB (caller will run migrations)
    warn!("no valid backup found, creating fresh database");
    write_recovery_notice(
        db_path,
        "Database was corrupted. No backup found, created fresh database.",
    );
    Ok(db_path.to_path_buf())
}

/// Create a pre-version backup before migrations: `clipboard.pre-v1.2.0.backup`.
/// Idempotent — skips if this version's snapshot already exists.
pub fn backup_before_migration(db_path: &Path, conn: &rusqlite::Connection) {
    // Skip on fresh install — no point snapshotting an empty database
    let has_data: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='clipboard_items')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if !has_data {
        info!("fresh database, skipping pre-migration backup");
        return;
    }

    let version = env!("CARGO_PKG_VERSION");
    let stem = db_path.file_stem().unwrap_or_default().to_string_lossy();
    let snap = db_path.with_file_name(format!("{stem}.pre-v{version}.backup"));

    if snap.exists() {
        return;
    }

    match sqlite_backup_to_file(conn, &snap) {
        Ok(()) => {
            if verify_backup(&snap) {
                info!(path = %snap.display(), "pre-migration backup created and verified");
            } else {
                warn!(path = %snap.display(), "pre-migration backup failed verification, removing");
                let _ = fs::remove_file(&snap);
            }
        }
        Err(e) => warn!(error = %e, "failed to create pre-migration backup"),
    }
}

/// Check if a path is on a removable or network drive (Windows only).
/// Returns a warning string if the drive is potentially unreliable.
#[cfg(target_os = "windows")]
pub fn check_drive_type(path: &Path) -> Option<&'static str> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;

    // Extract drive root (e.g., "C:\")
    let full = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => path.to_path_buf(),
    };
    let root: OsString = full
        .components()
        .next()
        .map(|c| {
            let mut s = c.as_os_str().to_os_string();
            s.push("\\");
            s
        })
        .unwrap_or_else(|| OsString::from("C:\\"));

    let wide: Vec<u16> = root.encode_wide().chain(std::iter::once(0)).collect();
    // SAFETY: `wide` is a NUL-terminated UTF-16 drive-root string (e.g. "C:\\\0")
    // that outlives the call; GetDriveTypeW accepts any string and never
    // dereferences it beyond the NUL terminator.
    let drive_type = unsafe { GetDriveTypeW(windows::core::PCWSTR(wide.as_ptr())) };

    // https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getdrivetypew
    const DRIVE_REMOVABLE_VAL: u32 = 2; // DRIVE_REMOVABLE
    const DRIVE_REMOTE_VAL: u32 = 4; // DRIVE_REMOTE
    if drive_type == DRIVE_REMOVABLE_VAL {
        Some("removable")
    } else if drive_type == DRIVE_REMOTE_VAL {
        Some("network")
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
pub fn check_drive_type(_path: &Path) -> Option<&'static str> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Helper: create a DB with clipboard_items table and some data.
    fn create_test_db(path: &Path, data: &str) -> rusqlite::Connection {
        let conn = rusqlite::Connection::open(path).unwrap();
        conn.execute_batch(&format!(
            "CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY, content TEXT);
             INSERT INTO clipboard_items VALUES (1, '{data}');"
        ))
        .unwrap();
        conn
    }

    #[test]
    fn integrity_ok_on_fresh_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
            .unwrap();
        assert!(integrity_ok(&conn).unwrap());
    }

    #[test]
    fn integrity_ok_fails_on_corrupt_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("corrupt.db");
        // Write garbage bytes
        fs::write(&db_path, b"this is not a valid sqlite database").unwrap();
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        // Garbage file → Err (can't run PRAGMA) or Ok(false)
        assert!(!integrity_ok(&conn).unwrap_or(false));
    }

    #[test]
    fn integrity_ok_returns_result() {
        // Verify the API returns Result, not bare bool
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
            .unwrap();
        let result: Result<bool, _> = integrity_ok(&conn);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn backup_rotate_creates_timestamped_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "hello");

        backup_rotate(&db_path, &conn);

        let backups = list_timestamped_backups(&db_path);
        assert_eq!(backups.len(), 1, "should have one timestamped backup");

        // Verify filename format: clipboard.YYYY-MM-DDTHH.MM.backup
        let name = backups[0]
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();
        assert!(name.starts_with("clipboard."));
        assert!(name.ends_with(".backup"));
        assert!(name.contains('T'));

        // Verify backup content
        let bak_conn = rusqlite::Connection::open(&backups[0]).unwrap();
        let content: String = bak_conn
            .query_row("SELECT content FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(content, "hello");
    }

    #[test]
    fn prune_keeps_latest_3() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create 5 fake timestamped backups
        for i in 1..=5 {
            let name = format!("clipboard.2026-03-0{i}T07.00.backup");
            let path = dir.path().join(&name);
            let conn = rusqlite::Connection::open(&path).unwrap();
            conn.execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
                .unwrap();
        }

        assert_eq!(list_timestamped_backups(&db_path).len(), 5);

        prune_old_backups(&db_path);

        let remaining = list_timestamped_backups(&db_path);
        assert_eq!(remaining.len(), 3, "should keep latest 3");

        // Verify the oldest 2 were pruned
        let names: Vec<String> = remaining
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"clipboard.2026-03-05T07.00.backup".to_string()));
        assert!(names.contains(&"clipboard.2026-03-04T07.00.backup".to_string()));
        assert!(names.contains(&"clipboard.2026-03-03T07.00.backup".to_string()));
    }

    #[test]
    fn prune_does_not_touch_version_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create 4 timestamped + 1 version snapshot
        for i in 1..=4 {
            let name = format!("clipboard.2026-03-0{i}T07.00.backup");
            let path = dir.path().join(&name);
            fs::write(&path, "fake").unwrap();
        }
        let snap = dir.path().join("clipboard.pre-v1.0.0.backup");
        fs::write(&snap, "version snap").unwrap();

        prune_old_backups(&db_path);

        // 3 timestamped remain + 1 version snapshot untouched
        assert_eq!(list_timestamped_backups(&db_path).len(), 3);
        assert!(snap.exists(), "version snapshot should not be pruned");
    }

    #[test]
    fn backup_integrity_check_removes_corrupt() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.backup");
        fs::write(&path, b"corrupt garbage data").unwrap();
        assert!(!verify_backup(&path));
    }

    #[test]
    fn backup_no_tmp_file_left() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "test");

        backup_rotate(&db_path, &conn);

        // No .tmp files should remain
        let tmp_files: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(tmp_files.is_empty(), ".tmp files should be cleaned up");
    }

    #[test]
    fn backup_before_migration_creates_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "pre-migration");

        backup_before_migration(&db_path, &conn);

        let version = env!("CARGO_PKG_VERSION");
        let snap = dir.path().join(format!("clipboard.pre-v{version}.backup"));
        assert!(snap.exists(), "version snapshot should be created");

        // Verify content
        let snap_conn = rusqlite::Connection::open(&snap).unwrap();
        let content: String = snap_conn
            .query_row("SELECT content FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(content, "pre-migration");
    }

    #[test]
    fn backup_before_migration_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "v1");

        backup_before_migration(&db_path, &conn);

        let version = env!("CARGO_PKG_VERSION");
        let snap = dir.path().join(format!("clipboard.pre-v{version}.backup"));
        let first_modified = fs::metadata(&snap).unwrap().modified().unwrap();

        // Modify DB, call again — should NOT overwrite
        conn.execute_batch("UPDATE clipboard_items SET content = 'v2';")
            .unwrap();
        backup_before_migration(&db_path, &conn);

        let second_modified = fs::metadata(&snap).unwrap().modified().unwrap();
        assert_eq!(first_modified, second_modified, "should not overwrite");

        // Content should still be v1
        let snap_conn = rusqlite::Connection::open(&snap).unwrap();
        let content: String = snap_conn
            .query_row("SELECT content FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(content, "v1");
    }

    #[test]
    fn recovery_flow_restores_from_timestamped_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create a valid timestamped backup
        let bak = dir.path().join("clipboard.2026-03-05T07.00.backup");
        {
            let conn = rusqlite::Connection::open(&bak).unwrap();
            conn.execute_batch("CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY);")
                .unwrap();
        }

        // Create a corrupt main DB
        fs::write(&db_path, b"corrupt data").unwrap();

        let result = recovery_flow(&db_path).unwrap();
        assert_eq!(result, db_path);

        // Verify restored DB is valid
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        assert!(integrity_ok(&conn).unwrap());
    }

    #[test]
    fn recovery_flow_restores_from_legacy_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let bak = db_path.with_extension("db.backup");

        // Create a valid legacy backup DB
        {
            let conn = rusqlite::Connection::open(&bak).unwrap();
            conn.execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
                .unwrap();
        }

        // Create a corrupt main DB
        fs::write(&db_path, b"corrupt data").unwrap();

        let result = recovery_flow(&db_path).unwrap();
        assert_eq!(result, db_path);

        let conn = rusqlite::Connection::open(&db_path).unwrap();
        assert!(integrity_ok(&conn).unwrap());
    }

    #[test]
    fn recovery_flow_falls_back_to_version_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create corrupt main DB, no timestamped/legacy backups
        fs::write(&db_path, b"corrupt").unwrap();

        // Create valid version snapshot
        let snap = dir.path().join("clipboard.pre-v1.0.0.backup");
        {
            let conn = rusqlite::Connection::open(&snap).unwrap();
            conn.execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
                .unwrap();
        }

        let result = recovery_flow(&db_path).unwrap();
        assert_eq!(result, db_path);

        let conn = rusqlite::Connection::open(&db_path).unwrap();
        assert!(integrity_ok(&conn).unwrap());
    }

    #[test]
    fn recovery_flow_fresh_when_no_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create corrupt main DB, no backups
        fs::write(&db_path, b"corrupt").unwrap();

        let result = recovery_flow(&db_path).unwrap();
        assert_eq!(result, db_path);

        // DB file was renamed to .corrupt.TIMESTAMP, path returned for fresh creation
        assert!(!db_path.exists());
        let corrupt_files: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("clipboard.db.corrupt.")
            })
            .collect();
        assert_eq!(
            corrupt_files.len(),
            1,
            "expected one timestamped .corrupt file"
        );

        // Recovery notice should exist
        let notice = dir.path().join("RECOVERY_NOTICE.txt");
        assert!(notice.exists());
        let msg = fs::read_to_string(&notice).unwrap();
        assert!(msg.contains("fresh database"));
    }

    #[test]
    fn recovery_removes_wal_shm() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let wal = db_path.with_extension("db-wal");
        let shm = db_path.with_extension("db-shm");

        fs::write(&db_path, b"corrupt").unwrap();
        fs::write(&wal, b"stale wal").unwrap();
        fs::write(&shm, b"stale shm").unwrap();

        let _ = recovery_flow(&db_path);
        assert!(!wal.exists());
        assert!(!shm.exists());
    }

    #[test]
    fn writes_counter_resets() {
        WRITES_SINCE_BACKUP.store(0, Ordering::Relaxed);
        for _ in 0..50 {
            WRITES_SINCE_BACKUP.fetch_add(1, Ordering::Relaxed);
        }
        assert_eq!(WRITES_SINCE_BACKUP.load(Ordering::Relaxed), 50);
        WRITES_SINCE_BACKUP.store(0, Ordering::Relaxed);
        assert_eq!(WRITES_SINCE_BACKUP.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn backup_rotate_skips_empty_db_with_existing_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create a valid timestamped backup with data
        let bak = dir.path().join("clipboard.2026-03-01T07.00.backup");
        {
            let conn = rusqlite::Connection::open(&bak).unwrap();
            conn.execute_batch(
                "CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY, content TEXT);
                 INSERT INTO clipboard_items VALUES (1, 'important data');",
            )
            .unwrap();
        }

        // Create an empty main DB (schema only, no rows)
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY, content TEXT);")
            .unwrap();

        // backup_rotate should NOT create a new backup of empty DB
        backup_rotate(&db_path, &conn);

        // Original backup should still exist and be the only backup
        let backups = list_timestamped_backups(&db_path);
        assert_eq!(backups.len(), 1);
        assert!(
            backups[0]
                .file_name()
                .unwrap()
                .to_string_lossy()
                .contains("2026-03-01"),
            "original backup should be preserved"
        );
    }

    #[test]
    fn backup_rotate_cleans_legacy_files() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "new");

        // Create legacy backup files
        let legacy = db_path.with_extension("db.backup");
        let legacy1 = db_path.with_extension("db.backup.1");
        fs::write(&legacy, "old").unwrap();
        fs::write(&legacy1, "older").unwrap();

        backup_rotate(&db_path, &conn);

        // Legacy files should be cleaned up
        assert!(!legacy.exists(), "legacy .backup should be removed");
        assert!(!legacy1.exists(), "legacy .backup.1 should be removed");

        // New timestamped backup should exist
        assert_eq!(list_timestamped_backups(&db_path).len(), 1);
    }

    #[test]
    fn full_integrity_check_on_healthy_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = create_test_db(&db_path, "healthy");
        assert!(full_integrity_check(&conn).unwrap());
    }

    #[test]
    fn full_integrity_check_on_corrupt_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("corrupt.db");
        fs::write(&db_path, b"not a sqlite database").unwrap();
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        assert!(!full_integrity_check(&conn).unwrap_or(false));
    }

    #[test]
    fn is_first_launch_detects_new_version() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // No snapshot exists → first launch
        assert!(is_first_launch_of_version(&db_path));

        // Create the snapshot for current version
        let version = env!("CARGO_PKG_VERSION");
        let snap = dir.path().join(format!("clipboard.pre-v{version}.backup"));
        fs::write(&snap, "snapshot").unwrap();

        // Snapshot exists → not first launch
        assert!(!is_first_launch_of_version(&db_path));
    }

    #[test]
    fn force_recovery_marker_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // No marker initially
        assert!(!check_force_recovery(&db_path));

        // Write marker
        write_force_recovery_marker(&db_path);
        assert!(dir.path().join("FORCE_RECOVERY").exists());

        // Check returns true but does NOT remove marker
        assert!(check_force_recovery(&db_path));
        assert!(dir.path().join("FORCE_RECOVERY").exists());

        // Clear removes the marker
        clear_force_recovery(&db_path);
        assert!(!dir.path().join("FORCE_RECOVERY").exists());

        // Check returns false after clear
        assert!(!check_force_recovery(&db_path));
    }

    #[test]
    fn recovery_flow_removes_journal_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create a corrupt DB and stale journal file
        fs::write(&db_path, b"corrupt").unwrap();
        let journal = db_path.with_extension("db-journal");
        fs::write(&journal, b"stale journal").unwrap();

        let _ = recovery_flow(&db_path);

        // Journal file should be removed
        assert!(!journal.exists());
    }

    #[test]
    fn recovery_prefers_newest_version_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create a corrupt DB
        fs::write(&db_path, b"corrupt").unwrap();

        // Create two version snapshots — v1.0.0 (older) and v1.1.0 (newer)
        let old_snap = dir.path().join("clipboard.pre-v1.0.0.backup");
        let new_snap = dir.path().join("clipboard.pre-v1.1.0.backup");
        // Both are valid SQLite DBs
        let conn_old = rusqlite::Connection::open(&old_snap).unwrap();
        conn_old
            .execute_batch("CREATE TABLE t(v TEXT); INSERT INTO t VALUES ('old');")
            .unwrap();
        drop(conn_old);
        let conn_new = rusqlite::Connection::open(&new_snap).unwrap();
        conn_new
            .execute_batch("CREATE TABLE t(v TEXT); INSERT INTO t VALUES ('new');")
            .unwrap();
        drop(conn_new);

        let _ = recovery_flow(&db_path);

        // Should have restored from v1.1.0 (newest, sorted reverse)
        if db_path.exists() {
            let restored = rusqlite::Connection::open(&db_path).unwrap();
            let val: String = restored
                .query_row("SELECT v FROM t", [], |r| r.get(0))
                .unwrap();
            assert_eq!(val, "new");
        }
    }

    #[test]
    fn prune_version_snapshots_keeps_latest_3() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create 5 version snapshots
        for v in &["1.0.0", "1.0.5", "1.1.0", "1.2.0", "1.3.0"] {
            let name = format!("clipboard.pre-v{v}.backup");
            fs::write(dir.path().join(&name), "snap").unwrap();
        }

        assert_eq!(list_version_snapshots(&db_path).len(), 5);

        prune_old_version_snapshots(&db_path);

        let remaining = list_version_snapshots(&db_path);
        assert_eq!(remaining.len(), 3, "should keep latest 3 snapshots");

        // Verify the newest 3 survived (reverse lex: v1.3.0, v1.2.0, v1.1.0)
        let names: Vec<String> = remaining
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"clipboard.pre-v1.3.0.backup".to_string()));
        assert!(names.contains(&"clipboard.pre-v1.2.0.backup".to_string()));
        assert!(names.contains(&"clipboard.pre-v1.1.0.backup".to_string()));
        // v1.0.0 and v1.0.5 should be gone
        assert!(!dir.path().join("clipboard.pre-v1.0.0.backup").exists());
        assert!(!dir.path().join("clipboard.pre-v1.0.5.backup").exists());
    }

    #[test]
    fn prune_version_snapshots_noop_when_3_or_fewer() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Create 2 version snapshots
        for v in &["1.0.0", "1.1.0"] {
            let name = format!("clipboard.pre-v{v}.backup");
            fs::write(dir.path().join(&name), "snap").unwrap();
        }

        prune_old_version_snapshots(&db_path);

        assert_eq!(list_version_snapshots(&db_path).len(), 2);
    }

    #[test]
    fn backup_rotate_prunes_version_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");
        let conn = create_test_db(&db_path, "data");

        // Create 5 version snapshots
        for v in &["1.0.0", "1.0.5", "1.1.0", "1.2.0", "1.3.0"] {
            let name = format!("clipboard.pre-v{v}.backup");
            fs::write(dir.path().join(&name), "snap").unwrap();
        }

        backup_rotate(&db_path, &conn);

        // Should have pruned to 3 version snapshots
        assert_eq!(list_version_snapshots(&db_path).len(), 3);
    }

    #[test]
    fn check_drive_type_local_returns_none() {
        // Local fixed drive (C:\) should return None
        let path = Path::new("C:\\");
        assert!(check_drive_type(path).is_none());
    }

    #[test]
    fn cleanup_backup_sidecars_removes_tmp_files() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("clipboard.db");

        // Simulate a .tmp file left by a kill mid-backup
        let tmp = dir.path().join("clipboard.abc123.tmp");
        fs::write(&tmp, "partial backup").unwrap();

        // Also add a legitimate non-tmp file that should NOT be removed
        let keep = dir.path().join("clipboard.2026-01-01T00.00.backup");
        fs::write(&keep, "valid backup").unwrap();

        cleanup_backup_sidecars(&db_path);

        assert!(!tmp.exists(), ".tmp file should be removed by cleanup");
        assert!(keep.exists(), "timestamped backup should not be removed");
    }
}
