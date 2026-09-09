//! clipboard_items SQL: IPC commands as thin wrappers over `*_core(&Connection)`
//! functions that are unit-tested against the real migrated schema. (app_icons
//! SQL lives in source_app.rs — that domain's private cache.)

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Duration;
use tauri::Manager;
use tracing::{info, warn};

use crate::backup;
use crate::error::AppError;

async fn with_db_mut_async<T, F>(app: tauri::AppHandle, f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&mut rusqlite::Connection) -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || with_db_mut(&app, f))
        .await
        .map_err(|e| AppError::Other(format!("DB task failed to join: {e}")))?
}

/// Trigger a backup after a write command. Extracts the db path from app state
/// so the identical two-liner isn't repeated in every write command.
fn backup_after_write(app: &tauri::AppHandle) {
    let db_path = app.state::<crate::DataDir>().0.join("clipboard.db");
    backup::maybe_backup(app, &db_path);
}

// ---------------------------------------------------------------------------
// Items absorbed from commands/mod.rs — all have exactly one consumer (db.rs)
// ---------------------------------------------------------------------------

/// Maximum text content size (1 MB) — matches frontend MAX_TEXT_SIZE
const MAX_CONTENT_SIZE: usize = 1_048_576;

/// Maximum note size (100 KB)
const MAX_NOTE_SIZE: usize = 102_400;

/// Maximum items auto-delete can remove per run — prevents mass-deletion on clock skew
const MAX_AUTO_DELETE_BATCH: i64 = 50;

/// Maximum allowed value for `db_prune_old_items.max_items` (defensive cap to
/// prevent IPC callers from passing wildly out-of-range values).
const MAX_PRUNE_LIMIT: i64 = 1_000_000;

/// Validate `max_items` from IPC for `db_prune_old_items`. Rejects `<= 0` and
/// `> MAX_PRUNE_LIMIT`. Returns the value verbatim on success so callers
/// can use the result directly.
fn validate_prune_max_items(n: i64) -> Result<i64, String> {
    if !(1..=MAX_PRUNE_LIMIT).contains(&n) {
        return Err(format!(
            "max_items {n} out of range (1..={MAX_PRUNE_LIMIT})"
        ));
    }
    Ok(n)
}

/// Remove unreferenced files before releasing the DB lock or completing deletion.
///
/// Each path is canonicalized and re-checked against `images_dir` before
/// `remove_file`. Defense in depth: if a corrupted DB row or pre-validation
/// upsert left an external path in the table, we refuse to delete from
/// outside the app data directory rather than silently honoring it.
fn cleanup_image_files(conn: &rusqlite::Connection, images_dir: &Path, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    // Resolve aliases too: Windows path casing and extended prefixes can differ.
    let referenced: Vec<String> = match conn
        .prepare("SELECT image_path FROM clipboard_items WHERE image_path IS NOT NULL")
        .and_then(|mut stmt| stmt.query_map([], |r| r.get(0))?.collect())
    {
        Ok(paths) => paths,
        Err(e) => {
            warn!(error = %e, "skipping cleanup: cannot read current image references");
            return;
        }
    };
    let referenced: Vec<_> = referenced
        .iter()
        .filter_map(|p| Path::new(p).canonicalize().ok())
        .collect();
    // Hoist the loop-invariant canonicalization of images_dir out of the per-path loop.
    let canonical_root = match images_dir.canonicalize() {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(error = %e, "skipping cleanup: cannot canonicalize images_dir");
            return;
        }
    };
    for path in paths {
        // Canonicalize the candidate and confirm it lives under images_dir.
        let candidate = std::path::Path::new(&path);
        let canonical = match candidate.canonicalize() {
            Ok(p) => p,
            Err(e) => {
                tracing::warn!(error = %e, path = %path, "skipping cleanup: cannot canonicalize");
                continue;
            }
        };
        if !canonical.starts_with(&canonical_root) {
            tracing::warn!(
                path = %path,
                "skipping cleanup: image_path is outside images directory"
            );
            continue;
        }
        if referenced.contains(&canonical) {
            continue;
        }
        if let Err(e) = std::fs::remove_file(&canonical) {
            tracing::warn!(error = %e, path = %path, "failed to remove orphaned image file");
        }
    }
}

fn with_db_mut<F, T>(app: &tauri::AppHandle, f: F) -> Result<T, AppError>
where
    F: FnOnce(&mut rusqlite::Connection) -> Result<T, AppError>,
{
    let pool = app.state::<crate::DbPool>();
    let mut conn = pool.0.lock();
    let result = f(&mut conn);
    if let Err(ref e) = result {
        super::check_corruption(app, e);
    }
    result
}

// --- Database models ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: i64,
    pub content: String,
    pub content_hash: String,
    pub content_type: String,
    pub image_path: Option<String>,
    pub html_content: Option<String>,
    pub note: Option<String>,
    pub starred: bool,
    pub created_at: String,
    pub last_used: String,
    pub source_app: Option<String>,
    pub source_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DbStats {
    pub total_items: i64,
    pub text_items: i64,
    pub image_items: i64,
    pub starred_items: i64,
    pub db_size_bytes: u64,
    pub images_dir_size_bytes: u64,
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub search_mode: String,
    pub type_filter: String,
    pub app_filter: Option<String>,
    pub limit: i64,
}

// --- Clipboard item commands ---

const ITEM_COLUMNS: &str =
    "id, content, content_hash, content_type, image_path, html_content, note, pinned, created_at, last_used, source_app, source_title";

/// Map a database row (selected with ITEM_COLUMNS) to a ClipboardItem.
fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<ClipboardItem> {
    Ok(ClipboardItem {
        id: row.get(0)?,
        content: row.get(1)?,
        content_hash: row.get(2)?,
        content_type: row.get(3)?,
        image_path: row.get(4)?,
        html_content: row.get(5)?,
        note: row.get(6)?,
        starred: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        last_used: row.get(9)?,
        source_app: row.get(10)?,
        source_title: row.get(11)?,
    })
}

/// Query clipboard items: all pinned + unpinned capped by limit, ordered by last_used DESC.
/// Pinned items are always included (not pruned by limit) but sort chronologically
/// alongside everything else — the Starred tab is for viewing starred items separately.
fn query_items(conn: &rusqlite::Connection, limit: i64) -> Result<Vec<ClipboardItem>, AppError> {
    let use_limit = limit > 0;
    let sql = if use_limit {
        format!(
            "SELECT * FROM (\
               SELECT {c} FROM clipboard_items WHERE pinned = 1 \
               UNION ALL \
               SELECT * FROM (\
                 SELECT {c} FROM clipboard_items WHERE pinned = 0 \
                 ORDER BY last_used DESC LIMIT ?1\
               )\
             ) ORDER BY last_used DESC",
            c = ITEM_COLUMNS
        )
    } else {
        format!(
            "SELECT {} FROM clipboard_items ORDER BY last_used DESC",
            ITEM_COLUMNS
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = if use_limit {
        stmt.query_map([limit], row_to_item)?
    } else {
        stmt.query_map([], row_to_item)?
    };
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// Fetch a single clipboard item by ID with full content (for paste/preview/transform).
#[tauri::command]
pub async fn db_get_item(app: tauri::AppHandle, id: i64) -> Result<ClipboardItem, AppError> {
    super::with_db_async(app, move |conn| {
        let sql = format!("SELECT {} FROM clipboard_items WHERE id = ?1", ITEM_COLUMNS);
        conn.query_row(&sql, [id], row_to_item)
            .map_err(AppError::Database)
    })
    .await
}

#[tauri::command]
pub async fn db_get_all_items(
    app: tauri::AppHandle,
    limit: Option<i64>,
) -> Result<Vec<ClipboardItem>, AppError> {
    super::with_db_async(app, move |conn| query_items(conn, limit.unwrap_or(0))).await
}

#[tauri::command]
pub async fn search_items(
    app: tauri::AppHandle,
    request: SearchRequest,
) -> Result<crate::search::SearchResponse, AppError> {
    use crate::search;

    super::with_db_async(app, move |conn| {
        // 1. Query ALL items from DB (pinned always included, unpinned capped by limit)
        let all_items = query_items(conn, request.limit)?;

        // 2. Compute filter counts from the full unfiltered set
        let total_unfiltered = all_items.len() as i64;
        let (filter_counts, _, _) = search::compute_counts(&all_items);

        // 3. Apply type filter first
        let type_filtered: Vec<ClipboardItem> = all_items
            .into_iter()
            .filter(|item| match request.type_filter.as_str() {
                "starred" => item.starred,
                "text" => item.content_type == "text",
                "image" => item.content_type == "image",
                "notes" => item.note.as_ref().is_some_and(|n| !n.trim().is_empty()),
                _ => true, // "all"
            })
            .collect();

        // 4. Compute app counts AFTER type filter — dropdown shows accurate counts
        let (_, app_counts, app_last_used) = search::compute_counts(&type_filtered);

        // 5. Apply app filter
        let filtered_items: Vec<ClipboardItem> = type_filtered
            .into_iter()
            .filter(|item| {
                if let Some(ref app_name) = request.app_filter {
                    item.source_app.as_deref() == Some(app_name.as_str())
                        && item.content_type != "image"
                } else {
                    true
                }
            })
            .collect();

        // 6. Run search engine
        let (mut results, regex_error) =
            search::run_search(&filtered_items, &request.query, &request.search_mode);

        // 7. Strip heavy fields for IPC — list view doesn't need full content/html.
        // Frontend fetches full item on demand via db_get_item for paste/preview.
        const TRUNCATE_CHARS: usize = 200;
        for r in &mut results {
            r.item.html_content = None;
            if r.item.content.chars().nth(500).is_some() {
                // Truncate to ~200 chars for IPC — frontend fetches full via db_get_item
                let truncated: String = r.item.content.chars().take(TRUNCATE_CHARS).collect();
                r.item.content = truncated;
                // Clamp match indices to truncated range — stale indices beyond
                // the truncation boundary cause ghost highlights on the frontend
                for m in &mut r.matches {
                    m.indices.retain(|pair| pair[0] < TRUNCATE_CHARS);
                    for pair in &mut m.indices {
                        if pair[1] >= TRUNCATE_CHARS {
                            pair[1] = TRUNCATE_CHARS - 1;
                        }
                    }
                }
            }
        }

        Ok(search::SearchResponse {
            items: results,
            total_unfiltered,
            filter_counts,
            app_counts,
            app_last_used,
            regex_error,
        })
    })
    .await
}

/// Core upsert logic — callable from both IPC handler and background jobs.
pub(crate) fn upsert_item_core(
    conn: &rusqlite::Connection,
    content: &str,
    content_hash: &str,
    html_content: Option<&str>,
    source_app: Option<&str>,
    source_title: Option<&str>,
) -> Result<ClipboardItem, AppError> {
    conn.execute(
        "INSERT INTO clipboard_items (content, content_hash, content_type, html_content, source_app, source_title)
         VALUES (?1, ?2, 'text', ?3, ?4, ?5)
         ON CONFLICT(content_hash) DO UPDATE SET
           last_used = datetime('now'),
           html_content = COALESCE(?3, clipboard_items.html_content),
           source_app = COALESCE(?4, clipboard_items.source_app),
           source_title = COALESCE(?5, clipboard_items.source_title)",
        rusqlite::params![content, content_hash, html_content, source_app, source_title],
    )?;
    let row = conn.query_row(
        &format!(
            "SELECT {} FROM clipboard_items WHERE content_hash = ?1",
            ITEM_COLUMNS
        ),
        [content_hash],
        row_to_item,
    )?;
    Ok(row)
}

#[tauri::command]
pub async fn db_upsert_item(
    app: tauri::AppHandle,
    content: String,
    content_hash: String,
    html_content: Option<String>,
    source_app: Option<String>,
    source_title: Option<String>,
) -> Result<ClipboardItem, AppError> {
    if content.len() > MAX_CONTENT_SIZE {
        return Err(AppError::Validation(
            "Content too large (max 1MB)".to_string(),
        ));
    }
    if let Some(ref html) = html_content {
        if html.len() > MAX_CONTENT_SIZE {
            return Err(AppError::Validation(
                "HTML content too large (max 1MB)".to_string(),
            ));
        }
    }
    let item = super::with_db_async(app.clone(), move |conn| {
        upsert_item_core(
            conn,
            &content,
            &content_hash,
            html_content.as_deref(),
            source_app.as_deref(),
            source_title.as_deref(),
        )
    })
    .await?;
    backup_after_write(&app);
    Ok(item)
}

/// Core image upsert logic — ON CONFLICT/COALESCE upsert + SELECT by hash.
/// Extracted so both the IPC handler and tests can call it directly.
pub(crate) fn upsert_image_item_core(
    conn: &rusqlite::Connection,
    content_hash: &str,
    image_path: &str,
    source_app: Option<&str>,
    source_title: Option<&str>,
) -> Result<ClipboardItem, AppError> {
    let short_hash = &content_hash[..16.min(content_hash.len())];
    conn.execute(
        "INSERT INTO clipboard_items (content, content_hash, content_type, image_path, source_app, source_title)
         VALUES (?1, ?2, 'image', ?3, ?4, ?5)
         ON CONFLICT(content_hash) DO UPDATE SET
           last_used = datetime('now'),
           source_app = COALESCE(?4, clipboard_items.source_app),
           source_title = COALESCE(?5, clipboard_items.source_title)",
        rusqlite::params![short_hash, content_hash, image_path, source_app, source_title],
    )?;
    let row = conn.query_row(
        &format!(
            "SELECT {} FROM clipboard_items WHERE content_hash = ?1",
            ITEM_COLUMNS
        ),
        [content_hash],
        row_to_item,
    )?;
    Ok(row)
}

pub(crate) fn save_image_item_core(
    conn: &rusqlite::Connection,
    images_dir: &Path,
    base64_data: &str,
    content_hash: &str,
    source_app: Option<&str>,
    source_title: Option<&str>,
) -> Result<ClipboardItem, AppError> {
    let path = super::images::save_image_core(images_dir, base64_data, content_hash)?;
    upsert_image_item_core(conn, content_hash, &path, source_app, source_title)
}

#[tauri::command]
pub async fn db_save_image_item(
    app: tauri::AppHandle,
    base64_data: String,
    content_hash: String,
    source_app: Option<String>,
    source_title: Option<String>,
) -> Result<ClipboardItem, AppError> {
    let images_dir = super::get_images_dir(&app)?;
    let item = super::with_db_async(app.clone(), move |conn| {
        save_image_item_core(
            conn,
            &images_dir,
            &base64_data,
            &content_hash,
            source_app.as_deref(),
            source_title.as_deref(),
        )
    })
    .await?;
    backup_after_write(&app);
    Ok(item)
}

/// Restore complete data without bumping time or overwriting a newer copy.
fn restore_item_core(
    conn: &rusqlite::Connection,
    images_dir: &Path,
    mut entry: ClipboardItem,
    image_base64: Option<&str>,
) -> Result<ClipboardItem, AppError> {
    let select = format!("SELECT {ITEM_COLUMNS} FROM clipboard_items WHERE content_hash = ?1");
    // Held under DbPool's lock along with file writes and all deletion cleanup.
    if let Some(current) = conn
        .query_row(&select, [&entry.content_hash], row_to_item)
        .optional()?
    {
        return Ok(current);
    }
    if entry.content.len() > MAX_CONTENT_SIZE
        || entry
            .html_content
            .as_ref()
            .is_some_and(|v| v.len() > MAX_CONTENT_SIZE)
        || entry.note.as_ref().is_some_and(|v| v.len() > MAX_NOTE_SIZE)
    {
        return Err(AppError::Validation(
            "Restore payload too large".to_string(),
        ));
    }
    match entry.content_type.as_str() {
        "image" => {
            let bytes = image_base64
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AppError::Validation("Image snapshot is unavailable".to_string()))?;
            entry.image_path = Some(super::images::save_image_core(
                images_dir,
                bytes,
                &entry.content_hash,
            )?);
        }
        "text" => {
            entry.image_path = None;
        }
        _ => return Err(AppError::Validation("Invalid content type".to_string())),
    }
    conn.execute(
        "INSERT INTO clipboard_items (content, content_hash, content_type, image_path, html_content, note, pinned, created_at, last_used, source_app, source_title)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(content_hash) DO NOTHING",
        rusqlite::params![entry.content, entry.content_hash, entry.content_type, entry.image_path,
            entry.html_content, entry.note, entry.starred, entry.created_at, entry.last_used, entry.source_app, entry.source_title],
    )?;
    Ok(conn.query_row(&select, [&entry.content_hash], row_to_item)?)
}

#[tauri::command]
pub async fn db_restore_item(
    app: tauri::AppHandle,
    entry: ClipboardItem,
    image_base64: Option<String>,
) -> Result<ClipboardItem, AppError> {
    let images_dir = super::get_images_dir(&app)?;
    let item = super::with_db_async(app.clone(), move |conn| {
        restore_item_core(conn, &images_dir, entry, image_base64.as_deref())
    })
    .await?;
    backup_after_write(&app);
    Ok(item)
}

/// Returns the image path of the deleted row (if any) so the caller can clean up the file.
pub(crate) fn delete_item_core(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<Option<String>, AppError> {
    let path: Option<String> = conn
        .query_row(
            "SELECT image_path FROM clipboard_items WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .ok()
        .flatten();
    conn.execute("DELETE FROM clipboard_items WHERE id = ?1", [id])?;
    Ok(path)
}

#[tauri::command]
pub async fn db_delete_item(app: tauri::AppHandle, id: i64) -> Result<(), AppError> {
    let images_dir = super::get_images_dir(&app)?;
    super::with_db_async(app.clone(), move |conn| {
        if let Some(path) = delete_item_core(conn, id)? {
            cleanup_image_files(conn, &images_dir, vec![path]);
        }
        Ok(())
    })
    .await?;
    backup_after_write(&app);
    Ok(())
}

pub(crate) fn batch_delete_core(
    conn: &mut rusqlite::Connection,
    ids: &[i64],
) -> Result<Vec<String>, AppError> {
    let tx = conn.transaction()?;
    let mut all_image_paths: Vec<String> = Vec::new();
    // Chunk into batches of 500 to stay under SQLite's 999 parameter limit
    for chunk in ids.chunks(500) {
        let placeholders: Vec<String> = chunk
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect();
        let placeholder_str = placeholders.join(", ");
        let params: Vec<&dyn rusqlite::types::ToSql> = chunk
            .iter()
            .map(|id| id as &dyn rusqlite::types::ToSql)
            .collect();
        // Collect image paths before deleting
        let select_sql = format!(
            "SELECT image_path FROM clipboard_items WHERE id IN ({})",
            placeholder_str
        );
        let mut stmt = tx.prepare(&select_sql)?;
        let paths: Vec<String> = stmt
            .query_map(params.as_slice(), |row| row.get::<_, Option<String>>(0))?
            .filter_map(|r| r.ok().flatten())
            .collect();
        drop(stmt);
        all_image_paths.extend(paths);
        let delete_sql = format!(
            "DELETE FROM clipboard_items WHERE id IN ({})",
            placeholder_str
        );
        tx.execute(&delete_sql, params.as_slice())?;
    }
    tx.commit()?;
    Ok(all_image_paths)
}

#[tauri::command]
pub async fn db_batch_delete_items(app: tauri::AppHandle, ids: Vec<i64>) -> Result<(), AppError> {
    if ids.is_empty() {
        return Ok(());
    }
    let images_dir = super::get_images_dir(&app)?;
    with_db_mut_async(app, move |conn| {
        let paths = batch_delete_core(conn, &ids)?;
        cleanup_image_files(conn, &images_dir, paths);
        Ok(())
    })
    .await?;
    Ok(())
}

pub(crate) fn toggle_star_core(
    conn: &rusqlite::Connection,
    id: i64,
    starred: bool,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE clipboard_items SET pinned = ?1 WHERE id = ?2",
        rusqlite::params![if starred { 1i64 } else { 0i64 }, id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn db_toggle_star(app: tauri::AppHandle, id: i64, starred: bool) -> Result<(), AppError> {
    super::with_db_async(app.clone(), move |conn| toggle_star_core(conn, id, starred)).await?;
    backup_after_write(&app);
    Ok(())
}

pub(crate) fn touch_item_core(conn: &rusqlite::Connection, id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE clipboard_items SET last_used = datetime('now') WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn db_touch_item(app: tauri::AppHandle, id: i64) -> Result<(), AppError> {
    super::with_db_async(app.clone(), move |conn| touch_item_core(conn, id)).await?;
    backup_after_write(&app);
    Ok(())
}

pub(crate) fn update_note_core(
    conn: &rusqlite::Connection,
    id: i64,
    note: &str,
) -> Result<(), AppError> {
    let note_val = if note.is_empty() { None } else { Some(note) };
    conn.execute(
        "UPDATE clipboard_items SET note = ?1 WHERE id = ?2",
        rusqlite::params![note_val, id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn db_update_note(app: tauri::AppHandle, id: i64, note: String) -> Result<(), AppError> {
    if note.len() > MAX_NOTE_SIZE {
        return Err(AppError::Validation(
            "Note too large (max 100KB)".to_string(),
        ));
    }
    super::with_db_async(app.clone(), move |conn| update_note_core(conn, id, &note)).await?;
    backup_after_write(&app);
    Ok(())
}

pub(crate) fn clear_unstarred_core(
    conn: &mut rusqlite::Connection,
) -> Result<Vec<String>, AppError> {
    let tx = conn.transaction()?;
    let mut stmt = tx.prepare("SELECT image_path FROM clipboard_items WHERE pinned = 0")?;
    let paths: Vec<String> = stmt
        .query_map([], |row| row.get::<_, Option<String>>(0))?
        .filter_map(|r| r.ok().flatten())
        .collect();
    drop(stmt);
    tx.execute("DELETE FROM clipboard_items WHERE pinned = 0", [])?;
    tx.commit()?;
    Ok(paths)
}

#[tauri::command]
pub async fn db_clear_unstarred(app: tauri::AppHandle) -> Result<(), AppError> {
    let images_dir = super::get_images_dir(&app)?;
    with_db_mut_async(app, move |conn| {
        let paths = clear_unstarred_core(conn)?;
        cleanup_image_files(conn, &images_dir, paths);
        Ok(())
    })
    .await?;
    Ok(())
}

pub(crate) fn delete_older_than_core(
    conn: &rusqlite::Connection,
    days: i64,
) -> Result<(i64, Vec<String>), AppError> {
    if days <= 0 {
        return Ok((0, Vec::new()));
    }
    // Count candidates to detect possible clock skew
    let candidate_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clipboard_items WHERE pinned = 0 AND created_at < datetime('now', '-' || ?1 || ' days')",
        [days],
        |row| row.get(0),
    )?;

    if candidate_count > MAX_AUTO_DELETE_BATCH {
        warn!(
            count = candidate_count,
            limit = MAX_AUTO_DELETE_BATCH,
            days,
            "auto-delete would remove {} items (limit {}), possible clock skew — capping",
            candidate_count,
            MAX_AUTO_DELETE_BATCH
        );
    }

    // Collect image paths (capped, oldest first)
    let mut stmt = conn.prepare(
        "SELECT image_path FROM clipboard_items WHERE pinned = 0 AND created_at < datetime('now', '-' || ?1 || ' days') ORDER BY created_at ASC LIMIT ?2",
    )?;
    let paths: Vec<String> = stmt
        .query_map(rusqlite::params![days, MAX_AUTO_DELETE_BATCH], |row| {
            row.get::<_, Option<String>>(0)
        })?
        .filter_map(|r| r.ok().flatten())
        .collect();

    // Delete with LIMIT — oldest first, capped to prevent mass-deletion
    let count = conn.execute(
        "DELETE FROM clipboard_items WHERE id IN (
               SELECT id FROM clipboard_items WHERE pinned = 0 AND created_at < datetime('now', '-' || ?1 || ' days')
               ORDER BY created_at ASC LIMIT ?2
             )",
        rusqlite::params![days, MAX_AUTO_DELETE_BATCH],
    )?;

    Ok((count as i64, paths))
}

#[tauri::command]
pub async fn db_delete_older_than(app: tauri::AppHandle, days: i64) -> Result<i64, AppError> {
    let images_dir = super::get_images_dir(&app)?;
    super::with_db_async(app, move |conn| {
        let (affected, paths) = delete_older_than_core(conn, days)?;
        cleanup_image_files(conn, &images_dir, paths);
        Ok(affected)
    })
    .await
}

pub(crate) fn prune_old_items_core(
    conn: &rusqlite::Connection,
    max_items: i64,
) -> Result<Vec<String>, AppError> {
    // Collect image paths of items that will be pruned (unpinned items beyond the limit)
    let mut stmt = conn.prepare(
        "SELECT image_path FROM clipboard_items WHERE pinned = 0 ORDER BY last_used DESC LIMIT -1 OFFSET ?1",
    )?;
    let paths: Vec<String> = stmt
        .query_map([max_items], |row| row.get::<_, Option<String>>(0))?
        .filter_map(|r| r.ok().flatten())
        .collect();

    conn.execute(
        "DELETE FROM clipboard_items WHERE pinned = 0 AND id NOT IN (
               SELECT id FROM clipboard_items WHERE pinned = 0
               ORDER BY last_used DESC LIMIT ?1
             )",
        [max_items],
    )?;

    Ok(paths)
}

#[tauri::command]
pub async fn db_prune_old_items(app: tauri::AppHandle, max_items: i64) -> Result<(), AppError> {
    let max_items = validate_prune_max_items(max_items).map_err(AppError::Validation)?;
    let images_dir = super::get_images_dir(&app)?;
    super::with_db_async(app, move |conn| {
        let paths = prune_old_items_core(conn, max_items)?;
        cleanup_image_files(conn, &images_dir, paths);
        Ok(())
    })
    .await?;
    Ok(())
}

// --- Orphaned image reconciliation ---

/// Scan images directory and delete files not referenced by any DB row.
/// Called once at startup after migrations, before any writers can run.
pub(crate) fn reconcile_orphaned_images(conn: &rusqlite::Connection, data_dir: &Path) {
    let images_dir = data_dir.join("images");
    if !images_dir.is_dir() {
        return;
    }

    // Don't follow symlinks — could delete files outside data dir (E14/U11)
    if fs::symlink_metadata(&images_dir)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
    {
        warn!("images directory is a symlink, skipping reconciliation");
        return;
    }

    // Collect all image_path values from DB (case-folded for Windows compatibility)
    let paths: Vec<String> = match conn
        .prepare("SELECT image_path FROM clipboard_items WHERE image_path IS NOT NULL")
        .and_then(|mut stmt| stmt.query_map([], |row| row.get(0))?.collect())
    {
        Ok(paths) => paths,
        Err(e) => {
            warn!(error = %e, "failed to query image paths for reconciliation");
            return;
        }
    };
    let db_paths = paths
        .iter()
        .filter_map(|p| image_path_key(Path::new(p)))
        .collect();

    // Finish before startup exposes the connection to writers. A detached scan
    // would use stale references and could erase an Undo or a re-added image.
    reconcile_walk(&images_dir, &db_paths);
}

/// Clean up DB records whose image files no longer exist on disk.
/// Sets image_path=NULL, content_type='text', content='[Image removed]'.
pub(crate) fn cleanup_broken_image_records(conn: &rusqlite::Connection) {
    let rows: Vec<(i64, String)> = match conn
        .prepare("SELECT id, image_path FROM clipboard_items WHERE image_path IS NOT NULL")
    {
        Ok(mut stmt) => stmt
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .ok()
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default(),
        Err(e) => {
            warn!(error = %e, "failed to query image paths for cleanup");
            return;
        }
    };

    let mut cleaned = 0u32;
    for (id, path) in &rows {
        if fs::metadata(path).is_err() {
            if let Err(e) = conn.execute(
                "UPDATE clipboard_items SET image_path = NULL, content_type = 'text', content = '[Image removed]' WHERE id = ?1",
                rusqlite::params![id],
            ) {
                warn!(id, error = %e, "failed to clean broken image record");
            } else {
                cleaned += 1;
            }
        }
    }
    if cleaned > 0 {
        info!(cleaned, "cleaned broken image records");
    }
}

/// Walk images/ directory (root + subdirectories), remove unreferenced .png files
/// and empty subdirs. Handles both legacy root-level images and YYYY-MM organized ones.
fn reconcile_walk(images_dir: &Path, db_paths: &std::collections::HashSet<String>) {
    let mut removed = 0u32;
    if let Ok(entries) = fs::read_dir(images_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Skip symlinked subdirectories (E14/U11)
                if fs::symlink_metadata(&path)
                    .map(|m| m.file_type().is_symlink())
                    .unwrap_or(false)
                {
                    continue;
                }
                // Walk YYYY-MM subdirectory
                if let Ok(files) = fs::read_dir(&path) {
                    for file in files.flatten() {
                        removed += remove_if_orphaned(&file.path(), db_paths);
                    }
                }
                // Remove empty YYYY-MM subdirectory
                let _ = fs::remove_dir(&path); // no-op if non-empty
            } else {
                // Root-level images (legacy, before YYYY-MM organization)
                removed += remove_if_orphaned(&path, db_paths);
            }
        }
    }
    if removed > 0 {
        info!(count = removed, "removed orphaned image files");
    }
}

/// Delete a .png file if it's not referenced in the DB. Returns 1 if removed, 0 otherwise.
fn remove_if_orphaned(file_path: &Path, db_paths: &std::collections::HashSet<String>) -> u32 {
    if file_path.extension().and_then(|e| e.to_str()) != Some("png") {
        return 0;
    }
    // Skip recently-created files to avoid race with save_image (R3/R15).
    // A file written in the last 60 seconds may not be in the DB snapshot yet.
    if let Ok(meta) = fs::metadata(file_path) {
        if let Ok(modified) = meta.modified() {
            // unwrap_or(0) on clock drift → treats as "just created" → skip = safe default
            if modified.elapsed().unwrap_or(Duration::from_secs(0)) < Duration::from_secs(60) {
                return 0;
            }
        }
    }
    // Case-insensitive comparison (Windows paths are case-insensitive)
    let Some(path_lower) = image_path_key(file_path) else {
        return 0;
    };
    if !db_paths.contains(&path_lower) {
        if let Err(e) = fs::remove_file(file_path) {
            warn!(error = %e, path = %path_lower, "failed to remove orphaned image");
        } else {
            return 1;
        }
    }
    0
}

fn image_path_key(path: &Path) -> Option<String> {
    let canonical = path.canonicalize().ok()?;
    let value = canonical.to_string_lossy();
    Some(
        value
            .strip_prefix("\\\\?\\")
            .unwrap_or(&value)
            .to_lowercase(),
    )
}

// --- Statistics command ---

fn dir_size(path: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(meta) = p.metadata() {
                total += meta.len();
            }
        }
    }
    total
}

#[tauri::command]
pub async fn db_get_stats(app: tauri::AppHandle) -> Result<DbStats, AppError> {
    let data_dir = app.state::<crate::DataDir>();
    let db_path = data_dir.0.join("clipboard.db");
    let images_dir = data_dir.0.join("images");

    // Compute file sizes on the calling thread (fast metadata ops, no lock needed)
    let db_size_bytes = fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
    let images_dir_size_bytes = if images_dir.is_dir() {
        dir_size(&images_dir)
    } else {
        0
    };

    super::with_db_async(app, move |conn| {
        conn.query_row(
            "SELECT COUNT(*), \
             SUM(CASE WHEN content_type = 'text' THEN 1 ELSE 0 END), \
             SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END), \
             SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) \
             FROM clipboard_items",
            [],
            |r| {
                Ok(DbStats {
                    total_items: r.get(0)?,
                    text_items: r.get::<_, Option<i64>>(1)?.unwrap_or(0),
                    image_items: r.get::<_, Option<i64>>(2)?.unwrap_or(0),
                    starred_items: r.get::<_, Option<i64>>(3)?.unwrap_or(0),
                    db_size_bytes,
                    images_dir_size_bytes,
                })
            },
        )
        .map_err(Into::into)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- reconcile_orphaned_images tests ---

    /// Set a file's modification time to 2 minutes ago (older than the 60s skip threshold).
    fn make_old(path: &Path) {
        use std::fs::{FileTimes, OpenOptions};
        use std::time::SystemTime;
        let old_time = SystemTime::now() - Duration::from_secs(120);
        let file = OpenOptions::new().write(true).open(path).unwrap();
        file.set_times(FileTimes::new().set_modified(old_time))
            .unwrap();
    }

    fn setup_reconcile_db(dir: &Path) -> rusqlite::Connection {
        let db_path = dir.join("clipboard.db");
        let mut conn = rusqlite::Connection::open(&db_path).unwrap();
        crate::migrations::run_migrations(&mut conn).unwrap();
        conn
    }

    #[test]
    fn reconcile_preserves_referenced_images() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2026-03");
        fs::create_dir_all(&month_dir).unwrap();

        let img_path = month_dir.join("abc123.png");
        fs::write(&img_path, b"fake png").unwrap();

        let conn = setup_reconcile_db(dir.path());
        conn.execute(
            "INSERT INTO clipboard_items (content, content_hash, content_type, image_path) VALUES ('img', 'h', 'image', ?1)",
            [img_path.to_string_lossy().to_string()],
        )
        .unwrap();

        reconcile_walk(&dir.path().join("images"), &{
            let mut set = std::collections::HashSet::new();
            set.insert(img_path.to_string_lossy().to_lowercase());
            set
        });

        assert!(img_path.exists(), "referenced image should be preserved");
    }

    #[test]
    fn reconcile_deletes_unreferenced_images() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2026-03");
        fs::create_dir_all(&month_dir).unwrap();

        let orphan = month_dir.join("orphan.png");
        fs::write(&orphan, b"fake png").unwrap();
        make_old(&orphan);

        // Empty DB — no image references
        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&dir.path().join("images"), &db_paths);

        assert!(!orphan.exists(), "unreferenced image should be deleted");
    }

    #[test]
    fn reconcile_skips_non_png_files() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2026-03");
        fs::create_dir_all(&month_dir).unwrap();

        let txt_file = month_dir.join("notes.txt");
        fs::write(&txt_file, b"not an image").unwrap();

        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&dir.path().join("images"), &db_paths);

        assert!(txt_file.exists(), "non-PNG file should be preserved");
    }

    #[test]
    fn reconcile_handles_empty_images_dir() {
        let dir = tempfile::tempdir().unwrap();
        let images_dir = dir.path().join("images");
        fs::create_dir_all(&images_dir).unwrap();

        let db_paths = std::collections::HashSet::new();
        // Should not panic
        reconcile_walk(&images_dir, &db_paths);
    }

    #[test]
    fn reconcile_removes_empty_subdirs() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2025-01");
        fs::create_dir_all(&month_dir).unwrap();

        let orphan = month_dir.join("old.png");
        fs::write(&orphan, b"data").unwrap();
        make_old(&orphan);

        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&dir.path().join("images"), &db_paths);

        assert!(!orphan.exists(), "orphan should be deleted");
        assert!(
            !month_dir.exists(),
            "empty subdir should be removed after cleanup"
        );
    }

    #[test]
    fn reconcile_deletes_root_level_orphans() {
        let dir = tempfile::tempdir().unwrap();
        let images_dir = dir.path().join("images");
        fs::create_dir_all(&images_dir).unwrap();

        // Legacy root-level image (before YYYY-MM organization)
        let orphan = images_dir.join("legacy.png");
        fs::write(&orphan, b"old data").unwrap();
        make_old(&orphan);

        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&images_dir, &db_paths);

        assert!(
            !orphan.exists(),
            "root-level orphaned image should be deleted"
        );
    }

    #[test]
    fn reconcile_case_insensitive_match() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2026-03");
        fs::create_dir_all(&month_dir).unwrap();

        let img_path = month_dir.join("ABC123.png");
        fs::write(&img_path, b"fake png").unwrap();

        // DB stores lowercase path, file on disk has uppercase
        let mut db_paths = std::collections::HashSet::new();
        db_paths.insert(img_path.to_string_lossy().to_lowercase());

        reconcile_walk(&dir.path().join("images"), &db_paths);

        assert!(
            img_path.exists(),
            "case-different but matching image should be preserved"
        );
    }

    #[test]
    fn reconcile_skips_recent_files() {
        let dir = tempfile::tempdir().unwrap();
        let month_dir = dir.path().join("images").join("2026-03");
        fs::create_dir_all(&month_dir).unwrap();

        // Create a file just now — should be skipped (< 60s old)
        let recent = month_dir.join("fresh.png");
        fs::write(&recent, b"just saved").unwrap();

        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&dir.path().join("images"), &db_paths);

        assert!(
            recent.exists(),
            "recently-created file should be preserved (< 60s)"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn reconcile_skips_symlinked_subdir() {
        use std::os::windows::fs as winfs;

        let dir = tempfile::tempdir().unwrap();
        let images_dir = dir.path().join("images");
        fs::create_dir_all(&images_dir).unwrap();

        // Create a real directory with a file outside images/
        let external_dir = dir.path().join("external");
        fs::create_dir_all(&external_dir).unwrap();
        let external_file = external_dir.join("important.png");
        fs::write(&external_file, b"user data").unwrap();

        // Create a symlink inside images/ pointing to external dir
        let link = images_dir.join("2026-link");
        if winfs::symlink_dir(&external_dir, &link).is_err() {
            // Symlink creation requires elevated privileges on some Windows configs
            return;
        }

        let db_paths = std::collections::HashSet::new();
        reconcile_walk(&images_dir, &db_paths);

        assert!(
            external_file.exists(),
            "file in symlinked directory should NOT be deleted"
        );
    }
}

#[cfg(test)]
mod prune_validation_tests {
    use super::{validate_prune_max_items, MAX_PRUNE_LIMIT};

    #[test]
    fn validate_prune_accepts_in_range_values() {
        assert!(validate_prune_max_items(1).is_ok());
        assert!(validate_prune_max_items(100).is_ok());
        assert!(validate_prune_max_items(MAX_PRUNE_LIMIT).is_ok());
    }

    #[test]
    fn validate_prune_rejects_zero_or_negative() {
        assert!(validate_prune_max_items(0).is_err());
        assert!(validate_prune_max_items(-1).is_err());
        assert!(validate_prune_max_items(i64::MIN).is_err());
    }

    #[test]
    fn validate_prune_rejects_above_max() {
        assert!(validate_prune_max_items(MAX_PRUNE_LIMIT + 1).is_err());
        assert!(validate_prune_max_items(i64::MAX).is_err());
    }
}

#[cfg(test)]
mod db_core_tests {
    use super::*;

    /// Real production schema — built by the real migration runner.
    fn test_conn() -> rusqlite::Connection {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::migrations::run_migrations(&mut conn).unwrap();
        conn
    }

    fn insert(conn: &rusqlite::Connection, content: &str, hash: &str) -> i64 {
        upsert_item_core(conn, content, hash, None, None, None)
            .unwrap()
            .id
    }

    #[test]
    fn delayed_cleanup_preserves_readded_reference() {
        let dir = tempfile::tempdir().unwrap();
        let images = dir.path().join("images");
        fs::create_dir_all(&images).unwrap();
        let path = images.join("shared.png");
        fs::write(&path, b"synthetic png").unwrap();
        let conn = test_conn();
        let original = upsert_image_item_core(
            &conn,
            "original-image-hash",
            path.to_str().unwrap(),
            None,
            None,
        )
        .unwrap();
        let pending_path = delete_item_core(&conn, original.id).unwrap().unwrap();
        let pool = std::sync::Arc::new(parking_lot::Mutex::new(conn));
        let cleanup_pool = pool.clone();
        let (resume, delayed) = std::sync::mpsc::channel();
        let cleanup = std::thread::spawn(move || {
            delayed.recv().unwrap();
            let conn = cleanup_pool.lock();
            cleanup_image_files(&conn, &images, vec![pending_path]);
        });
        upsert_image_item_core(
            &pool.lock(),
            "original-image-hash",
            path.to_str().unwrap(),
            None,
            None,
        )
        .unwrap();
        resume.send(()).unwrap();
        cleanup.join().unwrap();
        assert!(path.exists(), "delayed cleanup erased a re-added reference");
    }

    #[test]
    fn restore_full_row_roundtrip_and_recopy() {
        let images = tempfile::tempdir().unwrap();
        for batch in [false, true] {
            let mut conn = test_conn();
            let content = "  full text\n".repeat(100);
            let row = upsert_item_core(
                &conn,
                &content,
                "full-hash",
                Some("<pre>full rich text</pre>"),
                Some("Editor"),
                Some("Document"),
            )
            .unwrap();
            conn.execute("UPDATE clipboard_items SET note='keep note', pinned=1, created_at='2025-01-02 03:04:05', last_used='2025-06-07 08:09:10'", []).unwrap();
            let original = query_items(&conn, 0).unwrap().remove(0);
            // Exercise the serialized full-row payload sent by the typed IPC wrapper.
            let payload: ClipboardItem =
                serde_json::from_value(serde_json::to_value(&original).unwrap()).unwrap();
            if batch {
                batch_delete_core(&mut conn, &[row.id]).unwrap();
            } else {
                delete_item_core(&conn, row.id).unwrap();
            }
            let restored = restore_item_core(&conn, images.path(), payload, None).unwrap();
            let mut expected = serde_json::to_value(&original).unwrap();
            expected["id"] = restored.id.into();
            assert_eq!(serde_json::to_value(&restored).unwrap(), expected);
            let recopied =
                upsert_item_core(&conn, &content, "full-hash", None, None, None).unwrap();
            assert_eq!(recopied.content, content);
            assert_eq!(
                recopied.html_content.as_deref(),
                Some("<pre>full rich text</pre>")
            );
            assert_eq!(recopied.note.as_deref(), Some("keep note"));
            assert!(recopied.starred);
            assert_eq!(query_items(&conn, 0).unwrap().len(), 1);
        }
    }

    #[test]
    fn restore_never_modifies_concurrently_readded_row() {
        let images = tempfile::tempdir().unwrap();
        let conn = test_conn();
        let old = upsert_item_core(
            &conn,
            &"old content".repeat(100),
            "same-hash",
            Some("old html"),
            Some("Old editor"),
            None,
        )
        .unwrap();
        delete_item_core(&conn, old.id).unwrap();
        upsert_item_core(
            &conn,
            &"full new content".repeat(100),
            "same-hash",
            Some("new html"),
            Some("New editor"),
            Some("New title"),
        )
        .unwrap();
        conn.execute("UPDATE clipboard_items SET note='new note', pinned=1, created_at='2026-01-01', last_used='2026-09-07'", []).unwrap();
        let current = query_items(&conn, 0).unwrap().remove(0);
        let restored = restore_item_core(&conn, images.path(), old, None).unwrap();
        assert_eq!(
            serde_json::to_value(restored).unwrap(),
            serde_json::to_value(current).unwrap()
        );
    }

    const PNG_SNAPSHOT: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6hVQAAAAASUVORK5CYII=";

    #[test]
    fn cleanup_completes_before_restore_or_recapture() {
        for undo in [true, false] {
            let dir = tempfile::tempdir().unwrap();
            let conn = test_conn();
            let hash = "0123456789abcdef0123456789abcdef";
            let original =
                save_image_item_core(&conn, dir.path(), PNG_SNAPSHOT, hash, None, None).unwrap();
            let path = delete_item_core(&conn, original.id).unwrap().unwrap();
            cleanup_image_files(&conn, dir.path(), vec![path.clone()]);
            assert!(
                !Path::new(&path).exists(),
                "cleanup must finish before the command resolves"
            );
            let restored = if undo {
                restore_item_core(&conn, dir.path(), original, Some(PNG_SNAPSHOT)).unwrap()
            } else {
                save_image_item_core(&conn, dir.path(), PNG_SNAPSHOT, hash, None, None).unwrap()
            };
            assert!(Path::new(restored.image_path.as_ref().unwrap()).exists());
            assert_eq!(query_items(&conn, 0).unwrap().len(), 1);
        }
    }

    #[test]
    fn reconcile_preserves_canonical_path_aliases() {
        let dir = tempfile::tempdir().unwrap();
        let images = dir.path().join("images");
        fs::create_dir_all(&images).unwrap();
        let path = images.join("alias.png");
        fs::write(&path, b"synthetic png").unwrap();
        fs::File::options()
            .write(true)
            .open(&path)
            .unwrap()
            .set_times(
                fs::FileTimes::new().set_modified(
                    std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000),
                ),
            )
            .unwrap();
        let conn = test_conn();
        upsert_image_item_core(
            &conn,
            "image-hash",
            path.canonicalize().unwrap().to_str().unwrap(),
            None,
            None,
        )
        .unwrap();
        reconcile_orphaned_images(&conn, dir.path());
        assert!(
            path.exists(),
            "extended/canonical path is still a live reference"
        );
    }

    #[test]
    fn reconcile_aborts_on_reference_decode_error() {
        let dir = tempfile::tempdir().unwrap();
        let images = dir.path().join("images");
        fs::create_dir_all(&images).unwrap();
        let path = images.join("referenced.png");
        fs::write(&path, b"synthetic png").unwrap();
        fs::File::options()
            .write(true)
            .open(&path)
            .unwrap()
            .set_times(
                fs::FileTimes::new().set_modified(
                    std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000),
                ),
            )
            .unwrap();
        let conn = test_conn();
        conn.execute("INSERT INTO clipboard_items (content, content_hash, image_path) VALUES ('image', 'hash', ?1)", [path.to_string_lossy().as_bytes()]).unwrap();
        reconcile_orphaned_images(&conn, dir.path());
        assert!(
            path.exists(),
            "an incomplete reference query must not authorize deletion"
        );
    }

    #[test]
    fn image_restore_rejects_missing_or_invalid_bytes_without_row() {
        let dir = tempfile::tempdir().unwrap();
        let conn = test_conn();
        let original = save_image_item_core(
            &conn,
            dir.path(),
            PNG_SNAPSHOT,
            "0123456789abcdef0123456789abcdef",
            None,
            None,
        )
        .unwrap();
        let path = delete_item_core(&conn, original.id).unwrap().unwrap();
        cleanup_image_files(&conn, dir.path(), vec![path.clone()]);
        for bytes in [None, Some(""), Some("not base64"), Some("aGVsbG8=")] {
            assert!(restore_item_core(&conn, dir.path(), original.clone(), bytes).is_err());
            assert!(query_items(&conn, 0).unwrap().is_empty());
            assert!(!Path::new(&path).exists());
        }
    }

    #[test]
    fn image_restore_keeps_metadata_and_survives_pending_cleanup() {
        let dir = tempfile::tempdir().unwrap();
        let conn = test_conn();
        save_image_item_core(
            &conn,
            dir.path(),
            PNG_SNAPSHOT,
            "0123456789abcdef0123456789abcdef",
            Some("Editor"),
            Some("Image"),
        )
        .unwrap();
        conn.execute("UPDATE clipboard_items SET note='image note', pinned=1, created_at='2025-01-02', last_used='2025-02-03'", []).unwrap();
        let original = query_items(&conn, 0).unwrap().remove(0);
        let pending = delete_item_core(&conn, original.id).unwrap().unwrap();
        let restored =
            restore_item_core(&conn, dir.path(), original.clone(), Some(PNG_SNAPSHOT)).unwrap();
        cleanup_image_files(&conn, dir.path(), vec![pending]);
        assert_eq!(restored.note.as_deref(), Some("image note"));
        assert_eq!(restored.created_at, "2025-01-02");
        assert_eq!(restored.last_used, "2025-02-03");
        assert!(restored.starred);
        let bytes = fs::read(restored.image_path.as_ref().unwrap()).unwrap();
        use base64::Engine;
        assert_eq!(
            base64::engine::general_purpose::STANDARD.encode(bytes),
            PNG_SNAPSHOT
        );
        // A subsequent Undo must not overwrite the current row or write any new file.
        update_note_core(&conn, restored.id, "new image note").unwrap();
        let again =
            restore_item_core(&conn, dir.path(), original, Some("invalid snapshot")).unwrap();
        assert_eq!(again.id, restored.id);
        assert_eq!(again.note.as_deref(), Some("new image note"));
    }

    #[test]
    fn upsert_same_hash_dedupes_and_bumps_last_used() {
        let conn = test_conn();
        let id1 = insert(&conn, "hello", "h1");
        conn.execute(
            "UPDATE clipboard_items SET last_used = '2000-01-01 00:00:00'",
            [],
        )
        .unwrap();
        let id2 = insert(&conn, "hello", "h1");
        assert_eq!(id1, id2);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let last: String = conn
            .query_row("SELECT last_used FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_ne!(last, "2000-01-01 00:00:00", "upsert must bump last_used");
    }

    #[test]
    fn toggle_star_core_sets_pinned() {
        let conn = test_conn();
        let id = insert(&conn, "a", "h1");
        toggle_star_core(&conn, id, true).unwrap();
        let pinned: i64 = conn
            .query_row(
                "SELECT pinned FROM clipboard_items WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(pinned, 1);
        toggle_star_core(&conn, id, false).unwrap();
        let pinned: i64 = conn
            .query_row(
                "SELECT pinned FROM clipboard_items WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(pinned, 0);
    }

    #[test]
    fn touch_item_core_bumps_last_used() {
        let conn = test_conn();
        let id = insert(&conn, "a", "h1");
        conn.execute(
            "UPDATE clipboard_items SET last_used = '2000-01-01 00:00:00'",
            [],
        )
        .unwrap();
        touch_item_core(&conn, id).unwrap();
        let last: String = conn
            .query_row(
                "SELECT last_used FROM clipboard_items WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_ne!(last, "2000-01-01 00:00:00", "touch must bump last_used");
    }

    #[test]
    fn update_note_core_sets_and_clears() {
        let conn = test_conn();
        let id = insert(&conn, "a", "h1");
        update_note_core(&conn, id, "note text").unwrap();
        let note: Option<String> = conn
            .query_row("SELECT note FROM clipboard_items WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(note.as_deref(), Some("note text"));
        update_note_core(&conn, id, "").unwrap();
        let note: Option<String> = conn
            .query_row("SELECT note FROM clipboard_items WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(note, None, "empty note stored as NULL");
    }

    #[test]
    fn clear_unstarred_core_keeps_starred_returns_image_paths() {
        let mut conn = test_conn();
        let keep = insert(&conn, "starred", "h1");
        toggle_star_core(&conn, keep, true).unwrap();
        insert(&conn, "gone", "h2");
        conn.execute(
            "INSERT INTO clipboard_items (content, content_hash, content_type, image_path) VALUES ('img','h3','image','C:/img/x.png')",
            [],
        ).unwrap();
        let paths = clear_unstarred_core(&mut conn).unwrap();
        assert_eq!(
            paths,
            vec!["C:/img/x.png".to_string()],
            "unpinned image paths returned for cleanup"
        );
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total, 1, "only the starred row survives");
    }

    #[test]
    fn prune_core_keeps_pinned_and_newest() {
        let conn = test_conn();
        let pinned = insert(&conn, "pinned", "hp");
        toggle_star_core(&conn, pinned, true).unwrap();
        let mut ids = Vec::new();
        for i in 0..10 {
            let id = insert(&conn, &format!("item{i}"), &format!("h{i}"));
            // Distinct last_used per row ('2001-01-01'..'2001-01-10') — avoids
            // same-second ties so "newest" is well-defined.
            conn.execute(
                "UPDATE clipboard_items SET last_used = ?1 WHERE id = ?2",
                rusqlite::params![format!("2001-01-{:02} 00:00:00", i + 1), id],
            )
            .unwrap();
            ids.push(id);
        }
        // Oldest row carries an image path (must be returned for cleanup);
        // the newest (a survivor) carries one too (must NOT be returned).
        conn.execute(
            "UPDATE clipboard_items SET content_type='image', image_path='C:/img/pruned.png' WHERE id=?1",
            [ids[0]],
        )
        .unwrap();
        conn.execute(
            "UPDATE clipboard_items SET content_type='image', image_path='C:/img/survivor.png' WHERE id=?1",
            [ids[9]],
        )
        .unwrap();
        let paths = prune_old_items_core(&conn, 3).unwrap();
        assert!(
            paths.contains(&"C:/img/pruned.png".to_string()),
            "pruned row's image path returned for cleanup"
        );
        assert!(
            !paths.contains(&"C:/img/survivor.png".to_string()),
            "surviving row's image path must not be returned"
        );
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total, 4, "3 newest unpinned + 1 pinned survive");
        let p: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clipboard_items WHERE pinned=1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(p, 1);
        // Survivors are exactly the 3 unpinned rows with the newest last_used.
        let mut survivors: Vec<i64> = conn
            .prepare("SELECT id FROM clipboard_items WHERE pinned=0")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        survivors.sort_unstable();
        let mut expected = vec![ids[7], ids[8], ids[9]];
        expected.sort_unstable();
        assert_eq!(
            survivors, expected,
            "survivors are the 3 newest unpinned rows"
        );
    }

    #[test]
    fn delete_older_than_core_zero_days_is_noop_and_respects_cap() {
        let conn = test_conn();
        insert(&conn, "a", "h1");
        let (n, _) = delete_older_than_core(&conn, 0).unwrap();
        assert_eq!(n, 0);
        // One old image row, strictly oldest so it's deterministically inside the
        // capped oldest-first collection window — pins the path-return contract.
        conn.execute(
            "INSERT INTO clipboard_items (content, content_hash, content_type, image_path, created_at) VALUES ('img','oimg','image','C:/img/old.png','1999-01-01 00:00:00')",
            [],
        ).unwrap();
        // cap: insert 60 old unpinned rows, expect at most MAX_AUTO_DELETE_BATCH deleted
        for i in 0..60 {
            conn.execute(
                "INSERT INTO clipboard_items (content, content_hash, created_at) VALUES (?1, ?2, '2000-01-01 00:00:00')",
                rusqlite::params![format!("old{i}"), format!("oh{i}")],
            ).unwrap();
        }
        let (n, paths) = delete_older_than_core(&conn, 30).unwrap();
        assert_eq!(n, MAX_AUTO_DELETE_BATCH, "deletion is capped");
        assert!(
            paths.contains(&"C:/img/old.png".to_string()),
            "deleted old image row's path returned for cleanup"
        );
    }

    #[test]
    fn batch_delete_core_chunks_over_500_params() {
        let mut conn = test_conn();
        // Survivor whose id is NOT in the delete set — must remain untouched.
        let survivor = insert(&conn, "survivor", "sv");
        let mut ids = Vec::new();
        for i in 0..510 {
            ids.push(insert(&conn, &format!("c{i}"), &format!("bh{i}")));
        }
        // One of the doomed rows is an image — its path must come back for cleanup.
        conn.execute(
            "UPDATE clipboard_items SET content_type='image', image_path='C:/img/batch.png' WHERE id=?1",
            [ids[0]],
        )
        .unwrap();
        let paths = batch_delete_core(&mut conn, &ids).unwrap();
        assert_eq!(
            paths,
            vec!["C:/img/batch.png".to_string()],
            "deleted image row's path returned for cleanup"
        );
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total, 1, "all 510 deleted across two chunks, survivor kept");
        let remaining: i64 = conn
            .query_row("SELECT id FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, survivor, "row outside the id set must survive");
    }

    #[test]
    fn query_items_includes_all_pinned_beyond_limit() {
        let conn = test_conn();
        let p = insert(&conn, "pinned-old", "qp");
        toggle_star_core(&conn, p, true).unwrap();
        conn.execute(
            "UPDATE clipboard_items SET last_used='2000-01-01 00:00:00' WHERE id=?1",
            [p],
        )
        .unwrap();
        for i in 0..5 {
            insert(&conn, &format!("new{i}"), &format!("qh{i}"));
        }
        let items = query_items(&conn, 2).unwrap();
        assert_eq!(items.len(), 3, "2 newest unpinned + the pinned one");
        assert!(items.iter().any(|i| i.id == p));
    }

    #[test]
    fn delete_item_core_returns_image_path() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO clipboard_items (content, content_hash, content_type, image_path) VALUES ('img','dh','image','C:/img/y.png')",
            [],
        ).unwrap();
        let id: i64 = conn
            .query_row(
                "SELECT id FROM clipboard_items WHERE content_hash='dh'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let path = delete_item_core(&conn, id).unwrap();
        assert_eq!(path.as_deref(), Some("C:/img/y.png"));
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total, 0, "deleted row is gone");
    }

    #[test]
    fn upsert_image_same_hash_dedupes() {
        let conn = test_conn();
        let item1 =
            upsert_image_item_core(&conn, "abcdef1234567890", "C:/img/a.png", None, None).unwrap();
        let item2 =
            upsert_image_item_core(&conn, "abcdef1234567890", "C:/img/a.png", None, None).unwrap();
        assert_eq!(item1.id, item2.id, "same hash must return same id");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "duplicate hash must not insert a second row");
    }

    #[test]
    fn upsert_coalesce_preserves_source_on_none() {
        let conn = test_conn();
        // First upsert — set source_app
        upsert_item_core(&conn, "hello", "hash1", None, Some("app1"), None).unwrap();
        // Second upsert same hash — source_app=None must not overwrite existing value
        let item = upsert_item_core(&conn, "hello", "hash1", None, None, None).unwrap();
        assert_eq!(
            item.source_app.as_deref(),
            Some("app1"),
            "COALESCE must preserve existing source_app when new value is None"
        );
    }
}
