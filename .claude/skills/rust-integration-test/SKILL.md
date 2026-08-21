---
name: rust-integration-test
description: Create and run isolated Rust integration tests against a temporary SQLite database. Creates fresh DB, runs migrations, executes test suite, tears down DB. Use when adding or verifying Rust backend logic (Tauri commands, data access, business rules).
---

## Rust Integration Test Skill

Generate and run integration tests for Rust backend code that use an **isolated temporary SQLite database** per test run.

### Architecture

```
src-tauri/
  src/
    lib.rs          # Tauri commands + app logic
    db.rs           # Database module (connections, migrations, queries)
  tests/
    common/mod.rs   # Shared test utilities (DB setup/teardown)
    *.rs            # Integration test files
  migrations/       # SQL migration files (if using file-based migrations)
```

### Test Database Pattern

Every integration test gets its own temporary SQLite file. This ensures:
- Full isolation — parallel tests never collide
- Real SQL execution — no mocks, actual SQLite behavior
- Automatic cleanup — temp file removed after test

#### Shared Test Harness (`tests/common/mod.rs`)

The test harness must provide:

1. **`TestDb` struct** — wraps a `rusqlite::Connection` and the temp file path
2. **`TestDb::new()`** — creates a uniquely-named temp DB file (use `std::time` nanos or `uuid`), opens connection, runs all migrations, returns `TestDb`
3. **`Drop` impl for `TestDb`** — closes connection and deletes the temp DB file
4. **`TestDb::connection(&self)`** — returns a reference to the active connection for test queries

```rust
pub struct TestDb {
    pub conn: rusqlite::Connection,
    path: std::path::PathBuf,
}

impl TestDb {
    pub fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "pauzaro_test_{}.db",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let conn = rusqlite::Connection::open(&path).unwrap();
        // Run migrations here
        run_migrations(&conn);
        Self { conn, path }
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        // Connection drops automatically, then remove file
        let _ = std::fs::remove_file(&self.path);
    }
}
```

### Writing Integration Tests

Each test file in `tests/` focuses on one domain area. Pattern:

```rust
mod common;

use common::TestDb;

#[test]
fn test_create_and_retrieve_habit() {
    let db = TestDb::new();

    // Act: insert via the same function the Tauri command uses
    create_habit(&db.conn, "Pull-ups", 5, "daily");

    // Assert: query back and verify
    let habits = list_habits(&db.conn);
    assert_eq!(habits.len(), 1);
    assert_eq!(habits[0].name, "Pull-ups");
    assert_eq!(habits[0].target, 5);
}

#[test]
fn test_streak_calculation() {
    let db = TestDb::new();
    // ... seed data, run logic, assert streak state
}
```

### Rules

1. **Every test creates its own `TestDb`** — no shared state between tests
2. **Test functions call the same Rust functions that Tauri commands call** — test the logic layer, not the Tauri IPC boundary
3. **Seed data inside each test** — explicit setup, not fixtures. Use helper functions in `common/` for repeated seed patterns
4. **Name tests descriptively**: `test_<action>_<expected_outcome>` (e.g., `test_complete_habit_increments_streak`)
5. **Assert specific values**, not just "no panic". Check row counts, field values, edge cases
6. **Migrations must be idempotent** — `CREATE TABLE IF NOT EXISTS` so TestDb::new() never fails on schema

### Running Tests

```bash
cd src-tauri && cargo test
```

Single test:
```bash
cd src-tauri && cargo test test_name
```

With output:
```bash
cd src-tauri && cargo test -- --nocapture
```

### When to Use This Skill

- Adding a new Tauri command that reads/writes SQLite
- Changing database schema (migrations)
- Adding business logic that depends on persisted state (streaks, habits, schedules)
- Verifying data integrity rules (unique constraints, cascading deletes)

### Dependencies Required

Ensure `src-tauri/Cargo.toml` has:

```toml
[dependencies]
rusqlite = { version = "0.32", features = ["bundled"] }

[dev-dependencies]
rusqlite = { version = "0.32", features = ["bundled"] }
```

The `bundled` feature compiles SQLite from source — no system SQLite dependency, consistent behavior across dev machines and CI.

### Generating Tests

When asked to create integration tests for a feature:

1. Check if `tests/common/mod.rs` exists — create it if not (using the TestDb pattern above)
2. Check if `rusqlite` is in `Cargo.toml` dev-dependencies — add if missing
3. Identify all database-touching functions for the feature
4. Create a test file `tests/<feature>.rs` with tests covering:
   - Happy path (create, read, update, delete)
   - Edge cases (empty results, duplicates, constraint violations)
   - Business rules (streak logic, scheduling, limits)
5. Run `cd src-tauri && cargo test` to verify all pass
