<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Overlay Habit Loop

- **Plan**: context/changes/overlay-habit-loop/plan.md
- **Scope**: Phase 1–4 of 4 (full plan)
- **Date**: 2026-08-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 2 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | FAIL ❌ (2 critical, 3 warnings) |
| Architecture | PASS ✅ |
| Pattern Consistency | WARNING ⚠️ (1 warning) |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Overlay sends UTC date while scheduler uses local date

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/overlay/OverlayPanel.tsx:54,75 + src-tauri/src/commands/overlay.rs
- **Detail**: OverlayPanel uses `new Date().toISOString().split("T")[0]` which produces a UTC date. The scheduler records `trigger_date` via `chrono::Local::now()`. Near midnight in a positive UTC offset, these diverge.
- **Decision**: FIXED via Fix A — scheduler passes trigger_date + scheduled_time via URL query params. Overlay reads from route search params. Dashboard lifebuoy uses today_date from backend. ScheduleStep uses local date for default start_date.

### F2 — Overlay always picks first time slot regardless of which fired

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/overlay/OverlayPanel.tsx:57
- **Detail**: `habit.schedule_times[0]?.start_time` always picks the first slot regardless of which trigger fired.
- **Decision**: FIXED — scheduledTime now passed from scheduler through URL query params (same fix as F1).

### F3 — Streak calculation ignores per-day slot count

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src-tauri/src/streak.rs:12-81
- **Detail**: `calculate_streak` counts a day as completed if it has at least one `Done` completion and no `Failed` ones. A habit with 3 daily slots where only the 10:00 slot is done (14:00 and 18:00 never triggered) counts as a full streak day. Streak inflates on partial completion. Plan specified: "A day is completed when ALL scheduled slots for that day have a completion with status='done'."
- **Decision**: FIXED — added `slots_per_day: usize` parameter. Verifies `done_count >= slots_per_day`. Updated caller + 2 new multi-slot tests.

### F4 — Dashboard fetches statuses sequentially (N+1 IPC)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/Dashboard.tsx:28-35
- **Detail**: `fetchStatuses` uses a sequential `for...of` loop with `await` — each habit status is fetched one at a time. With 5 habits, this waterfalls 5 IPC calls.
- **Decision**: FIXED — replaced with bulk `get_all_habit_statuses` command (single IPC call). Also fixes F8 (event listener no longer depends on `state`).

### F5 — No UNIQUE constraint on completions table

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src-tauri/src/db/migrations.rs:44-55
- **Detail**: Completions table has no UNIQUE constraint on `(habit_id, trigger_date, scheduled_time)`. Double-clicking Done before the overlay closes could insert duplicate completion rows. Streak/status queries still work but data grows dirty over time.
- **Decision**: SKIPPED

### F6 — Scheduler silently swallows DB errors on trigger fire

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src-tauri/src/scheduler.rs:127-133
- **Detail**: DB lock and upsert errors silently swallowed.
- **Decision**: FIXED — replaced `if let Ok` + `let _` with explicit error logging via `log::error!`.

### F7 — Pending triggers accumulate unbounded

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src-tauri/src/db/pending_triggers.rs:56-67
- **Detail**: `list_active()` returns all triggers regardless of date.
- **Decision**: FIXED — added `WHERE trigger_date >= date('now', '-1 day')` filter.

### F8 — Event listener effect re-subscribes on every state change

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/Dashboard.tsx:63-72
- **Detail**: The `listen("habit-updated")` effect depends on `[state, fetchStatuses]`. The state object reference changes on every update, tearing down and re-creating the listener. Brief window where events can be missed during re-subscription.
- **Decision**: FIXED — resolved as side effect of F4 (bulk getter removed `state` from effect deps).

### F9 — SchedulePicker mutates ref during render

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/shared/SchedulePicker.tsx:33-38
- **Detail**: `slotKeysRef.current` is mutated (push/slice) during render. Under React 18+ concurrent mode, an interrupted render leaves stale mutations. Not a bug today (Tauri's webview doesn't use concurrent features), but fragile.
- **Decision**: SKIPPED — parked in roadmap + Linear JAC-11.

### F10 — Missing input validation for time format strings

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src-tauri/src/models/habit.rs:85-108
- **Detail**: `CreateHabitInput::validate()` doesn't validate `start_time` format (expected "HH:MM").
- **Decision**: SKIPPED — parked in roadmap + Linear JAC-12.
