# Streak Freeze Implementation Plan

## Overview

Add per-habit streak freeze — a Duolingo-style safety net that auto-protects streaks when a scheduled day is missed. Each habit gets 2 freezes per streak. When `calculate_streak()` walks backwards and encounters an incomplete scheduled day, it checks remaining freeze budget before breaking. Frozen days appear as snowflake cells in the calendar and remaining freezes show on the StreakHero component.

## Current State Analysis

Streaks are computed on-demand by the pure function `calculate_streak()` (`src-tauri/src/streak.rs:12-85`), which walks backwards from today up to 365 days. Non-scheduled days are already skipped — frozen days need identical treatment.

The `build_habit_status()` function (`src-tauri/src/commands/habits.rs:62-113`) fetches 90 days of completions, calls `calculate_streak()`, and returns `HabitStatusResponse` with streak count + today's slots.

Recovery logic (`src-tauri/src/recovery.rs:44-131`) scans gaps between `last_seen_at` and now, emitting `MissedRepetition` entries for each unfilled slot. Frozen days must be excluded.

Frontend shows streaks via `StreakHero` (flame icon + count), `MonthStats` (streak card), and `MonthCalendar` (per-day status cells). `DayCell` has 6 statuses — no "frozen" status exists. Settings page has one toggle (autostart).

No freeze state exists in the DB. The `settings` table is a singleton with only `autostart_enabled`. All 5 migrations are tracked via `schema_version`.

### Key Discoveries:

- `calculate_streak()` signature: `(today, schedule_days, slots_per_day, completions) -> u32` — needs freeze dates as new param
- `build_habit_status()` at `commands/habits.rs:100-105` fetches completions from 90 days back — freeze records must be fetched in same window
- `deriveDayStatus()` at `MonthCalendar.tsx:123-238` determines calendar cell appearance — needs freeze-date awareness
- Recovery's `compute_missed_repetitions()` at `recovery.rs:44` is a pure function taking `(last_seen, now, habits, completions)` — freeze dates become additional input
- 13 streak unit tests + 10 recovery unit tests + 7 integration tests already exist and must remain green

## Desired End State

User has 2 streak freezes per habit per streak. When a scheduled day passes without all slots completed, a freeze is automatically consumed (earliest-first). The streak count stays intact through frozen days. The calendar shows frozen days with a snowflake icon on icy blue background. StreakHero shows remaining freeze count as snowflake badges. Recovery modal auto-applies freezes to earliest missed days and only prompts for unfrozen gaps.

To verify: miss a scheduled day, reopen app, confirm streak is preserved (not broken), calendar shows snowflake, StreakHero shows 1 remaining freeze (down from 2). Miss a second day — same behavior, 0 remaining. Miss a third day — streak breaks normally. Start new streak — freezes replenish to 2.

## What We're NOT Doing

- Manual freeze activation (proactive toggle) — freeze is auto-consumed only
- Earning extra freezes via milestones or gamification
- Global freeze pool across habits — each habit tracks independently
- Suppressing overlays on frozen days — overlays fire normally; freeze is purely a streak safety net
- Per-habit freeze budget customization (always 2)
- Freeze history/log UI beyond calendar cells

## Implementation Approach

Freeze state lives in a new `streak_freezes` table (one row per frozen date per habit). The `calculate_streak()` function gains a `frozen_dates: &[NaiveDate]` parameter — when it encounters an incomplete scheduled day, it checks whether that date is frozen before breaking. If frozen, the day is skipped (like a non-scheduled day) without incrementing streak count.

Freeze consumption is on-demand: the first call to `build_habit_status()` after a missed day detects the gap and persists freeze records. This keeps the architecture event-free (no background jobs). `HabitStatusResponse` gains `freezes_remaining` and `frozen_dates` fields so the frontend can render calendar and counter.

Recovery integration: `compute_missed_repetitions()` receives freeze dates and excludes frozen days from the missed-reps list.

## Critical Implementation Details

### State sequencing

Freeze consumption must happen inside `build_habit_status()` **before** `calculate_streak()` runs, because the streak calc needs the frozen_dates to produce correct results. The sequence is: (1) query existing freezes, (2) scan for new missed days that should be frozen, (3) persist new freeze records, (4) pass all frozen dates to `calculate_streak()`. Steps 2-3 must be idempotent — repeated calls for the same missed day must not double-consume.

---

## Phase 1: Data Layer + Streak Calculation

### Overview

Add the `streak_freezes` table via migration, create the freeze repository, and refactor `calculate_streak()` to accept and honor frozen dates. This phase is pure backend — no commands or frontend changes.

### Changes Required:

#### 1. Migration 5: streak_freezes table

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add a new table to store consumed freeze records per habit per date. Each row represents one frozen day.

**Contract**: New migration at index 5 in `MIGRATIONS` array. Table `streak_freezes` with columns: `id TEXT PRIMARY KEY`, `habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE`, `frozen_date TEXT NOT NULL`, `created_at TEXT NOT NULL DEFAULT (datetime('now'))`. Unique constraint on `(habit_id, frozen_date)`. Index on `habit_id`.

#### 2. Freeze repository

**File**: `src-tauri/src/db/freeze.rs` (new file)

**Intent**: Provide CRUD access to `streak_freezes` table following the existing repository pattern (`CompletionRepository`, `HabitRepository`).

**Contract**: `FreezeRepository<'a>` struct with methods:
- `list_by_habit(&self, habit_id: &str) -> Result<Vec<StreakFreeze>, AppError>` — all freezes for a habit
- `list_by_habit_since(&self, habit_id: &str, from_date: &str) -> Result<Vec<StreakFreeze>, AppError>` — freezes within date window (matches `CompletionRepository::list_by_habit_since` pattern)
- `insert(&self, habit_id: &str, frozen_date: &str) -> Result<StreakFreeze, AppError>` — insert with conflict ignore (idempotent)
- `count_by_habit(&self, habit_id: &str) -> Result<usize, AppError>` — total freezes in current streak (used for budget)
- `delete_all_by_habit(&self, habit_id: &str) -> Result<usize, AppError>` — clear freezes on streak reset/replenish

#### 3. StreakFreeze model

**File**: `src-tauri/src/models/freeze.rs` (new file)

**Intent**: Define the data model for freeze records.

**Contract**: `StreakFreeze` struct with fields `id: String`, `habit_id: String`, `frozen_date: String`, `created_at: String`. Derive `Debug, Serialize, Deserialize, Clone`. Re-export from `models/mod.rs`.

#### 4. Register db/freeze module

**File**: `src-tauri/src/db/mod.rs`

**Intent**: Wire the new freeze repository into the db module.

**Contract**: Add `pub mod freeze;` to the module file.

#### 5. Refactor calculate_streak()

**File**: `src-tauri/src/streak.rs`

**Intent**: Make streak calculation freeze-aware. A frozen scheduled day is skipped (like a non-scheduled day) — it neither breaks nor extends the streak.

**Contract**: New signature: `calculate_streak(today, schedule_days, slots_per_day, completions, frozen_dates: &[NaiveDate]) -> u32`. When the function encounters a scheduled day that is incomplete/failed, before breaking it checks `frozen_dates.contains(&check_date)`. If frozen, skip (`continue`) instead of `break`. The existing behavior is preserved when `frozen_dates` is empty.

#### 6. Freeze budget constant

**File**: `src-tauri/src/streak.rs`

**Intent**: Define max freezes per streak as a named constant.

**Contract**: `pub const MAX_FREEZES_PER_STREAK: usize = 2;` at module top level.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `cd src-tauri && cargo test` (integration tests run migrations)
- Existing 13 streak unit tests still pass with empty `frozen_dates` parameter
- `cargo check` passes with new modules wired

#### Manual Verification:

- Review that `streak_freezes` table schema matches design (UNIQUE constraint, CASCADE delete, index)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Commands + Recovery Integration

### Overview

Wire freeze consumption into `build_habit_status()`, add freeze-related fields to the status response, create Tauri commands for freeze state, and integrate freezes into recovery logic.

### Changes Required:

#### 1. Freeze consumption logic in build_habit_status

**File**: `src-tauri/src/commands/habits.rs`

**Intent**: Detect missed days and auto-consume freezes before calculating the streak. This is the core freeze-consumption entry point.

**Contract**: Inside `build_habit_status()`, after fetching completions and before calling `calculate_streak()`:
1. Fetch existing freeze records via `FreezeRepository::list_by_habit_since()`
2. Walk backwards from yesterday through scheduled days, find incomplete days with no existing freeze
3. For each such day, if freeze budget (MAX_FREEZES_PER_STREAK minus existing freezes count) allows, insert a new freeze record via `FreezeRepository::insert()`
4. Collect all frozen dates (existing + newly inserted) and pass to `calculate_streak()`
5. The scan window matches the completion fetch window (90 days)

The function gains `FreezeRepository` as an additional parameter (or constructs it from the connection already available).

#### 2. Extend HabitStatusResponse

**File**: `src-tauri/src/commands/habits.rs`

**Intent**: Expose freeze state to the frontend.

**Contract**: Add two fields to `HabitStatusResponse`:
- `freezes_remaining: u32` — MAX_FREEZES_PER_STREAK minus count of freeze records in current streak
- `frozen_dates: Vec<String>` — list of "YYYY-MM-DD" strings for frozen days (used by calendar)

#### 3. Freeze replenishment on streak reset

**File**: `src-tauri/src/commands/habits.rs`

**Intent**: When a streak is detected as broken (no more freezes left to cover gaps), clear old freeze records so the next streak starts fresh with 2 freezes.

**Contract**: After `calculate_streak()` returns 0 and there are consumed freezes in the DB, call `FreezeRepository::delete_all_by_habit()`. This handles replenishment naturally — streak resets to 0, freezes clear, next streak begins with budget of 2.

#### 4. Update recovery to exclude frozen days

**File**: `src-tauri/src/recovery.rs`

**Intent**: Frozen days should not appear as missed repetitions in the recovery modal.

**Contract**: `compute_missed_repetitions()` gains a new parameter: `frozen_dates: &[NaiveDate]`. When scanning scheduled days in the gap, if a date is in `frozen_dates`, skip it entirely (no MissedRepetition entries). Existing behavior preserved when `frozen_dates` is empty.

#### 5. Feed freeze data into recovery at startup

**File**: `src-tauri/src/lib.rs`

**Intent**: The startup recovery path needs freeze dates so frozen days are excluded from missed reps.

**Contract**: In the setup block where `compute_missed_repetitions()` is called (around line 95-137), fetch freeze records for each habit from `FreezeRepository` and pass as the new `frozen_dates` parameter. Auto-apply freezes to earliest missed days chronologically: before calling `compute_missed_repetitions()`, walk the gap's scheduled days chronologically and insert freeze records for as many as the budget allows.

#### 6. Update frontend types

**File**: `src/types/index.ts`

**Intent**: Extend TypeScript interfaces to match new backend response fields.

**Contract**: Add to `HabitStatus`: `freezes_remaining: number` and `frozen_dates: string[]`.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `pnpm tsc --noEmit` (frontend compiles with new fields)
- Rust check passes: `cd src-tauri && cargo check`
- Existing tests pass: `cd src-tauri && cargo test`

#### Manual Verification:

- Open app after missing 1 scheduled day — verify streak is preserved (not broken)
- Open app after missing 3 scheduled days — verify first 2 are frozen, 3rd breaks streak
- Verify `get_all_habit_statuses` response includes `freezes_remaining` and `frozen_dates` fields

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Frontend

### Overview

Display freeze state in the UI — snowflake cells in calendar, freeze counter on StreakHero, and frozen-day awareness in month stats.

### Changes Required:

#### 1. Frozen DayCell status

**File**: `src/components/dashboard/DayCell.tsx`

**Intent**: Add visual representation for frozen days in the calendar.

**Contract**: Add `"frozen"` to `DayCellStatus` union type. Add entry in `STATUS_CONFIG`: icy blue background (`#60a5fa` or similar), `Snowflake` icon from lucide-react (or suitable alternative). Frozen cells render same shape as done/failed (circle with icon) but in blue.

#### 2. MonthCalendar frozen day derivation

**File**: `src/components/dashboard/MonthCalendar.tsx`

**Intent**: Make calendar aware of frozen dates so it renders them with the frozen status.

**Contract**: `MonthCalendarProps` gains `frozenDates: string[]`. In `deriveDayStatus()`, after checking schedule and before marking a day as failed/partial: if the date is in `frozenDates`, return status `"frozen"` with tooltip "❄️ Streak freeze used". This check comes before the done/failed/partial logic — a frozen day renders as frozen regardless of completion state.

#### 3. StreakHero freeze counter

**File**: `src/components/dashboard/StreakHero.tsx`

**Intent**: Show remaining freeze budget below the streak number.

**Contract**: `StreakHeroProps` gains `freezesRemaining: number`. Below the streak message text, render freeze indicators: snowflake emoji (❄️) repeated `freezesRemaining` times, with used freezes shown as dimmed/empty snowflakes. Total always shows 2 positions. Use small text/badge style consistent with existing layout.

#### 4. Dashboard wiring

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Pass new freeze data from habit status to child components.

**Contract**: Extract `freezes_remaining` and `frozen_dates` from `HabitStatus` and pass to `StreakHero` and `MonthCalendar` respectively. No architectural changes — data already flows through the status object.

#### 5. MonthStats frozen days count

**File**: `src/components/dashboard/MonthStats.tsx`

**Intent**: Optionally show frozen-days count in the stats section so user sees how many freezes were used this month.

**Contract**: Add `frozenDates: string[]` to props. If any frozen dates fall in the displayed month, show a fourth stat card: "Days frozen" with snowflake icon and the count. Only show when count > 0.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `pnpm tsc --noEmit`
- Lint passes: `pnpm lint`
- Existing frontend tests pass: `pnpm test`

#### Manual Verification:

- Calendar shows snowflake cells for frozen days (icy blue circle with snowflake icon)
- StreakHero shows 2 snowflake indicators when no freezes used
- StreakHero shows 1 filled + 1 dimmed snowflake when 1 freeze used
- Calendar tooltip on frozen day shows "❄️ Streak freeze used"
- MonthStats shows "Days frozen" card when applicable
- Frozen day cell is visually distinct from done, failed, partial, and not-scheduled

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Tests

### Overview

Add comprehensive test coverage for freeze logic: unit tests for the refactored streak calculation, unit tests for recovery with frozen dates, and an integration test for the full freeze lifecycle.

### Changes Required:

#### 1. Streak calc freeze unit tests

**File**: `src-tauri/src/streak.rs` (test module)

**Intent**: Cover all freeze-related streak calculation edge cases.

**Contract**: Add tests to existing `#[cfg(test)]` module:
- `frozen_day_skipped_not_breaking` — frozen incomplete day doesn't break streak
- `frozen_day_not_counted` — frozen day doesn't increment streak count
- `freeze_budget_exhausted_breaks_streak` — 3rd missed day with only 2 freezes breaks streak
- `multiple_frozen_days_in_sequence` — 2 consecutive frozen days followed by valid days
- `frozen_and_non_scheduled_interleave` — frozen day adjacent to non-scheduled day
- `empty_frozen_dates_preserves_old_behavior` — regression guard

#### 2. Recovery freeze unit tests

**File**: `src-tauri/src/recovery.rs` (test module)

**Intent**: Cover recovery behavior with frozen dates.

**Contract**: Add tests:
- `frozen_days_excluded_from_missed_reps` — frozen scheduled day produces no MissedRepetition
- `mixed_frozen_and_missed_days` — 3-day gap with 2 frozen, 1 missed — only 1 MissedRepetition
- `all_gap_days_frozen` — 2-day gap, 2 freezes — no missed reps, no recovery modal

#### 3. Integration test: freeze lifecycle

**File**: `src-tauri/tests/freeze_integration.rs` (new file)

**Intent**: Test full freeze lifecycle through the DB — insert habit, miss days, verify freeze consumption, verify streak preserved, verify replenishment on reset.

**Contract**: Following existing `recovery_integration.rs` pattern (temp DB, migrations, repositories):
- `freeze_consumed_on_missed_day` — miss 1 day, call habit status, verify freeze record created, streak preserved
- `freeze_budget_exhausted_streak_breaks` — miss 3 days, verify 2 freeze records + streak = 0
- `freezes_replenish_on_new_streak` — break streak, complete a day, verify freeze count back to 2 (old records deleted)
- `freeze_idempotent_on_repeated_calls` — call habit status twice after miss, verify only 1 freeze record (not 2)

### Success Criteria:

#### Automated Verification:

- All Rust tests pass: `cd src-tauri && cargo test`
- New tests are included in test output (verify by name)

#### Manual Verification:

- Review test coverage — ensure edge cases from roadmap risk note are addressed (mid-day, scheduled-but-not-triggered overlay, freeze budget exhaustion)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `streak.rs`: 6 new tests covering frozen-date behavior in streak calculation
- `recovery.rs`: 3 new tests covering frozen-date exclusion in recovery

### Integration Tests:

- `freeze_integration.rs`: 4 new tests covering full DB lifecycle (consumption, exhaustion, replenishment, idempotency)

### Manual Testing Steps:

1. Create habit with daily schedule, 2 time slots
2. Complete all slots for 3 consecutive days (build streak of 3)
3. Close app, skip 1 scheduled day, reopen — verify: streak = 3 (not broken), calendar shows snowflake, StreakHero shows 1 remaining freeze
4. Close app, skip another day, reopen — verify: streak = 3, calendar shows 2 snowflakes, StreakHero shows 0 remaining
5. Close app, skip a 3rd day, reopen — verify: streak broken (0 or reset), recovery modal shows the unfrozen missed day, freezes replenished to 2

## Performance Considerations

- Freeze records per habit are bounded (max 2 per streak) — no table bloat concern
- Freeze query adds one small SELECT per `build_habit_status()` call — negligible given existing 90-day completion fetch
- Freeze consumption writes (INSERT) happen only on first status check after a missed day — subsequent calls are read-only (idempotent insert with ON CONFLICT IGNORE)
- `frozen_dates` parameter to `calculate_streak()` is a small slice (≤2 elements) — `contains()` is O(n) but n≤2

## Migration Notes

- Migration 5 is additive (new table only) — no data transformation needed
- Existing data is unaffected — habits created before this feature start with 0 freeze records (full budget of 2)
- No breaking changes to existing Tauri commands — `HabitStatusResponse` gains fields (backward compatible for JS consumers)

## References

- PRD FR-012: `context/foundation/prd.md:101-102`
- Roadmap S-04: `context/foundation/roadmap.md:124-134`
- Streak calculation: `src-tauri/src/streak.rs:12-85`
- Recovery logic: `src-tauri/src/recovery.rs:44-131`
- Habit status builder: `src-tauri/src/commands/habits.rs:62-113`
- DayCell component: `src/components/dashboard/DayCell.tsx:4-35`
- StreakHero component: `src/components/dashboard/StreakHero.tsx:18-52`
- MonthCalendar derivation: `src/components/dashboard/MonthCalendar.tsx:123-238`
- Settings pattern: `src/components/settings/SettingsView.tsx:92-119`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer + Streak Calculation

#### Automated

- [x] 1.1 Migration applies cleanly — 83ba87e
- [x] 1.2 Existing 13 streak unit tests pass with empty frozen_dates parameter — 83ba87e
- [x] 1.3 cargo check passes with new modules wired — 83ba87e

#### Manual

- [x] 1.4 Review streak_freezes table schema matches design — 83ba87e

### Phase 2: Commands + Recovery Integration

#### Automated

- [x] 2.1 Type-check passes (pnpm tsc --noEmit) — 119da28
- [x] 2.2 Rust check passes (cargo check) — 119da28
- [x] 2.3 Existing tests pass (cargo test) — 119da28

#### Manual

- [ ] 2.4 Streak preserved after missing 1 scheduled day
- [ ] 2.5 First 2 missed days frozen, 3rd breaks streak
- [ ] 2.6 get_all_habit_statuses response includes freeze fields

### Phase 3: Frontend

#### Automated

- [x] 3.1 Type-check passes (pnpm tsc --noEmit) — 0d3e705
- [x] 3.2 Lint passes (pnpm lint) — 0d3e705
- [x] 3.3 Existing frontend tests pass (pnpm test) — 0d3e705

#### Manual

- [ ] 3.4 Calendar shows snowflake cells for frozen days
- [ ] 3.5 StreakHero shows freeze indicators
- [ ] 3.6 Frozen day tooltip shows freeze message
- [ ] 3.7 MonthStats shows frozen days card when applicable

### Phase 4: Tests

#### Automated

- [x] 4.1 All Rust tests pass including new freeze tests
- [x] 4.2 New tests appear in test output by name

#### Manual

- [ ] 4.3 Review test coverage for edge cases from roadmap risk note
