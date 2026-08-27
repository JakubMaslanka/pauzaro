# SQLite Persistence Scaffold — Plan Brief

> Full plan: `context/changes/sqlite-persistence-scaffold/plan.md`

## What & Why

Wire `rusqlite` into the Tauri 2 app with a forward-only migration runner. This is foundation F-01 — the persistence layer that all downstream slices depend on (habits, completions, streaks). PRD mandates local-only data storage; SQLite via rusqlite delivers that with zero network dependencies.

## Starting Point

Pristine Tauri 2 scaffold. No database dependency, no module structure, no AppState. Only a stub `greet` command exists. `src-tauri/CLAUDE.md` prescribes patterns (AppState, migrations, repository) but none are implemented.

## Desired End State

App opens/creates `pauzaro.db` in the OS app data directory on startup. A migration runner tracked by `schema_version` table applies pending SQL migrations in order. `Database` is accessible in Tauri commands via managed state. Integration test proves the runner works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| SQLite crate | `rusqlite` with `bundled` feature | Full Rust-side control, type-safe repos, matches CLAUDE.md patterns; bundled feature ensures cross-platform builds. |
| Migration approach | In-code const array + `schema_version` table | Zero external tooling, forward-only is acceptable for local-only app; version tracking needed for ALTER TABLE migrations. |
| Schema scope for F-01 | `schema_version` only (no domain tables) | Clean separation — F-01 owns infrastructure, S-01 owns domain tables. |
| Module structure | `db/mod.rs` + `db/migrations.rs` + `error.rs` | Enough structure for repos to plug into (S-01 adds `db/habits.rs`), without YAGNI empty files. |
| Testing | Integration test with temp DB | Proves migration runner end-to-end; unit testing a const array has no value. |

## Scope

**In scope:**
- `rusqlite` dependency with bundled SQLite
- `Database` struct with connection management
- Forward-only migration runner with `schema_version` tracking
- `AppError` type with `From<rusqlite::Error>`
- `AppState` wired into Tauri setup hook
- Integration test with temp DB

**Out of scope:**
- Domain tables, repositories, Tauri commands for data (S-01+)
- Frontend integration (S-01+)
- Async DB, WAL mode, connection pooling (not needed for single-user)

## Architecture / Approach

```
Tauri setup hook
  └─ Database::open(app_data_dir/pauzaro.db)
       └─ migrations::run_migrations(conn)
            └─ CREATE schema_version IF NOT EXISTS
            └─ Apply MIGRATIONS[current_version..]
  └─ app.manage(AppState { db: Mutex<Database> })

Future commands (S-01+):
  #[tauri::command]
  fn create_habit(state: State<AppState>) -> Result<Habit, AppError>
       └─ state.db.lock() -> &Connection -> HabitRepository
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. SQLite Foundation | rusqlite wired, migration runner operational, AppState managed, integration test green | `rusqlite` bundled compilation on first build (~30s); Tauri `app_data_dir` API surface |

**Prerequisites:** None (F-01 is the first item in the dependency chain)
**Estimated effort:** ~1 session, single phase

## Open Risks & Assumptions

- `rusqlite` 0.34 bundled feature compiles cleanly on macOS with Tauri 2 build pipeline (high confidence, widely used combo)
- `app.path().app_data_dir()` returns a writable path on both macOS and Windows (standard Tauri API)

## Success Criteria (Summary)

- `cd src-tauri && cargo test` passes — migration runner verified
- App launches via `pnpm tauri dev` without DB errors
- `pauzaro.db` file appears in app data directory on first launch
