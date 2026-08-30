# Overlay Habit Loop Implementation Plan

## Overview

Build the core habit loop: scheduler fires overlay windows at scheduled times, user responds with Done or Snooze (3x snooze = auto-fail), streak calculated from daily completion status, dashboard shows today's progress with live updates.

## Current State Analysis

Pauzaro has onboarding + first habit creation (S-01 complete). Backend is entirely synchronous Rust (rusqlite + std::sync::Mutex). Frontend has 3 routes (index/onboarding/dashboard), TanStack Router with hash routing, Mantine 9, zero Tauri events. No scheduling, timer, overlay, or multi-window code exists.

### Key Discoveries:

- `tauri::async_runtime::spawn()` required (not `tokio::spawn()`) — no tokio context in setup closure (`research.md:54`)
- `spawn_blocking` needed for sync Mutex DB access from async scheduler loop (`research.md:88`)
- Window creation must be async on Windows (Webview2 deadlock — `wry#583`) (`research.md:127`)
- Time format `HH:MM` (24h), day-of-week 0=Sun..6=Sat — matches JS `Date.getDay()` and SQLite `strftime('%w')` (`research.md:96`)
- `getHabit` invoke wrapper defined but unused (`src/lib/invoke.ts:27`)
- Dashboard loads data directly in useEffect, not via habit store (`src/components/dashboard/Dashboard.tsx:16-37`)

## Desired End State

User creates a habit with schedule. At each scheduled time, a centered floating panel appears (always-on-top, no titlebar, ~400×300). Panel shows habit icon + name with Done and Snooze buttons. Done records completion; Snooze re-fires in 9 min (max 3x, then auto-fail). If no interaction for 2 min, auto-snooze fires. Dashboard shows today's slot statuses and current streak count, updating live after overlay interactions. A hidden "lifebuoy" on failed slots allows manual recovery.

### Verification:

1. Create habit scheduled for 1 min from now
2. Overlay appears at scheduled time
3. Click Snooze → overlay re-appears after 9 min
4. Click Done → completion recorded, streak updates on dashboard
5. Let 3 snoozes happen → auto-fail recorded
6. Restart app during snooze → snooze state preserved, overlay re-fires
7. Use lifebuoy on failed slot → status changes to done

## What We're NOT Doing

- Month view calendar (S-03)
- Streak freeze (S-04)
- Dinosaur mascot (S-05)
- Multi-habit management / edit / delete
- System tray minimization
- Configurable snooze count (hardcoded 3x for now)
- Configurable snooze duration (hardcoded 9 min)
- Configurable auto-snooze timeout (hardcoded 2 min)
- Cross-platform testing (macOS first, Windows deferred)
- Notification sounds

## Implementation Approach

Option E (single timer loop) from research. One async loop spawned via `tauri::async_runtime::spawn()` queries DB for active habits + pending triggers, computes next fire time via pure `find_next_trigger()` function, sleeps until fire time (or wakes on `Notify` signal when schedule changes). On fire, creates overlay WebviewWindow directly from Rust. Overlay React component handles user interaction via invoke commands. Commands update DB, notify scheduler to re-evaluate, and emit events for live dashboard updates.

## Critical Implementation Details

### Timing & lifecycle

Schedule times stored as `HH:MM` represent **local time** (user sets "09:00" meaning their local 09:00). The scheduler must use `chrono::Local::now()` for schedule matching, then convert computed fire times to `tokio::time::Instant` for sleep. DB timestamps (`completed_at`, `created_at`) remain UTC per project convention.

### State sequencing

The `pending_triggers` table is the source of truth for active snooze state. On overlay Done/Snooze:
1. Update `pending_triggers` (or delete + insert completion) **first**
2. Notify scheduler **second** (via `Notify::notify_one()`)
3. Emit `"habit-updated"` event to all windows **third**
4. Close overlay window **last**

If overlay window is force-closed without interaction, `pending_trigger` remains — scheduler re-fires on next loop iteration. No snooze count increment on force-close (intentional: user cannot escape by closing).

---

## Phase 1: Data Foundation

### Overview

Evolve the data layer: add tables for completion tracking and snooze persistence, simplify time slot model (remove `end_time`), and update all models/types/UI to match.

### Changes Required:

#### 1. Migration 2

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add `completions` table (tracks done/failed outcomes per trigger), `pending_triggers` table (persists snooze state across restarts), and drop `end_time` from `habit_schedule_times`.

**Contract**: New migration appended to `MIGRATIONS` array at index 2. Tables:

```sql
CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    trigger_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('done', 'failed')),
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_completions_habit ON completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(trigger_date);

CREATE TABLE IF NOT EXISTS pending_triggers (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    trigger_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    next_fire_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id, trigger_date, scheduled_time)
);

ALTER TABLE habit_schedule_times DROP COLUMN end_time;
```

#### 2. Rust models

**File**: `src-tauri/src/models/habit.rs`

**Intent**: Update `TimeSlot` to remove `end_time` field (only `start_time` remains). Add `Completion` and `PendingTrigger` structs mirroring new tables.

**Contract**: `TimeSlot` becomes `{ start_time: String }`. New `Completion { id, habit_id, trigger_date, scheduled_time, status, completed_at }`. New `PendingTrigger { id, habit_id, trigger_date, scheduled_time, snooze_count, next_fire_at, created_at }`. `status` is a `CompletionStatus` enum: `Done` / `Failed`.

#### 3. Model re-exports

**File**: `src-tauri/src/models/mod.rs`

**Intent**: Re-export `Completion`, `PendingTrigger`, and `CompletionStatus` from models module.

#### 4. Completion repository

**File**: NEW `src-tauri/src/db/completions.rs`

**Intent**: Repository for completions CRUD: `insert`, `get_by_habit_and_date`, `list_by_habit_since`, `has_completion_for_slot`, `delete_by_slot`. Follows existing `HabitRepository` pattern (borrows `&Connection`).

**Contract**: `CompletionRepository<'a>` with same `new(conn)` constructor pattern.

#### 5. Pending trigger repository

**File**: NEW `src-tauri/src/db/pending_triggers.rs`

**Intent**: Repository for pending trigger CRUD: `upsert`, `get_by_slot`, `list_active`, `delete`, `increment_snooze`. Same pattern.

**Contract**: `PendingTriggerRepository<'a>`.

#### 6. DB module registration

**File**: `src-tauri/src/db/mod.rs`

**Intent**: Register new `pub mod completions` and `pub mod pending_triggers` modules.

#### 7. Active habits query

**File**: `src-tauri/src/db/habits.rs`

**Intent**: Add `list_active_with_schedules()` method returning only active habits with hydrated schedule data. Used by scheduler.

**Contract**: `fn list_active_with_schedules(&self) -> Result<Vec<Habit>, AppError>` — filters `WHERE is_active = 1`.

#### 8. Update get_schedule_times

**File**: `src-tauri/src/db/habits.rs`

**Intent**: Update private `get_schedule_times` method to no longer read `end_time` column (column dropped by migration).

#### 9. TypeScript types

**File**: `src/types/index.ts`

**Intent**: Update `TimeSlot` (remove `end_time`), add `Completion`, `CompletionStatus`, `SlotStatus`, `HabitStatus` types.

**Contract**: `TimeSlot { start_time: string }`. `CompletionStatus = 'done' | 'failed'`.

#### 10. SchedulePicker update

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Remove end_time picker from time slot UI. Each slot shows single time input instead of start/end range with arrow notation.

**Contract**: Default slot becomes `{ start_time: "09:00" }`. Remove `end_time` references, arrow element, and second `<input type="time">`.

#### 11. CreateHabitInput update

**File**: `src/components/onboarding/ScheduleStep.tsx`

**Intent**: Update initial time slot state and habit creation payload to match new `TimeSlot` shape (no `end_time`).

#### 12. Chrono dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `chrono` for datetime computation in scheduler and models.

**Contract**: `chrono = { version = "0.4", features = ["serde"] }`

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on fresh DB: `cd src-tauri && cargo test`
- Rust compiles: `cd src-tauri && cargo check`
- Type check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Create habit via onboarding with single time picker (no end_time visible)
- Verify habit data stored correctly in SQLite (check `habit_schedule_times` has no `end_time` column)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Scheduler Engine

### Overview

Build the async scheduler loop: queries active habits and pending triggers from DB, computes next fire time via pure function, sleeps until fire time or wakes on schedule-change notification. Phase 3 wires the actual window creation; this phase logs trigger events to console.

### Changes Required:

#### 1. Tokio dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add tokio `time` and `macros` features needed for `tokio::time::sleep` and `tokio::select!`.

**Contract**: `tokio = { version = "1", features = ["time", "macros"] }`

#### 2. Scheduler struct and run loop

**File**: NEW `src-tauri/src/scheduler.rs`

**Intent**: `Scheduler` struct holding `Arc<tokio::sync::Notify>`. `wake()` method signals schedule change. `run()` async method: infinite loop that queries DB via `spawn_blocking`, calls `find_next_trigger()`, then `tokio::select!` between `sleep_until(fire_time)` and `notify.notified()`. On fire, logs the trigger (Phase 3 replaces log with window creation). On notify, re-queries immediately.

**Contract**:
```rust
pub struct Scheduler {
    notify: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self;
    pub fn wake(&self);
    pub async fn run(&self, app: AppHandle);
}
```

DB access via `spawn_blocking`: clone `AppHandle`, move into blocking closure, acquire `state::<AppState>().db` lock, query via repositories. When no habits are scheduled, block on `notify.notified()`.

#### 3. find_next_trigger pure function

**File**: `src-tauri/src/scheduler.rs`

**Intent**: Pure function that given current time, active habits with schedules, and pending triggers, returns the earliest next trigger. Computes calendar datetimes from day-of-week + time schedule, skips slots with existing completions, incorporates pending trigger re-fires from snoozed overlays.

**Contract**:
```rust
pub fn find_next_trigger(
    now: DateTime<Local>,
    habits: &[Habit],
    pending: &[PendingTrigger],
    completions_today: &[Completion],
) -> Option<NextTrigger>

pub struct NextTrigger {
    pub habit_id: String,
    pub scheduled_time: String,
    pub fire_at: DateTime<Local>,
    pub pending_trigger_id: Option<String>,
}
```

Must use `chrono::Local` for schedule matching — schedule times are user-local.

#### 4. Module registration and scheduler spawn

**File**: `src-tauri/src/lib.rs`

**Intent**: Declare `mod scheduler`, create `Scheduler` instance, manage as Tauri state (for `wake()` access from commands), spawn `scheduler.run(app_handle)` via `tauri::async_runtime::spawn()` in setup closure.

**Contract**: `Scheduler` added to managed state alongside `AppState`. Spawned after DB initialization completes.

#### 5. Unit tests for find_next_trigger

**File**: Inline `#[cfg(test)]` module in `src-tauri/src/scheduler.rs`

**Intent**: Test `find_next_trigger` with scenarios: no active habits → `None`, habit scheduled for current minute → fires immediately, habit scheduled tomorrow → correct delay, pending trigger re-fire → respects `next_fire_at`, completed slot skipped, multiple habits → earliest wins, past unhandled trigger → fires immediately.

### Success Criteria:

#### Automated Verification:

- All `find_next_trigger` unit tests pass: `cd src-tauri && cargo test`
- Rust compiles with zero warnings: `cd src-tauri && cargo check`

#### Manual Verification:

- Create habit scheduled for 1 min from now → scheduler logs trigger fire to console
- Modify habit schedule → scheduler wakes and re-evaluates (visible in logs)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Overlay Window + Events

### Overview

Create the overlay window when trigger fires, build the overlay React UI with Done/Snooze buttons, wire up commands for marking done and snoozing, and establish event channel between overlay and main window.

### Changes Required:

#### 1. Window capability

**File**: `src-tauri/capabilities/default.json`

**Intent**: Add permission for creating webview windows.

**Contract**: Add `"core:webview:allow-create-webview-window"` to permissions array.

#### 2. Overlay window creation in scheduler

**File**: `src-tauri/src/scheduler.rs`

**Intent**: Replace log-on-fire with `WebviewWindowBuilder` call — centered, ~400×300, always-on-top, no decorations, focused. Window label encodes habit_id for React-side identification. Also upserts `pending_trigger` record on first fire for this slot.

**Contract**: Window builder: `always_on_top(true)`, `decorations(false)`, `inner_size(400.0, 300.0)`, `center()`, `focused(true)`. Label format: `"overlay-{habit_id}"`. If an overlay window with this label already exists (user hasn't dismissed previous), skip creation.

#### 3. Overlay route

**File**: NEW `src/routes/overlay.$habitId.tsx`

**Intent**: TanStack Router file route for overlay window. Renders `OverlayPanel` component with `habitId` from route params.

#### 4. Overlay window detection and routing

**File**: `src/routes/index.tsx`

**Intent**: In `beforeLoad`, detect overlay window via `getCurrent().label` prefix `"overlay-"`. If overlay, extract habit_id and redirect to `/overlay/{habitId}` route, skipping normal onboarding/dashboard flow.

**Contract**: Import `getCurrent` from `@tauri-apps/api/window`.

#### 5. OverlayPanel component

**File**: NEW `src/components/overlay/OverlayPanel.tsx`

**Intent**: Overlay UI — centered card displaying habit icon + name, "Done" button (primary/teal), "Snooze 9 min" button (secondary). Loads habit data via `getHabit` invoke on mount. Sets 2-min auto-snooze timer (cleared on any user interaction). On Done: invoke `mark_done`, close window. On Snooze (manual or auto-timeout): invoke `snooze_habit`, close window. On auto-fail response (3x snooze reached): show brief "marked as failed" feedback before closing.

**Contract**: Uses Mantine components (Card, Button, Text, Group, Stack). Styled to match theme (Nunito font, teal primary, warm bg). Window itself has transparent background; card provides visual container with rounded corners and shadow.

#### 6. mark_done command

**File**: NEW `src-tauri/src/commands/overlay.rs`

**Intent**: Async command. Deletes pending_trigger for this slot, inserts completion with `status='done'`, notifies scheduler via `wake()`, emits `"habit-updated"` event to all windows.

**Contract**:
```rust
#[tauri::command]
pub async fn mark_done(
    app: AppHandle,
    state: State<'_, AppState>,
    scheduler: State<'_, Scheduler>,
    habit_id: String,
    trigger_date: String,
    scheduled_time: String,
) -> Result<(), AppError>
```

#### 7. snooze_habit command

**File**: `src-tauri/src/commands/overlay.rs`

**Intent**: Async command. Increments snooze_count on pending_trigger. If count >= 3: delete pending_trigger, insert completion with `status='failed'` (auto-fail), return `SnoozeResult::AutoFailed`. Otherwise: update `next_fire_at` to now + 9 min, return `SnoozeResult::Snoozed`. Always notifies scheduler and emits `"habit-updated"`.

**Contract**: Returns `SnoozeResult { status: 'snoozed' | 'auto_failed' }` so overlay can show appropriate feedback before closing.

#### 8. Invoke wrappers

**File**: `src/lib/invoke.ts`

**Intent**: Add typed wrappers for `mark_done` and `snooze_habit` commands.

#### 9. Commands module and registration

**File**: `src-tauri/src/commands/mod.rs` + `src-tauri/src/lib.rs`

**Intent**: Add `pub mod overlay` to commands module. Register `mark_done` and `snooze_habit` in invoke handler.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- Type check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Existing tests pass: `cd src-tauri && cargo test`

#### Manual Verification:

- Overlay window appears at scheduled time (centered, no titlebar, always-on-top)
- Overlay shows correct habit icon and name
- Click Done → overlay closes, completion recorded in DB
- Click Snooze → overlay closes, re-appears after 9 min
- Let 2 min pass with no interaction → auto-snooze fires
- After 3 snoozes → auto-fail recorded, no more overlays for this slot
- Restart app during snooze → overlay re-fires at correct time

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Streak + Dashboard Updates

### Overview

Calculate streaks from completion data, update dashboard to show today's slot statuses and current streak count, add hidden lifebuoy mechanism for failed slots, wire live event updates.

### Changes Required:

#### 1. Streak calculation

**File**: NEW `src-tauri/src/streak.rs`

**Intent**: Pure function computing current streak for a habit: count consecutive completed days backwards from today. A day is "completed" when ALL scheduled slots for that day have a completion with `status='done'`. Days with any `'failed'` slot (or missing completion for a scheduled slot) break the streak. Non-scheduled days are skipped (don't break or extend streak).

**Contract**:
```rust
pub fn calculate_streak(
    today: NaiveDate,
    schedule_days: &[u8],
    completions: &[Completion],
) -> u32
```

#### 2. Streak + today-status query

**File**: `src-tauri/src/db/completions.rs`

**Intent**: Add methods: `list_by_habit_since(habit_id, from_date)` for streak calculation window, `get_completions_for_date(habit_id, date)` returning completions for a specific day.

#### 3. get_habit_status command

**File**: `src-tauri/src/commands/habits.rs`

**Intent**: New command returning habit's today slot statuses + current streak count. Called by dashboard on load and on `"habit-updated"` event.

**Contract**: Returns `HabitStatus { habit_id, streak: u32, today_slots: Vec<SlotStatus> }` where `SlotStatus { scheduled_time: String, status: "pending" | "done" | "failed" }`. Slot is `"pending"` if scheduled for today, time has not passed, and no completion exists. Slot is `"done"` or `"failed"` based on completion record. Future slots (time not yet reached) show as `"pending"`.

#### 4. Dashboard mark_done for lifebuoy

**File**: `src-tauri/src/commands/overlay.rs`

**Intent**: Extend `mark_done` command to support lifebuoy use case — overriding a failed completion from dashboard. When `override_failed` flag is true: verify a `'failed'` completion exists for this slot, delete it, insert `'done'` completion instead. Notify scheduler + emit event.

**Contract**: Add optional `override_failed: bool` parameter to `mark_done`. Backend validates failed completion exists before allowing override.

#### 5. TypeScript types (if not already added in Phase 1)

**File**: `src/types/index.ts`

**Intent**: Ensure `HabitStatus` and `SlotStatus` types are defined.

**Contract**: `HabitStatus { habit_id: string, streak: number, today_slots: SlotStatus[] }`. `SlotStatus { scheduled_time: string, status: 'pending' | 'done' | 'failed' }`.

#### 6. Invoke wrappers

**File**: `src/lib/invoke.ts`

**Intent**: Add `getHabitStatus` invoke wrapper.

#### 7. TodayStatus component

**File**: NEW `src/components/dashboard/TodayStatus.tsx`

**Intent**: Below each HabitCard, display today's slot statuses as a row of time + status icon (✅ done, ⏳ pending, ❌ failed) and current streak count as a badge. Failed slots reveal a subtle "mark as done" action on hover (lifebuoy) — visually de-emphasized to prevent casual use.

**Contract**: Receives `habitStatus: HabitStatus` and `onMarkDone: (scheduledTime: string) => void` props. Streak displayed as a teal badge with flame/streak icon. Lifebuoy uses Mantine `ActionIcon` with reduced opacity, tooltip explaining "Mark as done (override)".

#### 8. Dashboard integration

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Fetch `HabitStatus` for each habit alongside existing data. Pass to `TodayStatus` component below each `HabitCard`. Handle lifebuoy `mark_done` calls. Listen for `"habit-updated"` Tauri event and re-fetch statuses on receive.

**Contract**: Import `listen` from `@tauri-apps/api/event`. Set up listener in `useEffect`, cleanup on unmount. Re-fetch via `getHabitStatus` on event.

#### 9. Command registration

**File**: `src-tauri/src/lib.rs`

**Intent**: Register `get_habit_status` command in invoke handler.

#### 10. Module registration

**File**: `src-tauri/src/lib.rs`

**Intent**: Declare `mod streak`.

#### 11. Streak unit tests

**File**: Inline `#[cfg(test)]` module in `src-tauri/src/streak.rs`

**Intent**: Test streak calculation: 0 completions → 0, consecutive days → correct count, gap breaks streak, non-scheduled days skipped, partial day (not all slots done) breaks streak, today incomplete doesn't count yet.

### Success Criteria:

#### Automated Verification:

- Streak calculation tests pass: `cd src-tauri && cargo test`
- Type check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- All tests pass: `cd src-tauri && cargo test && pnpm test`

#### Manual Verification:

- Dashboard shows today's slot statuses (pending/done/failed icons)
- Streak counter shows 0 for new habit
- Mark habit done → streak updates to 1 (first completed day)
- Dashboard updates live when overlay Done/Snooze happens (no page refresh)
- Failed slot shows lifebuoy action (subtle, on hover)
- Click lifebuoy → slot flips from failed to done, streak recalculates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `find_next_trigger` — no habits, single habit today, multi-day schedule, past times fire immediately, pending trigger re-fires, completed slots skipped, multiple habits (earliest wins)
- `calculate_streak` — zero completions, consecutive days, gap breaks streak, non-scheduled days skipped, partial completion breaks day, today incomplete
- Repository CRUD for completions and pending_triggers
- `CreateHabitInput` validation (updated for no `end_time`)

### Integration Tests:

- Full trigger flow: create habit → scheduler computes fire time → fire → mark done → verify completion in DB
- Snooze flow: fire → snooze → verify pending_trigger updated → re-fire → 3x → auto-fail
- Restart recovery: insert pending_trigger in DB → start scheduler → verify it re-fires

### Manual Testing Steps:

1. Create habit scheduled 1 min from now → overlay appears
2. Click Done → dashboard shows ✅, streak updates
3. Create habit, let it fire, snooze 3x → auto-fail ❌ on dashboard
4. Use lifebuoy on failed slot → status flips to ✅
5. Restart app during snooze → overlay re-fires correctly
6. Create habit scheduled for tomorrow → no overlay today
7. Ignore overlay for 2 min → auto-snooze fires

## Performance Considerations

- Scheduler loop sleeps between triggers — near-zero CPU when idle
- DB queries via `spawn_blocking` prevent blocking tokio worker threads
- SQLite single-writer lock held briefly (sub-ms queries) — no contention
- Memory: scheduler + one overlay window well within 50MB NFR budget
- Indexes on `completions(habit_id)`, `completions(trigger_date)`, `pending_triggers` UNIQUE constraint ensure fast lookups

## Migration Notes

- Migration 2 is additive (new tables) except for `DROP COLUMN end_time` on `habit_schedule_times`
- Existing habits created during S-01 will have their `end_time` data dropped — acceptable for MVP
- No data migration needed for completions/pending_triggers (new empty tables)
- `DROP COLUMN` requires SQLite ≥ 3.35.0 — rusqlite 0.34 bundled includes 3.46+ ✓

## References

- Research: `context/changes/overlay-habit-loop/research.md`
- Loop research: `context/changes/overlay-habit-loop/loop-research.md`
- API docs research: `context/changes/overlay-habit-loop/loop-research-docs.md`
- PRD US-02: `context/foundation/prd.md:64-78`
- Roadmap S-02: `context/foundation/roadmap.md:35`
- Existing habit model: `src-tauri/src/models/habit.rs:1-64`
- Existing habit repository: `src-tauri/src/db/habits.rs:1-197`
- Existing commands: `src-tauri/src/commands/habits.rs:1-42`
- Setup closure: `src-tauri/src/lib.rs:17-50`
- SchedulePicker: `src/components/shared/SchedulePicker.tsx`
- Dashboard: `src/components/dashboard/Dashboard.tsx`
- Invoke wrappers: `src/lib/invoke.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Foundation

#### Automated

- [x] 1.1 Migration applies cleanly on fresh DB — 64c5dd8
- [x] 1.2 Rust compiles — 64c5dd8
- [x] 1.3 Type check passes — 64c5dd8
- [x] 1.4 Lint passes — 64c5dd8

#### Manual

- [ ] 1.5 Create habit via onboarding with single time picker
- [ ] 1.6 Verify habit data stored correctly in SQLite

### Phase 2: Scheduler Engine

#### Automated

- [x] 2.1 All find_next_trigger unit tests pass — d797807
- [x] 2.2 Rust compiles with zero warnings — d797807

#### Manual

- [ ] 2.3 Scheduler fires trigger at scheduled time (console log)
- [ ] 2.4 Schedule modification wakes scheduler

### Phase 3: Overlay Window + Events

#### Automated

- [x] 3.1 Rust compiles — a58ff3e
- [x] 3.2 Type check passes — a58ff3e
- [x] 3.3 Lint passes — a58ff3e
- [x] 3.4 Existing tests pass — a58ff3e

#### Manual

- [ ] 3.5 Overlay window appears at scheduled time
- [ ] 3.6 Overlay shows correct habit icon and name
- [ ] 3.7 Done closes overlay and records completion
- [ ] 3.8 Snooze closes overlay and re-fires after 9 min
- [ ] 3.9 Auto-snooze fires after 2 min no interaction
- [ ] 3.10 3x snooze triggers auto-fail
- [ ] 3.11 App restart during snooze preserves state

### Phase 4: Streak + Dashboard Updates

#### Automated

- [x] 4.1 Streak calculation tests pass
- [x] 4.2 Type check passes
- [x] 4.3 Lint passes
- [x] 4.4 All tests pass

#### Manual

- [ ] 4.5 Dashboard shows today's slot statuses
- [ ] 4.6 Streak counter displays correctly
- [ ] 4.7 Dashboard updates live on overlay interaction
- [ ] 4.8 Lifebuoy visible on failed slots
- [ ] 4.9 Lifebuoy flips failed to done and streak recalculates
