use rusqlite::Connection;

use crate::error::AppError;

/// Forward-only migrations. Each entry is a SQL string applied in order.
/// Domain tables are added by downstream slices (S-01, S-02).
const MIGRATIONS: &[&str] = &[];

/// Applies pending migrations tracked by `schema_version`.
///
/// Creates the `schema_version` table if it doesn't exist, reads the current
/// version, and applies all migrations from that index onward. Updates the
/// version after each successful migration.
pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL DEFAULT 0
        )",
    )?;

    let has_row: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM schema_version",
        [],
        |row| row.get(0),
    )?;

    if !has_row {
        conn.execute("INSERT INTO schema_version (version) VALUES (0)", [])?;
    }

    let current_version: usize = conn.query_row(
        "SELECT version FROM schema_version LIMIT 1",
        [],
        |row| row.get(0),
    )?;

    for (i, migration) in MIGRATIONS.iter().enumerate().skip(current_version) {
        conn.execute_batch(migration)?;
        conn.execute(
            "UPDATE schema_version SET version = ?1",
            [i + 1],
        )?;
    }

    Ok(())
}
