//! Schema migrations for clipboard.db. Append-only: never edit an existing
//! migration; add a new (version, description, sql) tuple instead.

use crate::error::AppError;
use tracing::info;

/// Run all DB migrations using a simple version table.
pub fn run_migrations(conn: &mut rusqlite::Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    let applied: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT version FROM _migrations ORDER BY version")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let migrations: &[(i64, &str, &str)] = &[
        (
            1,
            "create_clipboard_items",
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_hash
                ON clipboard_items(content_hash);
            CREATE INDEX IF NOT EXISTS idx_pinned_last_used
                ON clipboard_items(pinned DESC, last_used DESC);",
        ),
        (
            2,
            "add_image_support",
            "ALTER TABLE clipboard_items ADD COLUMN content_type TEXT NOT NULL DEFAULT 'text';
             ALTER TABLE clipboard_items ADD COLUMN image_path TEXT;",
        ),
        (
            3,
            "create_snippets",
            "CREATE TABLE IF NOT EXISTS snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        ),
        (
            4,
            "add_snippet_groups",
            "CREATE TABLE IF NOT EXISTS snippet_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            ALTER TABLE snippets ADD COLUMN group_id INTEGER REFERENCES snippet_groups(id) ON DELETE SET NULL;",
        ),
        (
            5,
            "add_html_content",
            "ALTER TABLE clipboard_items ADD COLUMN html_content TEXT;",
        ),
        (
            6,
            "add_note_column",
            "ALTER TABLE clipboard_items ADD COLUMN note TEXT;",
        ),
        (
            7,
            "drop_unused_snippet_tables",
            "DROP TABLE IF EXISTS snippets;
             DROP TABLE IF EXISTS snippet_groups;",
        ),
        (
            8,
            "add_source_app",
            "ALTER TABLE clipboard_items ADD COLUMN source_app TEXT;",
        ),
        (
            9,
            "add_source_title",
            "ALTER TABLE clipboard_items ADD COLUMN source_title TEXT;",
        ),
        (
            10,
            "create_app_icons_cache",
            "CREATE TABLE IF NOT EXISTS app_icons (
                exe_name TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                icon_base64 TEXT
            );",
        ),
        (
            11,
            "clear_app_icons_for_png",
            "DELETE FROM app_icons;",
        ),
        (
            12,
            "add_exe_path_to_app_icons",
            "ALTER TABLE app_icons ADD COLUMN exe_path TEXT;",
        ),
        (
            13,
            "add_updated_at_to_app_icons",
            "ALTER TABLE app_icons ADD COLUMN updated_at TEXT;",
        ),
    ];

    for (version, description, sql) in migrations {
        if applied.contains(version) {
            continue;
        }

        info!(version, description, "applying migration");
        let tx = conn.transaction()?;
        match tx.execute_batch(sql) {
            Ok(()) => {
                tx.execute(
                    "INSERT OR IGNORE INTO _migrations (version, description) VALUES (?1, ?2)",
                    rusqlite::params![version, description],
                )?;
                tx.commit()?;
            }
            Err(e) => {
                let err_str = e.to_string();
                // Idempotency: tolerate re-running migrations on already-migrated DBs
                let is_idempotent = (sql.contains("ALTER TABLE")
                    && (err_str.contains("duplicate column")
                        || err_str.contains("already exists")))
                    || (sql.contains("DROP TABLE IF EXISTS") && err_str.contains("no such table"))
                    || (sql.contains("CREATE TABLE IF NOT EXISTS")
                        && err_str.contains("already exists"))
                    || (sql.contains("CREATE INDEX IF NOT EXISTS")
                        && err_str.contains("already exists"));
                if is_idempotent {
                    info!(version, "migration already applied, recording");
                    drop(tx); // implicit rollback — safe, schema already matches
                              // Record outside transaction: DDL was already applied, just bookkeep
                    conn.execute(
                        "INSERT OR IGNORE INTO _migrations (version, description) VALUES (?1, ?2)",
                        rusqlite::params![version, description],
                    )?;
                } else {
                    drop(tx);
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_conn() -> rusqlite::Connection {
        rusqlite::Connection::open_in_memory().expect("in-memory db")
    }

    #[test]
    fn applies_all_migrations_on_fresh_db() {
        let mut conn = fresh_conn();
        run_migrations(&mut conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM _migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 13, "all 13 migrations recorded");
    }

    #[test]
    fn produces_expected_clipboard_items_schema() {
        let mut conn = fresh_conn();
        run_migrations(&mut conn).unwrap();
        let mut stmt = conn.prepare("PRAGMA table_info(clipboard_items)").unwrap();
        let cols: Vec<String> = stmt
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .filter_map(Result::ok)
            .collect();
        for expected in [
            "id",
            "content",
            "content_hash",
            "content_type",
            "image_path",
            "html_content",
            "note",
            "pinned",
            "created_at",
            "last_used",
            "source_app",
            "source_title",
        ] {
            assert!(
                cols.iter().any(|c| c == expected),
                "missing column {expected}"
            );
        }
    }

    #[test]
    fn rerun_is_idempotent() {
        let mut conn = fresh_conn();
        run_migrations(&mut conn).unwrap();
        run_migrations(&mut conn).unwrap(); // second run must be a no-op
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM _migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 13);
    }

    /// Simulates the legacy path the string-matching fallback exists for:
    /// schema already matches but _migrations is empty (pre-versioning DB).
    #[test]
    fn tolerates_already_migrated_schema_without_version_rows() {
        let mut conn = fresh_conn();
        run_migrations(&mut conn).unwrap();
        conn.execute("DELETE FROM _migrations", []).unwrap();
        run_migrations(&mut conn).unwrap(); // must record all 13 via fallback, not error
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM _migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 13);
    }
}
