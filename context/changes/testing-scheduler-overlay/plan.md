# Scheduler + Overlay Reliability Tests — Implementation Plan

## Overview

Add integration tests for the scheduler run loop and frontend tests for the overlay panel — Phase 2 of the test plan (`context/foundation/test-plan.md`). This covers Risk #1 (overlay doesn't fire at scheduled time) and Risk #4 (dashboard shows stale state after overlay action). Also extracts shared test helpers now that a third integration test file triggers the extraction rule.

## Current State Analysis

**Scheduler (`scheduler.rs`):**
- `find_next_trigger()` pure function: 7 unit tests — well covered
- `Scheduler::run()` async loop: **zero tests** — tightly coupled to `AppHandle` for DB access and `WebviewWindowBuilder` for overlay creation
- Loop uses `tokio::select!` with `sleep` + `Notify` for wake/re-evaluate

**Overlay DB flows (`overlay_integration.rs`):**
- 8 integration tests cover pending trigger CRUD, snooze auto-fail, mark_done — DB layer well tested
- Command handlers (`commands/overlay.rs`) untested at command level but DB flows verified

**Frontend overlay (`OverlayPanel.tsx`):**
- Zero tests — done/snooze/auto-snooze flows only tested manually

**Test infrastructure:**
- `setup_db()` and `sample_habit_input()` duplicated across `db_integration.rs` and `overlay_integration.rs`
- Prior plan stated: "extract to shared module when 3rd integration test file appears"

### Key Discoveries:

- `Scheduler::run()` takes `tauri::AppHandle` for both DB access (`app.state::<AppState>()`) and window creation (`WebviewWindowBuilder`) — both need decoupling for testability (`scheduler.rs:42`)
- Scheduler uses `spawn_blocking` for all DB queries since SQLite blocks — test refactor must preserve this pattern (`scheduler.rs:47-78`)
- `OverlayPanel` uses `getCurrentWindow().close()` from `@tauri-apps/api/window` and IPC wrappers from `lib/invoke.ts` — both need mocking (`OverlayPanel.tsx:39`, `OverlayPanel.tsx:4`)
- Auto-snooze timer is 2 minutes (`AUTO_SNOOZE_MS = 120000`) — testable with `vi.useFakeTimers()` (`OverlayPanel.tsx:8`)
- `tokio::time::pause()` enables deterministic async sleep testing without real wall-clock delays

## Desired End State

After this plan is complete:

1. Scheduler run loop has 4 integration tests proving it fires overlays at the correct time, re-evaluates on wake, handles snooze re-fires, and skips completed slots
2. OverlayPanel has 4 frontend tests covering done, snooze, auto-snooze timer, and loading state
3. Shared test helpers extracted to `tests/common/mod.rs` — all 3 integration test files use them
4. Scheduler is testable via `OverlaySpawner` trait without requiring a running Tauri app
5. All existing tests continue to pass — zero regressions

Verify by running `cd src-tauri && cargo test` (all Rust tests) and `pnpm test` (all frontend tests).

## What We're NOT Doing

- **Overlay command handler tests** — staying at DB integration level per user decision; command wiring (event emission, scheduler wake) stays untested
- **Dashboard sync tests** — Risk #4 tested only at event-emission boundary, not full round-trip to UI
- **Comprehensive scheduler branch coverage** — multi-habit interleaving, no-habits idle path, and error recovery paths deferred
- **Auto-fail UI test** — cosmetic "Marked as failed" message display is low-risk, skipped
- **Tauri test harness** — not using `tauri::test` module; trait abstraction is simpler and more stable

## Implementation Approach

Introduce an `OverlaySpawner` trait to decouple scheduler from Tauri window creation. Refactor `Scheduler::run()` to accept `Arc<Mutex<Database>>` + `impl OverlaySpawner` instead of `tauri::AppHandle`. Tests use a `MockOverlaySpawner` that records calls + real SQLite (tempfile) for DB. Time control via `tokio::time::pause()`. Frontend tests follow existing patterns: mock `lib/invoke` + `@tauri-apps/api/window`, use `vi.useFakeTimers()` for auto-snooze timer.

## Critical Implementation Details

### Timing & lifecycle

`tokio::time::pause()` must be called before any `tokio::time::sleep` in the scheduler loop. The scheduler's infinite `loop` needs a way to break out in tests — either a `run_iteration` method that executes one loop cycle, or a cancellation token. A single-iteration helper is cleaner: the loop wrapper stays in `run()`, the testable logic moves to a method that returns after one trigger evaluation + optional fire.

---

## Phase 1: Test Infrastructure Extraction

### Overview

Extract duplicated test helpers to `tests/common/mod.rs`. Update existing test files to import from shared module.

### Changes Required:

#### 1. Create shared test module

**File**: `src-tauri/tests/common/mod.rs` (new)

**Intent**: Centralize `setup_db()` and `sample_habit_input()` so all integration test files share one definition. This is the third integration test file trigger from the prior plan.

**Contract**: Module exports `pub fn setup_db() -> (NamedTempFile, Database)` and `pub fn sample_habit_input() -> CreateHabitInput` with identical behavior to current duplicated versions.

#### 2. Update db_integration.rs imports

**File**: `src-tauri/tests/db_integration.rs`

**Intent**: Replace local `setup_db()` and `sample_habit_input()` definitions with imports from `common`.

**Contract**: Add `mod common;` and replace local function definitions with `use common::{setup_db, sample_habit_input};`. All existing tests unchanged.

#### 3. Update overlay_integration.rs imports

**File**: `src-tauri/tests/overlay_integration.rs`

**Intent**: Same extraction — replace local helpers with shared imports.

**Contract**: Add `mod common;` and replace local function definitions with `use common::{setup_db, sample_habit_input};`. All existing tests unchanged.

### Success Criteria:

#### Automated Verification:

- All existing Rust tests pass: `cd src-tauri && cargo test`
- No duplicate `setup_db` or `sample_habit_input` definitions remain in individual test files: `grep -rn "fn setup_db\|fn sample_habit_input" src-tauri/tests/ --include="*.rs" | grep -v common`

#### Manual Verification:

- Confirm `tests/common/mod.rs` exports are clean and well-documented

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Scheduler Testability Refactor

### Overview

Introduce `OverlaySpawner` trait and refactor `Scheduler::run()` to accept injectable dependencies instead of `AppHandle`. Extract a testable `run_iteration()` method. Update production wiring in `lib.rs`.

### Changes Required:

#### 1. Add OverlaySpawner trait and TauriOverlaySpawner

**File**: `src-tauri/src/scheduler.rs`

**Intent**: Define a trait for overlay window creation so tests can inject a mock. Keep trait and real impl in `scheduler.rs` since there's only one consumer.

**Contract**:
```rust
pub trait OverlaySpawner: Send + Sync {
    fn spawn_overlay(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
    ) -> Result<(), String>;

    fn is_overlay_open(&self, habit_id: &str) -> bool;
}
```

`TauriOverlaySpawner` holds `tauri::AppHandle`, implements the trait by calling `WebviewWindowBuilder` (moved from `run()` body). The struct and impl live in the same file.

#### 2. Extract run_iteration method

**File**: `src-tauri/src/scheduler.rs`

**Intent**: Move one cycle of the scheduler loop into a testable method. `run()` becomes a thin loop wrapper that calls `run_iteration()` and handles the infinite loop + error recovery. `run_iteration()` returns after evaluating and optionally firing one trigger.

**Contract**: `run_iteration` accepts `&Mutex<Database>` + `&(dyn OverlaySpawner)` + `&Notify`. It:
1. Queries habits, pending triggers, and completions from DB (via `spawn_blocking`)
2. Calls `find_next_trigger()`
3. If trigger found: sleeps until fire_at (cancellable by notify), then upserts pending trigger and calls `spawner.spawn_overlay()`
4. If no trigger: waits on notify
5. Returns `Result<(), String>` for error propagation

Returns an enum or `Result` so `run()` can decide whether to `continue` or retry.

#### 3. Refactor run() to use run_iteration

**File**: `src-tauri/src/scheduler.rs`

**Intent**: `run()` becomes a thin infinite loop calling `run_iteration()`. Signature changes from `async fn run(&self, app: tauri::AppHandle)` to `async fn run(&self, db: Arc<Mutex<Database>>, spawner: Arc<dyn OverlaySpawner>)`.

**Contract**: Remove `tauri::AppHandle` parameter. Accept `Arc<Mutex<Database>>` for DB and `Arc<dyn OverlaySpawner>` for window creation. Loop calls `run_iteration()`, handles errors with 30s retry sleep (preserving current behavior).

#### 4. Update lib.rs wiring

**File**: `src-tauri/src/lib.rs`

**Intent**: Create `TauriOverlaySpawner` and pass `Arc<Mutex<Database>>` + spawner to `Scheduler::run()`. Adapt to new signature.

**Contract**: In `app.setup()`, after creating `AppState` and `Scheduler`, construct `TauriOverlaySpawner { app: app_handle.clone() }` and `Arc::new(db)` (or clone the existing `Mutex<Database>`). Pass both to `sched_run.run()` in the spawned task. AppState still manages its own `Mutex<Database>` for command handlers — scheduler gets a shared `Arc` pointing to the same underlying `Mutex<Database>`.

### Success Criteria:

#### Automated Verification:

- All existing Rust tests pass: `cd src-tauri && cargo test`
- `cargo check` passes with no warnings
- No direct `WebviewWindowBuilder` usage remains in `Scheduler::run()` or `run_iteration()`: `grep -n "WebviewWindowBuilder" src-tauri/src/scheduler.rs` returns empty
- No direct `AppHandle` parameter in `Scheduler::run()`: `grep -n "AppHandle" src-tauri/src/scheduler.rs` returns empty (only in `TauriOverlaySpawner`)

#### Manual Verification:

- Run `pnpm tauri dev`, confirm scheduler still fires overlays at scheduled times
- Confirm overlay done/snooze still works through the full flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Scheduler Integration Tests

### Overview

New `scheduler_integration.rs` with 4 must-test scenarios. Uses `MockOverlaySpawner` + real SQLite + `tokio::time::pause()` for deterministic async testing.

### Changes Required:

#### 1. Create scheduler integration test file

**File**: `src-tauri/tests/scheduler_integration.rs` (new)

**Intent**: Test the scheduler's `run_iteration()` method end-to-end with real DB and mock spawner, proving Risk #1 (overlay fires at correct time) and partial Risk #4 (scheduler wake after state change).

**Contract**: File structure:
- `mod common;` import for `setup_db` and `sample_habit_input`
- `MockOverlaySpawner` struct with `Arc<Mutex<Vec<(String, String, String)>>>` to record `(habit_id, trigger_date, scheduled_time)` calls
- `impl OverlaySpawner for MockOverlaySpawner` — pushes args to vec, returns `Ok(())`
- All tests use `#[tokio::test]` with `tokio::time::pause()` for time control

Tests:

1. **`scheduler_fires_overlay_at_scheduled_time`** — Insert habit scheduled for current minute. Call `run_iteration()`. Assert `MockOverlaySpawner` received call with correct `(habit_id, trigger_date, scheduled_time)`. Assert pending trigger was upserted in DB.

2. **`scheduler_re_evaluates_after_wake`** — Insert habit scheduled for far future. Spawn `run_iteration()` in background task. Call `scheduler.wake()`. Assert loop re-evaluates (returns without firing, since trigger is in the future). Verify spawner was NOT called.

3. **`scheduler_re_fires_after_snooze_delay`** — Insert habit + pending trigger with `next_fire_at` = now + 9 minutes (simulating snooze). Advance time by 9 minutes via `tokio::time::advance()`. Call `run_iteration()`. Assert spawner called with correct habit.

4. **`scheduler_skips_completed_slot`** — Insert habit scheduled for current minute. Insert "done" completion for same slot. Call `run_iteration()`. Assert spawner was NOT called for this slot (may find next-week occurrence or no trigger).

### Success Criteria:

#### Automated Verification:

- All 4 new scheduler tests pass: `cd src-tauri && cargo test scheduler_integration`
- All existing tests still pass: `cd src-tauri && cargo test`
- No flaky failures on 3 consecutive runs: `cd src-tauri && cargo test scheduler_integration && cargo test scheduler_integration && cargo test scheduler_integration`

#### Manual Verification:

- Review test output confirms `tokio::time::pause()` makes tests deterministic (no wall-clock dependency)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: OverlayPanel Frontend Test

### Overview

New `OverlayPanel.test.tsx` with 4 tests covering done, snooze, auto-snooze timer, and loading state. Follows existing frontend test patterns.

### Changes Required:

#### 1. Create OverlayPanel test file

**File**: `src/components/overlay/OverlayPanel.test.tsx` (new)

**Intent**: Test overlay UI interactions — button clicks trigger correct IPC calls, auto-snooze timer fires after 2 minutes, loading state renders correctly.

**Contract**: File structure follows existing patterns (`Dashboard.test.tsx`):
- Mock `../../lib/invoke` — `getHabit`, `markDone`, `snoozeHabit` as `vi.fn()`
- Mock `@tauri-apps/api/window` — `getCurrentWindow` returns `{ close: vi.fn() }`
- `MantineProvider` wrapper with theme
- Mock habit fixture matching `Habit` type

Tests:

1. **`renders loading state initially`** — Render with `getHabit` that never resolves. Assert `Loader` is visible.

2. **`done button calls markDone and closes window`** — Render, wait for ready state. Click "Done" button. Assert `markDone` called with `{ habit_id, trigger_date, scheduled_time }`. Assert `window.close()` called.

3. **`snooze button calls snoozeHabit and closes window`** — Render, wait for ready state. Click "Snooze 9 min" button. Mock `snoozeHabit` returns `{ status: "snoozed" }`. Assert `snoozeHabit` called. Assert `window.close()` called.

4. **`auto-snooze fires after 2 minutes of inactivity`** — Use `vi.useFakeTimers()`. Render, wait for ready state. Advance timers by 120000ms (`vi.advanceTimersByTime`). Assert `snoozeHabit` called automatically. Cleanup with `vi.useRealTimers()`.

### Success Criteria:

#### Automated Verification:

- All 4 new OverlayPanel tests pass: `pnpm test -- --run src/components/overlay/OverlayPanel.test.tsx`
- All existing frontend tests pass: `pnpm test`
- Type checking passes: `tsc --noEmit`

#### Manual Verification:

- Review test file follows project patterns (MantineProvider wrapper, mock structure, test naming)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Existing `find_next_trigger()` unit tests (7) remain unchanged — pure function coverage stays
- Existing `calculate_streak()` unit tests (14) unaffected
- No new unit tests in this change — all new tests are integration or component level

### Integration Tests:

- 4 new scheduler integration tests (`scheduler_integration.rs`) — mock spawner + real SQLite + time control
- 8 existing overlay integration tests (`overlay_integration.rs`) — unchanged, imports updated
- 14 existing DB integration tests (`db_integration.rs`) — unchanged, imports updated

### Manual Testing Steps:

1. Run `pnpm tauri dev` and wait for scheduled overlay to fire — verify overlay still appears
2. Click "Done" on overlay — verify dashboard updates
3. Click "Snooze" on overlay — verify overlay re-fires after 9 minutes
4. Let overlay auto-snooze (wait 2 min) — verify re-fire
5. Snooze 3 times — verify auto-fail message shows and dashboard reflects failed status

## Performance Considerations

- `tokio::time::pause()` makes scheduler tests run in microseconds instead of waiting for real sleep durations
- Real SQLite with tempfile is ~1ms per test — negligible overhead vs mocking
- Frontend fake timers avoid 2-minute real waits for auto-snooze test

## References

- Test plan: `context/foundation/test-plan.md` (Phase 2, risks #1 and #4)
- Prior testing change: `context/changes/testing-critical-path-backend/plan.md`
- Overlay habit loop implementation: `context/changes/overlay-habit-loop/plan.md`
- Scheduler code: `src-tauri/src/scheduler.rs`
- Overlay commands: `src-tauri/src/commands/overlay.rs`
- OverlayPanel component: `src/components/overlay/OverlayPanel.tsx`
- Existing integration tests: `src-tauri/tests/overlay_integration.rs`, `src-tauri/tests/db_integration.rs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure Extraction

#### Automated

- [x] 1.1 All existing Rust tests pass after helper extraction — 9c67f77
- [x] 1.2 No duplicate setup_db or sample_habit_input in individual test files — 9c67f77

#### Manual

- [ ] 1.3 Confirm tests/common/mod.rs exports are clean and well-documented

### Phase 2: Scheduler Testability Refactor

#### Automated

- [x] 2.1 All existing Rust tests pass after refactor — 26e8385
- [x] 2.2 cargo check passes with no warnings — 26e8385
- [x] 2.3 No WebviewWindowBuilder in Scheduler::run() or run_iteration() — 26e8385
- [x] 2.4 No AppHandle parameter in Scheduler::run() — 26e8385

#### Manual

- [ ] 2.5 Scheduler fires overlays at scheduled times in pnpm tauri dev
- [ ] 2.6 Overlay done/snooze works through full flow

### Phase 3: Scheduler Integration Tests

#### Automated

- [x] 3.1 All 4 new scheduler tests pass — c6d4d03
- [x] 3.2 All existing tests still pass — c6d4d03
- [x] 3.3 No flaky failures on 3 consecutive runs — c6d4d03

#### Manual

- [ ] 3.4 Confirm tokio::time::pause() makes tests deterministic

### Phase 4: OverlayPanel Frontend Test

#### Automated

- [x] 4.1 All 4 new OverlayPanel tests pass
- [x] 4.2 All existing frontend tests pass
- [x] 4.3 Type checking passes (tsc --noEmit)

#### Manual

- [ ] 4.4 Test file follows project patterns
