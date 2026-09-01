# Critical-Path Backend Logic Tests — Plan Brief

> Full plan: `context/changes/testing-critical-path-backend/plan.md`

## What & Why

Write Rust tests for the three highest-risk backend scenarios: streak calculation edge cases, snooze 3x auto-fail enforcement, and UTC date contract. These are the densest untested business logic paths — test-plan Phase 1 (T-01) covers risks #2, #3, #4 at the cheapest layer.

## Starting Point

`calculate_streak()` has 8 unit tests covering core paths. Snooze logic (`snooze_habit()`, `mark_done()`) and `PendingTriggerRepository` have zero tests. Backend uses `chrono::Local` everywhere — no UTC despite CLAUDE.md rule. Integration test infrastructure exists (`db_integration.rs` with `setup_db()` pattern).

## Desired End State

12 streak unit tests (4 new edge cases), 8 overlay integration tests in a new file covering snooze auto-fail flow and mark_done paths. All tests use UTC-formatted date strings as contracts. When the separate UTC migration change lands, these tests immediately validate it. `cargo test` passes green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Snooze testability | Integration test with real DB | Tests the actual SQL transition (count→delete→insert), not just a trivial `>= 3` check — matches test-plan anti-pattern guidance. |
| Streak test scope | Targeted additions (4 tests) | Fills real gaps (mixed status multi-slot, year boundary) without diminishing-returns exhaustive permutations. |
| UTC handling | Tests define UTC contract; migration is separate change | Each change has one job — tests exist before refactor, acting as safety net. |
| Failing UTC tests | Land both changes together (stacked) | No failing/ignored tests in tree; ship tested code together. |
| Test file location | New `overlay_integration.rs` | Clear separation from existing DB CRUD tests; duplicates `setup_db()` for file independence. |
| mark_done coverage | Test both mark_done and snooze flows | Covers both primary overlay outcomes; override_failed (lifebuoy) path also exercised. |

## Scope

**In scope:**
- 4 new streak unit tests (mixed status, year boundary, noise data, long streak)
- 8 overlay integration tests (snooze 3x, mark_done, override_failed, PendingTriggerRepository)
- UTC-formatted date strings as test contract

**Out of scope:**
- UTC migration (separate change)
- Scheduler tests (Phase 2 / T-02)
- Frontend tests
- Extracting snooze logic into pure function
- Shared test helper module

## Architecture / Approach

Two test layers: pure unit tests in `streak.rs` inline `#[cfg(test)]` module (no DB), and DB integration tests in `src-tauri/tests/overlay_integration.rs` using `tempfile` for per-test SQLite isolation. Integration tests replicate the exact DB operation sequence from `snooze_habit()` and `mark_done()` without the Tauri command wrapper.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Streak unit test hardening | 4 new edge case tests in `streak.rs` | Low — pure function tests, established pattern |
| 2. Overlay integration tests | 8 tests in new `overlay_integration.rs` | Low — follows `db_integration.rs` pattern; snooze flow logic is straightforward |

**Prerequisites:** S-02 (overlay-habit-loop) complete — it is.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Tests define UTC contract via input strings, but production code still uses Local — tests pass now because DB layer stores/compares strings. Real UTC validation happens when migration lands.
- No UNIQUE constraint on completions table (known parked item) — double-snooze could theoretically insert duplicate Failed completion. Integration test should verify single completion per slot after auto-fail.

## Success Criteria (Summary)

- `cargo test` passes with all 20+ new tests green (12 streak + 8 overlay)
- Test-plan risks #2, #3, #4 have explicit test coverage matching the Risk Response Guidance table
- UTC migration change (when it lands) can run these tests as validation without modification
