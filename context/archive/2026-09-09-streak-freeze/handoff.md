# Streak Freeze — Handoff

## Commits

| Phase | SHA | Description |
|-------|-----|-------------|
| P1 | `83ba87e` | Data layer + streak calculation |
| P2 | `119da28` | Commands + recovery integration |
| P3 | `0d3e705` | Frontend freeze display |
| P4 | `c61fd34` | Freeze unit + integration tests |

## Manual Verification Checklist

### Phase 1 — Data Layer
- [ ] Review `streak_freezes` table schema: UNIQUE(habit_id, frozen_date), CASCADE delete, index on habit_id

### Phase 2 — Commands + Recovery
- [ ] Open app after missing 1 scheduled day — streak preserved (not broken)
- [ ] Open app after missing 3 scheduled days — first 2 frozen, 3rd breaks streak
- [ ] `get_all_habit_statuses` response includes `freezes_remaining` and `frozen_dates` fields

### Phase 3 — Frontend
- [ ] Calendar shows snowflake cells for frozen days (icy blue circle with snowflake icon)
- [ ] StreakHero shows 2 snowflake indicators when no freezes used
- [ ] StreakHero shows 1 filled + 1 dimmed snowflake when 1 freeze used
- [ ] Calendar tooltip on frozen day shows "❄️ Streak freeze used"
- [ ] MonthStats shows "Days frozen" card when applicable
- [ ] Frozen day cell is visually distinct from done, failed, partial, and not-scheduled

### Phase 4 — Tests
- [ ] Review test coverage — ensure edge cases addressed: mid-day freeze, budget exhaustion, frozen + non-scheduled interleave

### End-to-End Smoke Test
1. Create habit with daily schedule, 1 time slot
2. Complete all slots for 3 consecutive days (build streak of 3)
3. Close app, skip 1 scheduled day, reopen
   - **Expect**: streak = 3, calendar shows snowflake on missed day, StreakHero shows 1 remaining freeze
4. Close app, skip another day, reopen
   - **Expect**: streak = 3, calendar shows 2 snowflakes, StreakHero shows 0 remaining
5. Close app, skip a 3rd day, reopen
   - **Expect**: streak broken (0), recovery modal shows unfrozen missed day, freezes replenished to 2

## Test Summary

- **88 Rust tests** total (41 unit + 47 integration), all passing
- **40 frontend tests**, all passing
- **New tests added**: 6 streak freeze unit, 3 recovery freeze unit, 4 freeze integration

## Files Changed

### Backend (Rust)
- `src-tauri/src/db/migrations.rs` — Migration 5: streak_freezes table
- `src-tauri/src/db/freeze.rs` — FreezeRepository (new)
- `src-tauri/src/db/mod.rs` — Register freeze module
- `src-tauri/src/models/freeze.rs` — StreakFreeze model (new)
- `src-tauri/src/models/mod.rs` — Re-export StreakFreeze
- `src-tauri/src/streak.rs` — frozen_dates param + 6 new tests
- `src-tauri/src/commands/habits.rs` — Freeze consumption, response fields, replenishment
- `src-tauri/src/recovery.rs` — frozen_dates param + 3 new tests
- `src-tauri/src/lib.rs` — Startup freeze auto-apply
- `src-tauri/tests/freeze_integration.rs` — 4 integration tests (new)
- `src-tauri/tests/recovery_integration.rs` — Updated for new param
- `src-tauri/tests/db_integration.rs` — Migration version bump

### Frontend (TypeScript/React)
- `src/types/index.ts` — HabitStatus gains freezes_remaining, frozen_dates
- `src/components/dashboard/DayCell.tsx` — "frozen" status + Snowflake icon
- `src/components/dashboard/MonthCalendar.tsx` — frozenDates prop + derivation
- `src/components/dashboard/MonthCalendar.test.tsx` — Updated for new prop
- `src/components/dashboard/StreakHero.tsx` — Freeze counter indicators
- `src/components/dashboard/Dashboard.tsx` — Wire freeze data to children
- `src/components/dashboard/MonthStats.tsx` — "Days frozen" card
