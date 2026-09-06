# Scheduler + Overlay Reliability Tests — Plan Brief

> Full plan: `context/changes/testing-scheduler-overlay/plan.md`

## What & Why

Add integration tests for the scheduler run loop and frontend tests for the overlay panel — Phase 2 of the test plan. The scheduler loop (`Scheduler::run()`) and overlay UI (`OverlayPanel.tsx`) are the two most critical untested paths in the app: if the overlay doesn't fire at the scheduled time (Risk #1) or the dashboard doesn't update after an overlay action (Risk #4), the product is broken.

## Starting Point

`find_next_trigger()` has 7 unit tests and overlay DB flows have 8 integration tests — but `Scheduler::run()` (the async loop that actually fires overlays) has zero tests because it's tightly coupled to `tauri::AppHandle` for DB access and `WebviewWindowBuilder` for window creation. `OverlayPanel.tsx` has zero frontend tests. Shared test helpers (`setup_db`, `sample_habit_input`) are duplicated across 2 integration test files.

## Desired End State

Scheduler run loop proven correct via 4 integration tests with mock overlay spawner + real SQLite + deterministic time control. OverlayPanel proven correct via 4 frontend tests covering done, snooze, auto-snooze timer, and loading state. Test helpers extracted to shared module. All existing tests unaffected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test scope | Rust backend + OverlayPanel frontend | Highest signal-per-effort; dashboard sync tested at event boundary only | Plan |
| Scheduler testability | OverlaySpawner trait + tokio::time::pause | Minimal production refactor — one trait for window creation, built-in tokio time control for clock | Plan |
| Command handler tests | Stay at DB integration level | DB flows already well tested; command wiring refactor not worth the cost | Plan |
| Scheduler scenarios | 4 must-test (fire, wake, snooze re-fire, completed skip) | Covers Risk #1 directly with minimum test count | Plan |
| OverlayPanel tests | 4 tests (done, snooze, auto-snooze, loading) | Three distinct user paths plus loading state | Plan |
| Trait location | In scheduler.rs | One consumer, YAGNI — move if reuse appears | Plan |
| Test helpers | Extract to tests/common/mod.rs | 3rd integration file triggers established extraction rule | Plan |
| DB in tests | Real SQLite via tempfile | Matches existing pattern, tests real SQL, <1ms per test | Plan |

## Scope

**In scope:**
- `OverlaySpawner` trait + `TauriOverlaySpawner` implementation
- `run_iteration()` extraction from `Scheduler::run()`
- 4 scheduler integration tests
- 4 OverlayPanel frontend tests
- Shared test helper extraction to `tests/common/mod.rs`

**Out of scope:**
- Command handler tests (mark_done/snooze_habit at Tauri command level)
- Dashboard sync / Zustand store tests
- Comprehensive scheduler branch coverage (multi-habit, no-habits, error recovery)
- Auto-fail UI display test
- Tauri test harness usage

## Architecture / Approach

Decouple scheduler from Tauri by introducing `OverlaySpawner` trait. Extract `run_iteration()` as the testable single-cycle method; `run()` stays as thin infinite loop wrapper. Tests use `MockOverlaySpawner` (records calls) + real SQLite (tempfile) + `tokio::time::pause()` for deterministic time. Frontend tests follow existing mock patterns (mock `lib/invoke` + `@tauri-apps/api/window`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Test infrastructure extraction | Shared `tests/common/mod.rs` with `setup_db` + `sample_habit_input` | Low — mechanical refactor, may break imports |
| 2. Scheduler testability refactor | `OverlaySpawner` trait, `run_iteration()`, updated `lib.rs` wiring | Medium — changes production scheduler code; must verify overlay still fires |
| 3. Scheduler integration tests | 4 new tests proving scheduler fires correctly | Medium — `tokio::time::pause` + async test patterns may need iteration |
| 4. OverlayPanel frontend test | 4 new tests covering overlay UI flows | Low — follows established frontend test patterns |

**Prerequisites:** All prior changes through T-01 (`testing-critical-path-backend`) complete
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- `tokio::time::pause()` interacts correctly with `spawn_blocking` — if not, scheduler tests may need a different time control approach
- `run_iteration()` extraction may require adjusting how `Notify` is shared between loop iterations
- OverlayPanel auto-snooze test with fake timers assumes `setTimeout` inside `useEffect` is correctly advanced by `vi.advanceTimersByTime`

## Success Criteria (Summary)

- `cd src-tauri && cargo test` passes with 4 new scheduler integration tests + all existing tests
- `pnpm test` passes with 4 new OverlayPanel tests + all existing tests
- Scheduler still fires overlays correctly in `pnpm tauri dev` (manual verification)
