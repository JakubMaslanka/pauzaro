# Missed-Repetition Recovery Implementation Plan

## Overview

When the app is quit (or crashes) while habit repetitions are scheduled, those reps go untracked. On next launch, the user sees a recovery flow — sequential per-habit modals listing missed slots — and can **"Done anyway"** (backfill completions) or **"Dismiss"** (mark failed). Gaps longer than 30 days auto-reset the streak with a Mantine Notification toast.

## Current State Analysis

The app has no concept of "when was it last running." The scheduler (`scheduler.rs`) fires overlays in real time but cannot retroactively detect what was missed while closed. Stale `pending_triggers` from before a gap are picked up by `list_active()` (`pending_triggers.rs:56-68`) and re-fired immediately — but only for triggers from yesterday onward; older ones silently vanish.

### Key Discoveries:

- No `last_seen` timestamp exists anywhere — `lib.rs:90-101` hides the window on close but writes nothing to DB
- Window close ≠ app quit — closing the window hides it (`api.prevent_close()` + `win.hide()` at `lib.rs:91-93`) while the app + scheduler keep running in the background (visible in macOS menu bar tray). `last_seen_at` must track actual process exit, not window hide.
- Actual quit paths: tray "Quit Pauzaro" → `app.exit(0)` at `lib.rs:70`; `ExitRequested` with `code.is_some()` at `lib.rs:127-130`
- Streaks computed on-the-fly from `completions` table — `streak.rs:12-85` walks backwards up to 365 days, no dedicated streak table
- Existing single-slot recovery: `mark_done` with `override_failed: true` (`overlay.rs:42-44`) deletes a failed completion and inserts a done one — same pattern needed for bulk backfill
- `CompletionRepository::get_latest_by_habit()` (`completions.rs:114-132`) returns most recent completion — useful as fallback for "last activity" when no `last_seen` row exists yet (first launch after migration)
- Modal pattern: `DeleteHabitModal` and `RenameHabitModal` use `<Modal opened={} onClose={} centered radius="lg">` with `opened` boolean state in `Dashboard.tsx`
- Cross-window communication via `app.emit("habit-updated")` in Rust and `listen("habit-updated")` in React — recovery actions should emit same event

## Desired End State

After implementation:

1. App records `last_seen_at` timestamp on actual quit (tray "Quit Pauzaro" or process exit — NOT on window hide, since hiding keeps scheduler running in background)
2. On launch, app detects gap between `last_seen_at` and now, queries each active habit's schedule for unresolved slots in that window
3. Gaps > 30 days: streak auto-resets to 0, all intermediate scheduled slots bulk-marked as failed, Mantine Notification toast shown on dashboard
4. Gaps ≤ 30 days: sequential per-habit recovery modals appear, each listing missed slot count with two action buttons (Done anyway / Dismiss)
5. Stale `pending_triggers` from before the gap are auto-failed on startup
6. After all recovery modals addressed, dashboard loads normally with updated data

### Verification:

1. Quit app (tray → Quit) for 2+ scheduled days → reopen → see recovery modal per habit
2. "Done anyway" → completions backfilled with correct historical dates, streak bridges gap
3. "Dismiss" → failed completions inserted, streak broken at gap
4. Quit app for 31+ days → reopen → no recovery modal, streak reset to 0, Notification toast shown
5. Hide window (close button) → reopen → NO recovery modal (scheduler was running, no gap)

## What We're NOT Doing

- Cloud sync or cross-device recovery — single device, local SQLite only
- Periodic heartbeat for `last_seen` — lifecycle events only (acceptable crash-staleness tradeoff)
- Modifying `calculate_streak` logic — existing backward-walk algorithm handles backfilled completions correctly since they use original `trigger_date`
- Streak freeze integration — S-04 is a separate change; recovery doesn't interact with freezes yet
- Recovery for inactive/deleted habits — only active habits are checked

## Implementation Approach

Four phases, each independently verifiable:

1. **Data Foundation** — migration for `app_state` table, `last_seen_at` quit-time tracking, stale pending_trigger cleanup on startup
2. **Recovery Detection & Actions** — pure Rust module for gap detection and missed-rep computation, Tauri commands for recovery actions (backfill/dismiss)
3. **Recovery Modal** — React recovery modal with sequential per-habit flow, two actions (Done anyway / Dismiss), streak-reset Notification toast
4. **Testing** — Rust unit tests for gap detection, integration tests for recovery flow, Vitest component tests for modal

## Critical Implementation Details

### State sequencing

Recovery detection must run **after** migrations and `last_seen_at` write but **before** the scheduler starts its first iteration. Otherwise the scheduler could fire stale pending triggers that the recovery system is about to auto-fail, causing double-processing. The startup order in `lib.rs` must be: open DB → run migrations → read `last_seen_at` → write new `last_seen_at` → run stale trigger cleanup → compute missed reps → start scheduler. The recovery result is stored as managed Tauri state so the frontend can query it via a command.

---

## Phase 1: Data Foundation

### Overview

Add `app_state` table for `last_seen_at` tracking. Write timestamp on actual app quit (tray "Quit" or process exit — NOT on window hide, since the app keeps running in background with scheduler active). On startup, read previous `last_seen_at`, write current timestamp, and clean up stale `pending_triggers` by auto-failing them.

### Changes Required:

#### 1. New migration — `app_state` table

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add migration 3 creating `app_state` table with a single `last_seen_at` TEXT column. Singleton row pattern — one row, always updated in place.

**Contract**: New entry appended to `MIGRATIONS` array. Table schema:
```sql
CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_seen_at TEXT NOT NULL
);
INSERT OR IGNORE INTO app_state (id, last_seen_at) VALUES (1, datetime('now', 'localtime'));
```
The `CHECK (id = 1)` enforces singleton. Initial `last_seen_at` is set to migration time — first-time users get a fresh timestamp, existing users get "now" as baseline (no false gap on first launch after upgrade).

#### 2. App state repository

**File**: `src-tauri/src/db/app_state.rs` (NEW)

**Intent**: Repository for reading and updating `last_seen_at`. Follows existing `Repository<'a>` pattern from `completions.rs`, `pending_triggers.rs`.

**Contract**: `AppStateRepository<'a>` with:
- `get_last_seen(&self) -> Result<String, AppError>` — returns `last_seen_at` from singleton row
- `update_last_seen(&self, timestamp: &str) -> Result<(), AppError>` — updates singleton row

#### 3. Register app_state module

**File**: `src-tauri/src/db/mod.rs`

**Intent**: Add `pub mod app_state;` to DB module.

**Contract**: New module declaration alongside existing `completions`, `habits`, `pending_triggers`, `user_profile`.

#### 4. Write `last_seen_at` on actual app quit

**File**: `src-tauri/src/lib.rs`

**Intent**: When the app process is about to exit, write current local timestamp to `app_state`. This captures "last time the app was running." Window hide (close button) does NOT write — the app stays alive in the background with the scheduler active, so no gap exists.

**Contract**: In the `RunEvent` match (line 123-139), add a handler for `tauri::RunEvent::Exit`. Before the process terminates, acquire DB lock from managed `AppState`, call `AppStateRepository::update_last_seen()` with `Local::now()` formatted as `"%Y-%m-%dT%H:%M:%S"`. Errors logged but don't block exit. The `Exit` event fires for both explicit quit (`app.exit(0)` from tray) and graceful OS shutdown. Crashes bypass this — acceptable staleness per decision.

#### 5. Startup: read previous `last_seen_at`, write new one, cleanup stale triggers

**File**: `src-tauri/src/lib.rs`

**Intent**: During `setup` (after DB open, before scheduler spawn), read `last_seen_at` for recovery detection, update it to now, and auto-fail stale `pending_triggers`.

**Contract**: Between DB init (line 37-41) and scheduler spawn (line 49-52):
1. Read `last_seen_at` via `AppStateRepository::get_last_seen()`
2. Update `last_seen_at` to `Local::now()`
3. Query stale pending triggers: `trigger_date < today` (broader than `list_active`'s 1-day window)
4. For each stale trigger: insert `CompletionStatus::Failed` completion (matching `trigger_date` and `scheduled_time`), delete the trigger
5. Compute missed repetitions (Phase 2 adds this) and store as managed Tauri state

#### 6. New repository method — list stale pending triggers

**File**: `src-tauri/src/db/pending_triggers.rs`

**Intent**: Query pending triggers with `trigger_date` before today for cleanup. Broader than `list_active()` which only looks 1 day back.

**Contract**: `list_stale(&self, today: &str) -> Result<Vec<PendingTrigger>, AppError>` — returns all triggers where `trigger_date < today`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on fresh DB: `cd src-tauri && cargo test`
- Migration applies cleanly on existing DB (idempotent): verified by integration test
- Type checking passes: `tsc --noEmit`
- Rust check: `cd src-tauri && cargo check`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Launch app → quit via tray "Quit Pauzaro" → reopen → `app_state` table has `last_seen_at` within last minute of quit time
- Quit app, wait, reopen → `last_seen_at` reflects previous quit time, then updates to now
- Hide window (close button) → reopen from tray → `last_seen_at` NOT updated (app was still running)
- Create pending trigger (by snoozing an overlay), quit app, wait until next day, reopen → stale trigger auto-failed, `completions` row inserted with `status = 'failed'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Recovery Detection & Actions

### Overview

Pure Rust module for computing missed repetitions from the gap between `last_seen_at` and now. New Tauri commands for recovery actions: check for missed reps, backfill as done, dismiss as failed.

### Changes Required:

#### 1. Recovery module — gap detection and missed-rep computation

**File**: `src-tauri/src/recovery.rs` (NEW)

**Intent**: Pure function that, given a time range and habit schedules, computes which slots have no completion record. This is the core logic — must be pure and testable without DB.

**Contract**:
```rust
pub struct MissedRepetition {
    pub habit_id: String,
    pub habit_name: String,
    pub habit_icon: String,
    pub habit_icon_color: String,
    pub trigger_date: String,      // "YYYY-MM-DD"
    pub scheduled_time: String,    // "HH:MM"
}

pub struct HabitRecoveryInfo {
    pub habit_id: String,
    pub habit_name: String,
    pub habit_icon: String,
    pub habit_icon_color: String,
    pub missed_reps: Vec<MissedRepetition>,
    pub streak_reset: bool,  // true if gap > 30 days
}

pub struct RecoveryResult {
    pub habits: Vec<HabitRecoveryInfo>,
}

pub fn compute_missed_repetitions(
    last_seen: NaiveDateTime,
    now: NaiveDateTime,
    habits: &[Habit],
    completions: &[Completion],
) -> RecoveryResult
```

Algorithm: for each habit, iterate each date from `last_seen.date()` (or `last_seen.date() + 1` if last_seen was after all scheduled times) through `now.date() - 1` (yesterday — today is handled by normal scheduler). For each date: check if it's a scheduled day (`schedule_days` contains DOW). For each scheduled time on that day: check if a completion exists (any status). If not, emit a `MissedRepetition`. If gap > 30 days, set `streak_reset = true` on that habit. Skip dates before `habit.start_date` or after `habit.end_date`.

#### 2. Recovery state — managed Tauri state

**File**: `src-tauri/src/lib.rs`

**Intent**: Store `RecoveryResult` as managed Tauri state so the frontend can query it once on dashboard mount.

**Contract**: New struct wrapping `Mutex<Option<RecoveryResult>>` (consumed on first read — frontend gets it once, then it's `None`). Managed via `app.manage()` during setup, after computing recovery in Phase 1's startup sequence.

#### 3. Recovery commands

**File**: `src-tauri/src/commands/recovery.rs` (NEW)

**Intent**: Tauri commands for the frontend to query missed reps and execute recovery actions.

**Contract**: Three commands:
- `get_missed_repetitions() -> RecoveryResult` — takes the recovery result from managed state (returns empty if already consumed or no missed reps). Consumes the state so subsequent calls return empty.
- `recover_habit_done(habit_id, slots: Vec<{trigger_date, scheduled_time}>)` — bulk-insert `Done` completions for each slot with original `trigger_date`/`scheduled_time`, `completed_at = now`. Emits `habit-updated`.
- `recover_habit_dismiss(habit_id, slots: Vec<{trigger_date, scheduled_time}>)` — bulk-insert `Failed` completions for each slot. Emits `habit-updated`.

All bulk inserts wrapped in a transaction for atomicity.

#### 4. Register recovery module and commands

**File**: `src-tauri/src/lib.rs`

**Intent**: Add `pub mod recovery;` to crate root, register new commands in `invoke_handler`.

**Contract**: Add `commands::recovery::get_missed_repetitions`, `commands::recovery::recover_habit_done`, `commands::recovery::recover_habit_dismiss` to `generate_handler![]` macro.

#### 5. Register recovery commands module

**File**: `src-tauri/src/commands/mod.rs`

**Intent**: Add `pub mod recovery;` to commands module.

**Contract**: New module declaration alongside `habits`, `overlay`, `user_profile`.

#### 6. Frontend IPC wrappers

**File**: `src/lib/invoke.ts`

**Intent**: Typed wrappers for recovery commands matching existing patterns.

**Contract**: New exports:
- `getMissedRepetitions(): Promise<RecoveryResult>`
- `recoverHabitDone(habitId: string, slots: Array<{trigger_date: string, scheduled_time: string}>): Promise<void>`
- `recoverHabitDismiss(habitId: string, slots: Array<{trigger_date: string, scheduled_time: string}>): Promise<void>`

#### 7. Frontend types

**File**: `src/types/index.ts`

**Intent**: TypeScript interfaces for recovery data structures.

**Contract**: New interfaces `MissedRepetition`, `HabitRecoveryInfo`, `RecoveryResult` matching Rust structs.

### Success Criteria:

#### Automated Verification:

- Rust check: `cd src-tauri && cargo check`
- Unit tests for `compute_missed_repetitions` pass: `cd src-tauri && cargo test recovery`
- Type checking passes: `tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Close app for 2+ scheduled days → reopen → call `get_missed_repetitions` from debug panel or console → returns correct list of missed slots per habit
- Call `recover_habit_done` with a missed slot → completion inserted with correct historical date → streak reflects recovered day
- Call `recover_habit_dismiss` with a missed slot → failed completion inserted → calendar shows red for that day

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Recovery Modal

### Overview

React recovery modal component with sequential per-habit flow. Dashboard checks for missed reps on mount and shows modals before normal content. Two actions per habit: Done anyway (backfill) and Dismiss (mark failed). Streak-reset toast uses Mantine `<Notification>`.

### Changes Required:

#### 1. Recovery modal component

**File**: `src/components/dashboard/RecoveryModal.tsx` (NEW)

**Intent**: Modal showing one habit's missed repetitions with two action buttons. Follows `DeleteHabitModal` pattern — Mantine `<Modal>` with `opened`/`onClose` props, centered, `radius="lg"`.

**Contract**: Props interface:
```typescript
interface RecoveryModalProps {
    habitRecovery: HabitRecoveryInfo;
    opened: boolean;
    onResolved: () => void;  // called after any action completes
}
```

Modal content: habit icon + name at top, "X missed repetitions" count, brief explanation of what happened ("While you were away, X scheduled repetitions were missed"), two action buttons:
- "✅ Done anyway" (teal) — calls `recoverHabitDone` with all missed slots, loading state while processing
- "❌ Dismiss" (red, subtle variant) — calls `recoverHabitDismiss` with all missed slots

Modal should not be closeable via overlay click or escape — user must pick an action. Set `closeOnClickOutside={false}` and `closeOnEscape={false}`, no close button (`withCloseButton={false}`).

#### 2. Recovery flow controller

**File**: `src/components/dashboard/RecoveryFlow.tsx` (NEW)

**Intent**: Orchestrates sequential per-habit recovery modals. Takes full `RecoveryResult`, shows one modal at a time, advances to next habit after each resolves.

**Contract**: Props:
```typescript
interface RecoveryFlowProps {
    recoveryResult: RecoveryResult;
    onComplete: () => void;  // all habits addressed
}
```

Manages internal index state. Renders `RecoveryModal` for current habit. On `onResolved`, advances index. When all habits done, calls `onComplete`.

Streak-reset notification: if any `HabitRecoveryInfo` has `streak_reset: true`, renders a Mantine `<Notification>` component (from `@mantine/core`) after modals complete — title "Welcome back! 👋", message "Your streak was reset after 30 days of inactivity. Let's start fresh!", color teal, auto-dismiss after 5 seconds via `setTimeout`.

#### 3. Integrate recovery flow into Dashboard

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: On mount, check for missed repetitions. If any, show recovery flow before normal dashboard content.

**Contract**: New state variant in `DashboardState`: add `| { status: "recovering"; recoveryResult: RecoveryResult }`. In `loadData`, call `getMissedRepetitions()` first. If result has habits with missed reps, set state to "recovering". When recovery flow completes (`onComplete`), transition to normal loading → ready flow. The dashboard is blocked (not rendered) while recovery is active.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Rust check: `cd src-tauri && cargo check`
- Existing tests still pass: `pnpm test` and `cd src-tauri && cargo test`

#### Manual Verification:

- Quit app for 2+ scheduled days → reopen → see recovery modal for each habit in sequence
- Click "Done anyway" → modal closes, next habit modal appears → after all done, dashboard shows with backfilled completions and recovered streak
- Click "Dismiss" → modal closes, next habit appears → calendar shows failed days
- Quit app for 31+ days → reopen → no recovery modal → dashboard shows with streak at 0 → Notification toast appears
- Single habit with no missed reps → no recovery modal → straight to dashboard
- Hide window (close button) → reopen → NO recovery modal (app was running)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Testing

### Overview

Full-stack test coverage: Rust unit tests for gap detection pure logic, integration tests for recovery startup flow and action commands, Vitest component tests for recovery modal.

### Changes Required:

#### 1. Unit tests for `compute_missed_repetitions`

**File**: `src-tauri/src/recovery.rs` (in `#[cfg(test)]` module)

**Intent**: Test the pure gap detection function with various scenarios. Follows `streak.rs` test pattern — helper functions for creating test data, tests for edge cases.

**Contract**: Test cases:
- No gap (last_seen = now): empty result
- 1-day gap with all slots missed: returns correct `MissedRepetition` entries
- Multi-day gap across week boundary: only scheduled days counted
- Partial day: app closed mid-day, some slots already done
- 30-day boundary: gap exactly 30 days → recovery (not reset); 31 days → streak_reset = true
- Habit start_date after gap start: only dates after start_date checked
- Habit end_date before gap end: only dates before end_date checked
- Multiple habits: each gets independent recovery info
- Non-scheduled days in gap: skipped correctly

#### 2. Integration tests for recovery flow

**File**: `src-tauri/tests/recovery_integration.rs` (NEW)

**Intent**: Test the full recovery flow against real SQLite — startup detection, action commands, and data integrity.

**Contract**: Uses `common::setup_db()` pattern. Test cases:
- Insert habit + set `last_seen_at` to 3 days ago → call recovery detection → correct missed reps returned
- Call `recover_habit_done` → completions inserted with original trigger dates, `completed_at` is current
- Call `recover_habit_dismiss` → failed completions inserted
- Stale pending triggers cleaned up on startup: insert pending trigger with old date → run cleanup → trigger deleted, failed completion inserted
- 30-day gap: streak reset, all intermediate days bulk-marked failed
- Recovery result consumed on first read: second call returns empty
- Existing completions not duplicated: slot with existing completion excluded from missed list

#### 3. Frontend component tests — RecoveryModal

**File**: `src/components/dashboard/RecoveryModal.test.tsx` (NEW)

**Intent**: Test recovery modal rendering and action buttons. Follows `OverlayPanel.test.tsx` pattern — mock Tauri IPC, test behavior not implementation.

**Contract**: Test cases:
- Renders habit name, icon, and missed rep count
- "Done anyway" button calls `recoverHabitDone` with correct slots, then calls `onResolved`
- "Dismiss" button calls `recoverHabitDismiss` with correct slots, then calls `onResolved`
- Loading states shown during action processing
- Error handling: action failure shows error message, doesn't call `onResolved`
- Modal cannot be closed via overlay click or escape (must pick an action)

### Success Criteria:

#### Automated Verification:

- All Rust tests pass: `cd src-tauri && cargo test`
- All frontend tests pass: `pnpm test`
- Type checking: `tsc --noEmit`
- Lint: `pnpm lint`
- No test regressions in existing test suites

#### Manual Verification:

- Run full test suite end-to-end, verify no flaky tests
- Verify test coverage captures the critical edge cases: partial day, 30-day boundary, multi-habit recovery

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `compute_missed_repetitions` pure function — edge cases around day boundaries, week rollover, schedule filtering, 30-day cutoff
- `AppStateRepository` — read/update `last_seen_at`

### Integration Tests:

- Full recovery startup flow: set `last_seen_at`, create habits with schedules, verify missed reps detected
- Recovery actions: backfill creates correct completions, dismiss creates failed records
- Stale trigger cleanup: old pending triggers auto-failed on startup
- Data integrity: no duplicate completions, correct dates on backfilled records
- Recovery result consumption: returns data once, empty on second call

### Frontend Tests:

- RecoveryModal renders and handles both actions (Done anyway / Dismiss)
- RecoveryFlow shows modals sequentially, calls onComplete after last
- Dashboard enters recovery state when missed reps exist

### Manual Testing Steps:

1. Create habit with MWF schedule at 10:00 and 15:00
2. Use app normally for a day, quit via tray "Quit Pauzaro"
3. Wait 2-3 scheduled days
4. Reopen — verify recovery modal appears with correct habit and count
5. Test each action: Done anyway, Dismiss
6. Verify calendar, streak, and completion data after each action
7. Test 30+ day gap: adjust `last_seen_at` in SQLite directly, reopen
8. Test window hide (close button) → reopen — verify NO recovery modal (app was running)

## Performance Considerations

- Gap detection query scans completions for up to 30 days × number of habits — bounded and fast for local SQLite
- Bulk insert for "Done anyway" / "Dismiss" uses transaction — single disk sync for all slots
- Recovery result stored in memory as managed state — no repeated DB queries
- Stale trigger cleanup runs once at startup — O(n) where n is stale trigger count (typically 0-5)

## Migration Notes

- Migration 3 adds `app_state` table with `last_seen_at` initialized to "now" — existing users get a fresh baseline, so first launch after upgrade shows no recovery modal (correct: no gap data before tracking started)
- Forward-compatible: if `app_state` table doesn't exist (shouldn't happen with migration runner), recovery code should gracefully skip (no crash)
- No breaking changes to existing tables or commands

## References

- Roadmap S-06: `context/foundation/roadmap.md:146-159`
- Existing overlay system: `src-tauri/src/scheduler.rs:27-71`
- Streak calculation: `src-tauri/src/streak.rs:12-85`
- Completion insertion: `src-tauri/src/db/completions.rs:15-37`
- Override-failed pattern: `src-tauri/src/commands/overlay.rs:42-44`
- Modal pattern: `src/components/dashboard/DeleteHabitModal.tsx`
- Test helpers: `src-tauri/tests/common/mod.rs`
- Frontend test pattern: `src/components/overlay/OverlayPanel.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Foundation

#### Automated

- [x] 1.1 Migration applies cleanly on fresh DB — 862f8b3
- [x] 1.2 Migration applies cleanly on existing DB (idempotent) — 862f8b3
- [x] 1.3 Type checking passes: `tsc --noEmit` — 862f8b3
- [x] 1.4 Rust check: `cd src-tauri && cargo check` — 862f8b3
- [x] 1.5 Lint passes: `pnpm lint` — 862f8b3

#### Manual

- [x] 1.6 `app_state` table has correct `last_seen_at` after close and reopen — 862f8b3
- [x] 1.7 Stale pending triggers auto-failed on startup — 862f8b3

### Phase 2: Recovery Detection & Actions

#### Automated

- [x] 2.1 Rust check: `cd src-tauri && cargo check` — 094ed7b
- [x] 2.2 Unit tests for `compute_missed_repetitions`: `cd src-tauri && cargo test recovery` — 094ed7b
- [x] 2.3 Type checking passes: `tsc --noEmit` — 094ed7b
- [x] 2.4 Lint passes: `pnpm lint` — 094ed7b

#### Manual

- [x] 2.5 `get_missed_repetitions` returns correct missed slots after gap — 094ed7b
- [x] 2.6 `recover_habit_done` inserts completions with historical dates — 094ed7b
- [x] 2.7 `recover_habit_dismiss` inserts failed completions — 094ed7b

### Phase 3: Recovery Modal

#### Automated

- [x] 3.1 Type checking passes: `tsc --noEmit` — cc5ff8f
- [x] 3.2 Lint passes: `pnpm lint` — cc5ff8f
- [x] 3.3 Rust check: `cd src-tauri && cargo check` — cc5ff8f
- [x] 3.4 Existing tests still pass: `pnpm test` and `cd src-tauri && cargo test` — cc5ff8f

#### Manual

- [x] 3.5 Recovery modals appear sequentially per habit after gap — cc5ff8f
- [x] 3.6 "Done anyway" backfills completions and recovers streak — cc5ff8f
- [x] 3.7 "Dismiss" marks slots as failed — cc5ff8f
- [x] 3.8 30+ day gap shows Notification toast, no recovery modal — cc5ff8f
- [x] 3.9 No recovery modal when no missed reps — cc5ff8f
- [x] 3.10 Window hide (close button) → reopen → no recovery modal — cc5ff8f

### Phase 4: Testing

#### Automated

- [x] 4.1 All Rust tests pass: `cd src-tauri && cargo test`
- [x] 4.2 All frontend tests pass: `pnpm test`
- [x] 4.3 Type checking: `tsc --noEmit`
- [x] 4.4 Lint: `pnpm lint`

#### Manual

- [x] 4.5 Full test suite runs without flaky tests
- [x] 4.6 Edge case coverage verified: partial day, 30-day boundary, multi-habit
