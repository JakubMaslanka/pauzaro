# Dashboard Month View — Plan Brief

> Full plan: `context/changes/dashboard-month-view/plan.md`

## What & Why

Replace current minimal dashboard (habit card + today's slot statuses) with a Duolingo-style month calendar view. FR-008 requires "full month view with per-day completion status and streak history" — the core visual identity of the product. Current dashboard only shows today's slot statuses with no historical context; users can't see their progress over time.

## Starting Point

Dashboard renders `HabitCard` (icon + name + schedule) and `TodayStatus` (emoji-based per-slot indicators + streak badge). Backend has `completions` table with full historical data but only exposes today's status via `HabitStatusResponse`. Streak calculation exists in Rust. No calendar component exists.

## Desired End State

User opens dashboard and sees: a big streak counter with animated fire icon and motivational message, two stat cards (days practiced + streak), a performance badge (GREAT/GOOD/KEEP GOING), and a full month calendar grid where each day is a colored circle with a Lucide icon showing done/failed/partial status. User can navigate to previous months. The calendar IS the dashboard.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Day status visualization | Colored circles with Lucide icons | Matches Duolingo reference, uses lucide-react per user requirement, clear 5-state system |
| Summary stats | Days practiced + streak + performance badge (3 tiers) | Motivating at-a-glance metrics without information overload |
| Streak hero | Big number + Flame icon + tier-based messages | Duolingo-proven emotional payoff pattern |
| Partial day handling | Orange/warning with fraction indicator (e.g. "2/3") | Honest feedback — user knows exactly what happened vs binary harsh judgment |
| Month navigation | Chevron arrows, bounded to habit start date ↔ current month | Standard pattern, appropriate for desktop app |
| Layout | Full page replacement of current dashboard | MVP is 1 habit — calendar IS the dashboard, no tabs needed |
| Motivational messages | Streak-tier based (6 tiers from "Time to start!" to "Legendary streak!") | Context-appropriate escalating excitement |
| Performance badge | Completion-rate based: GREAT (>80%), GOOD (50-80%), KEEP GOING (<50%) | Simple math, clear feedback |

## Scope

**In scope:**
- New Tauri command `get_month_completions` (bounded date range query)
- `StreakHero` component with animated Flame icon and tier-based messages
- `DayCell` component with 5 visual states (done/failed/partial/not-scheduled/future + today highlight)
- `MonthCalendar` component with navigation and day-status derivation
- `MonthStats` component with stat cards and performance badge
- Full dashboard rewrite replacing current layout
- Unit tests for new components and backend method

**Out of scope:**
- Multi-habit calendar (MVP is 1 habit)
- Streak freeze display (S-04)
- Dinosaur mascot (S-05)
- Week-row gradient highlights
- Dark mode
- Best streak tracking

## Architecture / Approach

Backend adds one bounded-range query method + Tauri command returning raw `Completion[]`. Frontend derives per-day status client-side from completions data (grouping by trigger_date, comparing done count to expected slots). Four new components compose the dashboard: `StreakHero` → `MonthStats` → `MonthCalendar` (containing `DayCell` grid). Data flows through existing Mantine + framer-motion + lucide-react stack.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend: month completions query | New Tauri command + DB method + TS wrapper | Low — mirrors existing `list_by_habit_since` pattern |
| 2. UI components | StreakHero, DayCell, MonthCalendar, MonthStats | Medium — 5 visual states need careful styling |
| 3. Dashboard rewrite | Full integration replacing current dashboard | Medium — data flow wiring + month navigation state |

**Prerequisites:** S-02 (overlay-habit-loop) done — completions data exists in DB
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- Assumes single-habit MVP — calendar shows one habit only. Multi-habit would need different layout.
- Day status derivation happens client-side — at current scale (≤90 completions/month) this is fine; would need server-side aggregation if data grows significantly.
- UTC date handling per CLAUDE.md — must avoid `new Date()` for date math.

## Success Criteria (Summary)

- User sees Duolingo-style month calendar with accurate per-day completion status on dashboard
- Month navigation works within bounds (habit start date to current month)
- Streak hero shows correct count with animated fire icon and motivational message
