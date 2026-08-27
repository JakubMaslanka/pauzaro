use rusqlite::Connection;

use crate::error::AppError;

/// Forward-only migrations. Each entry is a SQL string applied in order.
/// Domain tables are added by downstream slices (S-01, S-02).
const MIGRATIONS: &[&str] = &[
    // Migration 0: user_profile table
    "CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )",
    // Migration 1: habits + schedule tables with indexes
    "CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL,
        icon_color TEXT NOT NULL DEFAULT '#000000',
        icon_stroke_width REAL NOT NULL DEFAULT 2.0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_schedule_days (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6)
    );

    CREATE TABLE IF NOT EXISTS habit_schedule_times (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_habit_schedule_days_habit_id ON habit_schedule_days(habit_id);
    CREATE INDEX IF NOT EXISTS idx_habit_schedule_times_habit_id ON habit_schedule_times(habit_id);",
];

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
