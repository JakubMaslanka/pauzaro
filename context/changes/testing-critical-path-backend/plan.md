# Critical-Path Backend Logic Tests — Implementation Plan

## Overview

Write Rust tests proving streak calculation, snooze 3x auto-fail rule, and UTC date handling are correct. Covers test-plan Phase 1 (T-01) risks #2, #3, #4. Two test layers: pure unit tests for streak edge cases, DB integration tests for snooze/mark_done flows. All tests use UTC-formatted date strings as the contract — when the separate UTC migration change lands, these tests serve as the safety net.

## Current State Analysis

### Key Discoveries:

- `streak.rs:12` — `calculate_streak()` is a pure function with 8 existing unit tests. Good coverage of core paths but missing mixed-status multi-slot, year boundary, noise data, and long streak scenarios
- `commands/overlay.rs:69` — `snooze_habit()` has **zero tests**. Logic is coupled to Tauri `AppHandle` + `State` + `spawn_blocking` — can't call directly in tests. But the DB operations it performs (upsert → increment_snooze → delete → insert completion) are testable through repositories
- `commands/overlay.rs:13` — `MAX_SNOOZE_COUNT = 3`, `SNOOZE_MINUTES = 9` are hardcoded constants. The `>= 3` check on line 101 means the 3rd snooze triggers auto-fail (snooze_count goes 0→1→2, then 2+1=3 >= 3)
- `db/pending_triggers.rs` — `PendingTriggerRepository` has 5 methods, zero tests. `increment_snooze()` uses `SET snooze_count = snooze_count + 1` in SQL — testing through the DB catches SQL-level bugs that unit tests on extracted logic would miss
- `tests/db_integration.rs:12` — Established integration test pattern: `setup_db()` creates `NamedTempFile` + `Database`, each test gets isolated SQLite. `sample_habit_input()` builds reusable fixture
- All date fields (`trigger_date`, `scheduled_time`, `next_fire_at`, `completed_at`, `created_at`) are `String` — no typed date values at the DB layer. Dates are compared as strings, which works for `YYYY-MM-DD` format regardless of timezone semantics
- Backend currently uses `chrono::Local` everywhere — UTC migration is a separate change. Tests define the UTC contract by using UTC-formatted strings

## Desired End State

After this plan:
- `streak.rs` has 12 unit tests (4 new) covering all meaningful edge cases
- `src-tauri/tests/overlay_integration.rs` exists with ~8 integration tests covering snooze 3x auto-fail flow, mark_done happy path, mark_done override_failed, and PendingTriggerRepository operations
- All tests use UTC-formatted date strings as inputs, defining the contract for the upcoming UTC migration
- `cargo test` passes with all new tests green
- Test-plan Phase 1 risks #2, #3, #4 have test coverage

### Verification:

```bash
cd src-tauri && cargo test
cd src-tauri && cargo test streak       # streak unit tests
cd src-tauri && cargo test overlay      # overlay integration tests
```

## What We're NOT Doing

- **UTC migration** — separate change; this plan writes tests assuming UTC, migration makes them true in production
- **Scheduler tests** — Phase 2 (T-02), requires mock clock / Tauri test harness
- **Overlay window behavior tests** — Phase 2 territory
- **Frontend tests** — out of scope for backend testing phase
- **Extracting snooze logic into a pure function** — decision: integration test through real DB is higher signal for this case (test plan anti-pattern: "testing counter increment in isolation without testing the transition")
- **Shared test helper module** — new test file duplicates `setup_db()` + `sample_habit_input()` for independence; extract to shared module only if a third integration test file appears

## Implementation Approach

Two-phase, bottom-up: pure unit tests first (fastest feedback loop, no DB), then DB integration tests. Each phase is independently shippable — Phase 1 adds value even if Phase 2 is delayed.

Integration tests replicate the exact DB operation sequence from `snooze_habit()` and `mark_done()` without the Tauri command wrapper. This tests the actual SQL and repository logic while avoiding the `AppHandle`/`State` coupling. The test plan's Risk #4 guidance says: test "the '3 reached → mark failed' transition" — our integration tests do exactly that, through real SQLite.

---

## Phase 1: Streak Unit Test Hardening

### Overview

Add 4 targeted unit tests to `streak.rs` covering edge cases the existing 8 tests miss. These are pure function tests — no DB, no I/O.

### Changes Required:

#### 1. Streak edge case tests

**File**: `src-tauri/src/streak.rs`

**Intent**: Add 4 tests to the existing `#[cfg(test)] mod tests` block covering: (a) multi-slot day where one slot is Done and another is Failed — verifies Failed takes precedence over Done count, (b) streak spanning a year boundary (Dec 31 → Jan 1), (c) completions existing on non-scheduled days that should be ignored as noise, (d) long streak of 30+ consecutive scheduled days.

**Contract**: Each test follows the existing pattern — call `make_completion()` to build fixtures, call `calculate_streak()`, assert expected count with `assert_eq!`. No new helper functions needed.

### Success Criteria:

#### Automated Verification:

- All 12 streak tests pass: `cd src-tauri && cargo test streak -- --nocapture`
- Type check passes: `cd src-tauri && cargo check`
- No warnings: `cd src-tauri && cargo test streak 2>&1 | grep -c warning` returns 0

#### Manual Verification:

- Review test names are descriptive and follow existing naming convention
- Verify each test exercises a genuinely distinct edge case (no redundant tests)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Overlay Integration Tests (Snooze + Mark Done)

### Overview

Create `src-tauri/tests/overlay_integration.rs` testing the full DB-level flows for snooze auto-fail and mark_done, including the PendingTriggerRepository operations that are currently untested. Tests use UTC-formatted date strings.

### Changes Required:

#### 1. New integration test file

**File**: `src-tauri/tests/overlay_integration.rs`

**Intent**: Create a new integration test file testing overlay-related DB flows. Includes `setup_db()` and `sample_habit_input()` helpers (duplicated from `db_integration.rs` for file independence). Tests the exact DB operation sequences performed by `snooze_habit()` and `mark_done()` commands, without the Tauri command wrapper.

**Contract**: Imports from `pauzaro_lib::` (the library crate). Uses `tempfile::NamedTempFile` for DB isolation. Each `#[test]` function gets its own DB via `setup_db()`. Tests follow the same assertion style as `db_integration.rs` (`assert_eq!`, `.unwrap()`, `.expect()`).

Tests to include:

1. **`pending_trigger_upsert_and_retrieve`** — upsert creates trigger, get_by_slot returns it with snooze_count=0
2. **`pending_trigger_upsert_is_idempotent`** — second upsert on same slot updates next_fire_at, doesn't duplicate
3. **`pending_trigger_increment_snooze_bumps_count`** — after increment_snooze, count goes from 0 to 1 and next_fire_at updates
4. **`snooze_three_times_triggers_auto_fail`** — full flow: create habit → upsert pending → increment 3 times → on 3rd (count >= 3): delete pending, insert Failed completion → verify pending gone, Failed completion exists
5. **`snooze_twice_does_not_auto_fail`** — after 2 increments, pending trigger still exists with count=2, no completion inserted
6. **`mark_done_deletes_pending_and_inserts_completion`** — create pending trigger → delete it → insert Done completion → verify pending gone, Done completion present
7. **`mark_done_override_failed_replaces_completion`** — insert Failed completion → delete_by_slot → insert Done → verify only Done completion exists for that slot
8. **`mark_done_without_pending_trigger_still_works`** — no pending trigger exists → insert Done completion → verify completion present (covers case where user marks done from dashboard, not overlay)

### Success Criteria:

#### Automated Verification:

- All overlay integration tests pass: `cd src-tauri && cargo test --test overlay_integration`
- Full test suite still passes: `cd src-tauri && cargo test`
- Type check passes: `cd src-tauri && cargo check`

#### Manual Verification:

- Review that snooze auto-fail test replicates the exact operation sequence from `commands/overlay.rs:88-123`
- Verify test data uses UTC-formatted date strings consistently
- Confirm no test depends on system clock or execution timing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- **Streak edge cases** — 4 new tests in `streak.rs` inline module
  - Mixed Done+Failed on same multi-slot day
  - Year boundary streak (2026-12-31 → 2027-01-01)
  - Noise completions on non-scheduled days
  - Long streak (30 consecutive days)

### Integration Tests:

- **PendingTriggerRepository** — upsert, idempotency, increment_snooze
- **Snooze auto-fail flow** — full 3-snooze sequence through DB
- **Mark done flows** — happy path, override_failed, no-pending-trigger case

### What proves the risks are covered:

| Risk | What test proves | Test location |
|------|-----------------|---------------|
| #2 (UTC dates) | Tests use UTC-formatted date strings; streak/completion logic processes them correctly | All tests — input data format |
| #3 (Streak wrong) | Hand-computed expected values for 12 distinct scenarios including multi-slot and boundary cases | `streak.rs` unit tests |
| #4 (Snooze 3x) | After exactly 3 snooze increments: pending trigger deleted, Failed completion exists, no 4th snooze possible | `overlay_integration.rs` test 4-5 |

## Performance Considerations

All tests are fast — pure unit tests have zero I/O, integration tests use in-memory SQLite via tempfile. Full test suite should complete in under 2 seconds.

## References

- Test plan: `context/foundation/test-plan.md` — Phase 1, risks #2, #3, #4
- Risk response guidance: test-plan §2 Risk Response Guidance table
- Existing integration tests: `src-tauri/tests/db_integration.rs`
- Existing streak tests: `src-tauri/src/streak.rs:87-210`
- Snooze implementation: `src-tauri/src/commands/overlay.rs:69-132`
- PendingTrigger model: `src-tauri/src/models/habit.rs:44-53`
- PendingTriggerRepository: `src-tauri/src/db/pending_triggers.rs`
- CompletionRepository: `src-tauri/src/db/completions.rs`
- Roadmap item: T-01 in `context/foundation/roadmap.md:144-155`
- Linear issue: [JAC-13](https://linear.app/jacobs-agents-playground/issue/JAC-13/t-01-critical-path-backend-logic-tests)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Streak unit test hardening

#### Automated

- [x] 1.1 All 12 streak tests pass: `cd src-tauri && cargo test streak -- --nocapture`
- [x] 1.2 Type check passes: `cd src-tauri && cargo check`
- [x] 1.3 No warnings in streak tests

#### Manual

- [x] 1.4 Test names are descriptive and follow existing naming convention
- [x] 1.5 Each test exercises a genuinely distinct edge case

### Phase 2: Overlay integration tests

#### Automated

- [ ] 2.1 All overlay integration tests pass: `cd src-tauri && cargo test --test overlay_integration`
- [ ] 2.2 Full test suite still passes: `cd src-tauri && cargo test`
- [ ] 2.3 Type check passes: `cd src-tauri && cargo check`

#### Manual

- [ ] 2.4 Snooze auto-fail test replicates exact operation sequence from overlay.rs
- [ ] 2.5 Test data uses UTC-formatted date strings consistently
- [ ] 2.6 No test depends on system clock or execution timing
