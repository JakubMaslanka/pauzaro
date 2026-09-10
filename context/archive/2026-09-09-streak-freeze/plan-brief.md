# Streak Freeze — Plan Brief

> Full plan: `context/changes/streak-freeze/plan.md`

## What & Why

Add per-habit streak freeze — a Duolingo-style safety net that auto-protects streaks when a scheduled day is missed. PRD FR-012 (must-have): "Użytkownik może zamrozić streak na max 2 dni — safety net zapobiegający utracie motywacji z powodu jednorazowego zdarzenia." Without this, a single missed day destroys momentum built over weeks.

## Starting Point

Streaks are computed on-demand by the pure function `calculate_streak()` in `streak.rs`, walking backwards through completions. Non-scheduled days are already skipped. No freeze state exists in the DB — the `settings` table only has `autostart_enabled`. Recovery logic scans gaps and shows missed reps for user action. 13 streak + 10 recovery unit tests + 7 integration tests cover existing behavior.

## Desired End State

Each habit has 2 auto-consuming streak freezes. Miss a scheduled day? Freeze kicks in silently — streak preserved, snowflake appears in calendar, StreakHero shows remaining budget. Miss a 3rd day? Streak breaks normally, freezes replenish for the next streak. Recovery modal auto-applies freezes to earliest missed days and only prompts for unfrozen gaps.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Activation model | Auto-consume on miss | Zero friction — user doesn't need to predict when they'll miss; matches Duolingo mental model. | Plan |
| Freeze budget | 2 per streak, replenish on reset | Simple, creates natural scarcity without being punitive. | Plan |
| Scope | Per-habit | Independent tracking scales cleanly to multi-habit; matches per-habit streak model. | Plan |
| Overlays on frozen days | Fire normally | Preserves the nudge — user might still do the habit; freeze is safety net, not skip button. | Plan |
| Consumption timing | On-demand in build_habit_status() | Pure-function approach matches existing arch; no background jobs. | Plan |
| Recovery interaction | Auto-apply to earliest missed days | Seamless — freezes work without intervention. | Plan |
| UI display | Snowflake in calendar + counter on StreakHero | Calendar tells full story at a glance; StreakHero communicates protection state. | Plan |
| Testing | Unit + integration | Matches existing test density; covers all critical paths. | Plan |

## Scope

**In scope:**
- `streak_freezes` DB table (migration 5)
- Freeze repository + model
- `calculate_streak()` refactor to skip frozen dates
- Auto-consumption in `build_habit_status()`
- Freeze replenishment on streak reset
- Recovery integration (frozen days excluded from missed reps)
- Calendar frozen-day cells (snowflake icon, icy blue)
- StreakHero freeze counter (2-position indicator)
- MonthStats frozen-days card
- Unit + integration tests

**Out of scope:**
- Manual freeze activation / pre-declaration
- Earning extra freezes via milestones
- Global freeze pool across habits
- Overlay suppression on frozen days
- Per-habit freeze budget customization
- Freeze history/log UI beyond calendar cells

## Architecture / Approach

New `streak_freezes` table stores consumed freeze records (one row per frozen date per habit). `calculate_streak()` gains `frozen_dates` parameter — frozen scheduled days are skipped like non-scheduled days. Freeze consumption happens inside `build_habit_status()` before streak calc: scan backwards for incomplete days, auto-insert freeze records up to budget (2), then pass all frozen dates to the calc. `HabitStatusResponse` gains `freezes_remaining` and `frozen_dates` fields. Recovery's `compute_missed_repetitions()` also gains frozen dates and excludes them from missed reps.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Data Layer + Streak Calc | Migration, freeze repo, refactored `calculate_streak()` | Signature change touches all existing callers and 13 unit tests |
| 2. Commands + Recovery | Freeze consumption, status response, recovery integration | Idempotency of freeze insertion on repeated status calls |
| 3. Frontend | Calendar snowflakes, StreakHero counter, MonthStats card | Correct ordering of frozen-date check vs done/failed/partial in `deriveDayStatus()` |
| 4. Tests | Unit + integration test suite | Covering the mid-day and recovery interaction edge cases |

**Prerequisites:** S-02 (overlay-habit-loop) must be complete — it is (status: done).
**Estimated effort:** ~2-3 sessions across 4 phases.

## Open Risks & Assumptions

- Freeze consumption is idempotent via `INSERT OR IGNORE` — if SQLite's `ON CONFLICT IGNORE` behaves differently than expected, duplicate freeze records could be created
- Budget is counted by total freeze records per habit (not per streak period) — replenishment via `DELETE` on streak reset is critical; if reset detection fails, budget never replenishes
- Mid-day edge case: if user completes some slots, then the day ends with incomplete slots, the incomplete day gets frozen — partial completions are "wasted" but streak is preserved (acceptable)

## Success Criteria (Summary)

- Missing 1-2 scheduled days does not break streak (freezes auto-consumed)
- Missing 3+ days breaks streak and replenishes freezes
- Calendar visually distinguishes frozen days from done/failed/partial
- Existing 30+ tests remain green; 13 new tests cover freeze behavior
