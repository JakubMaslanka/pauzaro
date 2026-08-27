use pauzaro_lib::AppState;
use std::sync::Mutex;
use tempfile::NamedTempFile;

#[test]
fn migration_runner_creates_schema_version_table() {
    let temp = NamedTempFile::new().expect("failed to create temp file");
    let db = pauzaro_lib::db::Database::open(temp.path())
        .expect("failed to open database");

    let version: usize = db
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("schema_version table should exist");

    assert_eq!(version, 0, "version should be 0 with no migrations");
}

#[test]
fn database_open_is_idempotent() {
    let temp = NamedTempFile::new().expect("failed to create temp file");

    let db1 = pauzaro_lib::db::Database::open(temp.path())
        .expect("first open should succeed");
    drop(db1);

    let db2 = pauzaro_lib::db::Database::open(temp.path())
        .expect("second open should succeed");

    let version: usize = db2
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("schema_version table should exist after second open");

    assert_eq!(version, 0, "version should remain 0");
}

#[test]
fn app_state_wraps_database_in_mutex() {
    let temp = NamedTempFile::new().expect("failed to create temp file");
    let db = pauzaro_lib::db::Database::open(temp.path())
        .expect("failed to open database");

    let state = AppState {
        db: Mutex::new(db),
    };

    let locked = state.db.lock().expect("mutex should not be poisoned");
    let version: usize = locked
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("should query through AppState");

    assert_eq!(version, 0);
}
