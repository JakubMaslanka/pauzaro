# SQLite Persistence Scaffold — Implementation Plan

## Overview

Wire `rusqlite` into the Tauri 2 app with a forward-only migration runner tracked by a `schema_version` table. This is the persistence foundation — all downstream slices (S-01 habits, S-02 completions/streaks, S-04 freeze state) build on it.

## Current State Analysis

Pristine Tauri 2 scaffold. `src-tauri/src/lib.rs` contains only the default `greet` command. No database dependency, no module structure beyond `lib.rs` + `main.rs`, no AppState.

`src-tauri/CLAUDE.md` prescribes patterns (AppState with `Mutex<Database>`, repository pattern, `AppError` with `From<rusqlite::Error>`, migration const array) — none are implemented yet.

### Key Discoveries:

- `src-tauri/src/lib.rs:7-14` — bare setup with only `tauri_plugin_opener::init()` and `greet` handler
- `src-tauri/Cargo.toml:20-25` — only tauri, serde, opener plugin as dependencies
- `src-tauri/CLAUDE.md:34-53` — prescribes `AppState { db: Mutex<Database> }` initialized in setup hook
- `src-tauri/CLAUDE.md:91-118` — migration pattern using `MIGRATIONS` const array with `IF NOT EXISTS` guards
- `src-tauri/CLAUDE.md:62-86` — `AppError` enum with `From<rusqlite::Error>` impl
- `src-tauri/CLAUDE.md:233-251` — target module layout: `error.rs`, `db/mod.rs`, `db/migrations.rs`, repo files

## Desired End State

Tauri app opens/creates a SQLite database file in `app_data_dir` on startup. A forward-only migration runner applies pending migrations tracked by a `schema_version` table. `Database` is accessible in all Tauri commands via `tauri::State<AppState>`. An integration test proves the migration runner works with a temp DB.

**Verification:** `cd src-tauri && cargo test` passes, app launches without errors via `pnpm tauri dev`, and `pauzaro.db` appears in the app data directory.

## What We're NOT Doing

- Domain tables (habits, completions, streaks) — S-01 / S-02 scope
- Repository structs — added per domain in S-01+
- Tauri commands for DB operations — S-01 scope
- Frontend DB integration / typed invoke wrappers — S-01 scope
- Async DB access — rusqlite is sync; `spawn_blocking` wrapper if needed later
- WAL mode — single-user, single-connection; no concurrency concerns yet

## Implementation Approach

Add `rusqlite` (with `bundled` feature for cross-platform builds) to `Cargo.toml`. Create `db` module (`mod.rs` for `Database` struct, `migrations.rs` for the runner). Create `error.rs` with `AppError`. Wire `Database` into Tauri's setup hook as managed `AppState`. Verify end-to-end with an integration test using a temp file.

## Phase 1: SQLite Foundation

### Overview

Add rusqlite dependency, create Database struct with migration runner, wire into Tauri app lifecycle, verify with integration test.

### Changes Required:

#### 1. Rusqlite dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add rusqlite crate with `bundled` feature so SQLite is compiled from source — no system SQLite dependency needed for cross-platform desktop builds.

**Contract**: `rusqlite = { version = "0.34", features = ["bundled"] }` added to `[dependencies]`.

#### 2. Error module

**File**: `src-tauri/src/error.rs`

**Intent**: Centralized error type for all Tauri commands. Implements `Serialize` for the IPC boundary and `From<rusqlite::Error>` for `?` propagation from DB code.

**Contract**: `AppError` enum with at minimum `Database(String)` variant. Implements `Display`, `Serialize`, `From<rusqlite::Error>`. Follows the pattern prescribed in `src-tauri/CLAUDE.md:62-86`. Future slices add `Validation`, `NotFound` variants.

#### 3. Database struct

**File**: `src-tauri/src/db/mod.rs`

**Intent**: Owns the rusqlite `Connection`. Opens/creates the SQLite file at a given path and runs migrations on open.

**Contract**: `Database::open(path: impl AsRef<Path>) -> Result<Self, AppError>`. Internally calls `migrations::run_migrations(&conn)` after opening. Exposes `connection(&self) -> &Connection` for future repository structs. Re-exports `migrations` submodule.

#### 4. Migration runner

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Forward-only migration runner using a version-tracked const array. Creates a `schema_version` table to track the last applied migration index. The `MIGRATIONS` array starts empty — domain tables are added by S-01.

**Contract**:
- `MIGRATIONS: &[&str]` — const array of SQL strings, indexed from 0
- `run_migrations(conn: &Connection) -> Result<(), AppError>` — creates `schema_version` table if missing, reads current version, applies pending migrations in order, updates version after each
- `schema_version` table: single row, `version INTEGER NOT NULL DEFAULT 0`

```sql
-- Created by the runner itself, not in the MIGRATIONS array
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL DEFAULT 0
);
```

#### 5. Tauri setup wiring

**File**: `src-tauri/src/lib.rs`

**Intent**: Initialize `Database` in Tauri's setup hook, wrap in `AppState`, register as managed state. Declare `mod db` and `mod error`.

**Contract**:
- `AppState { pub db: Mutex<Database> }` struct
- Setup hook calls `Database::open(app.path().app_data_dir()?.join("pauzaro.db"))`
- `app.manage(AppState { db: Mutex::new(db) })`
- Keep existing `greet` command for now (S-01 replaces it with domain commands)

#### 6. Integration test

**File**: `src-tauri/tests/db_integration.rs`

**Intent**: Prove the migration runner works end-to-end — open a temp DB, run migrations, verify `schema_version` exists with the correct version.

**Contract**: Test creates a temp file via `tempfile` crate (dev-dependency), opens `Database`, queries `schema_version` table, asserts version equals `MIGRATIONS.len()`. Temp file auto-cleaned on drop. Add `tempfile` to `[dev-dependencies]` in `Cargo.toml`.

### Success Criteria:

#### Automated Verification:

- Rust compiles cleanly: `cd src-tauri && cargo check`
- All tests pass: `cd src-tauri && cargo test`
- Integration test verifies migration runner: `cd src-tauri && cargo test --test db_integration`

#### Manual Verification:

- App launches via `pnpm tauri dev` without errors
- SQLite file created in app data directory
- No console errors related to database

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Integration Tests:

- `Database::open` creates DB file and runs migrations
- `schema_version` table exists and contains correct version (0 when MIGRATIONS is empty)
- Idempotent: opening same DB path twice doesn't fail or re-run applied migrations

### Manual Testing Steps:

1. Run `pnpm tauri dev` — app should launch normally
2. Check app data directory for `pauzaro.db` file
3. Open DB with `sqlite3` CLI, verify `schema_version` table exists

## Performance Considerations

- `rusqlite` `bundled` feature adds ~30s to first compile (compiles SQLite from C source) — cached after that
- Single connection with `Mutex` is sufficient for single-user desktop app
- No indexing needed until domain tables arrive in S-01

## Migration Notes

Greenfield — no existing data. The `schema_version` tracking ensures future migrations (S-01 adds habits table, S-02 adds completions) apply cleanly to existing DB files without re-running prior migrations.

## References

- Prescriptive Rust patterns: `src-tauri/CLAUDE.md:91-118` (migrations), `src-tauri/CLAUDE.md:34-53` (AppState)
- Roadmap item: `context/foundation/roadmap.md` lines 62-73 (F-01)
- PRD NFR: `context/foundation/prd.md:119` (data never leaves device)
- Change folder: `context/changes/sqlite-persistence-scaffold/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SQLite Foundation

#### Automated

- [x] 1.1 Rust compiles cleanly: `cd src-tauri && cargo check` — a1ce762
- [x] 1.2 All tests pass: `cd src-tauri && cargo test` — a1ce762
- [x] 1.3 Integration test verifies migration runner: `cd src-tauri && cargo test --test db_integration` — a1ce762

#### Manual

- [x] 1.4 App launches via `pnpm tauri dev` without errors — a1ce762
- [x] 1.5 SQLite file created in app data directory — a1ce762
- [x] 1.6 No console errors related to database — a1ce762
