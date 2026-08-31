# Dashboard Month View Implementation Plan

## Overview

Replace current minimal dashboard (habit card + today's slot statuses) with a full Duolingo-style month view. User sees streak hero (big number + fire icon + motivational message), summary stat cards (days practiced, performance badge), and a calendar grid where each day shows completion status via colored Lucide icons. Calendar supports month navigation with chevron arrows. This is primarily a frontend slice with one small backend addition.

## Current State Analysis

**Backend:** `completions` table stores per-slot results (`done`/`failed`) with `trigger_date`. `CompletionRepository::list_by_habit_since()` fetches completions from a date with no upper bound. `HabitStatusResponse` returns `streak`, `today_slots`, `today_date` — no monthly data exposed to frontend.

**Frontend:** Dashboard renders `HabitCard` (icon + name + schedule badge) and `TodayStatus` (per-slot status with emoji icons + streak badge). No calendar, no historical view. Uses Mantine 9, framer-motion, lucide-react.

**Theme:** Nunito font, teal primary, warm off-white `#F7F5F0`, sandy accent `#E28743`. Frontend CLAUDE.md mandates "joyful, playful, colorful" personality.

### Key Discoveries:

- `CompletionRepository::list_by_habit_since` at `src-tauri/src/db/completions.rs:58` — needs bounded range variant for month queries
- `HabitStatusResponse` at `src-tauri/src/commands/habits.rs:48-60` — streak calculation already works, just need to expose completions data
- `Completion` model at `src-tauri/src/models/habit.rs:34-42` — already derives `Serialize`, can be returned directly to frontend
- `DynamicIcon` at `src/components/shared/DynamicIcon.tsx:18` — runtime lucide-react lookup from string name, used for habit icons
- Dashboard route at `src/routes/dashboard.tsx:6-18` — has onboarding guard via `beforeLoad`
- Current `TodayStatus` at `src/components/dashboard/TodayStatus.tsx` — uses emoji for status icons (`✅`, `⏳`, `❌`) — will be replaced with Lucide icons per user requirement

## Desired End State

Dashboard shows a single-screen Duolingo-style view for the active habit:
1. **Streak hero** — large streak count with animated `Flame` Lucide icon and tier-based motivational message
2. **Summary stats** — two cards (days practiced + current streak) plus performance badge (GREAT/GOOD/KEEP GOING)
3. **Month calendar** — 7-column grid (Sun–Sat) with navigable month/year header. Each day cell shows completion status as a colored circle with Lucide icon:
   - Done: teal circle with `CircleCheck` icon
   - Failed: red circle with `CircleX` icon
   - Partial (e.g. 2/3 slots): orange circle with `AlertCircle` icon + fraction label
   - Not scheduled: empty/no indicator
   - Future: subtle outline circle
   - Today: highlighted ring/border

Verification: open app, see current month calendar with accurate day-by-day status reflecting actual completion data from SQLite. Navigate to previous months. Streak hero shows correct count.

## What We're NOT Doing

- Multi-habit calendar (MVP is 1 habit)
- Streak freeze display/controls (S-04 — separate slice)
- Dinosaur mascot (S-05 — separate slice)
- Week-row gradient highlights (Duolingo visual polish — defer)
- Swipe/gesture navigation (desktop app, chevrons sufficient)
- Dark mode support (FR-011 parked)
- Best streak tracking (would need additional backend state)

## Implementation Approach

Three phases: backend first (testable independently), then UI components (buildable in isolation), then dashboard integration (wires data to UI). Each phase has clear automated + manual verification.

Backend: add bounded date-range query to `CompletionRepository`, expose as `get_month_completions` Tauri command, add TypeScript wrapper.

Frontend: build four new components (`StreakHero`, `MonthCalendar`, `DayCell`, `MonthStats`) following existing Mantine + framer-motion patterns. Replace current `Dashboard.tsx` layout entirely — it becomes streak hero + stats + calendar.

## Critical Implementation Details

### Day status derivation

A day's completion status must be computed on the frontend from raw completions data, not pre-computed on the backend. The logic: for each scheduled day, count `done` vs total expected slots. All done = "done", none done = "failed" (if completions exist with `failed` status), some done = "partial" (show fraction like "2/3"). Days where the habit is not scheduled (day-of-week not in `schedule_days`) show nothing. Future days show outline only. This keeps the backend simple (just return raw completions) and gives the frontend full control over visual states.

### Month boundary computation

Calendar grid always shows full weeks. First row starts on Sunday of the week containing the 1st of the month. Last row ends on Saturday of the week containing the last day. Days outside the current month render as empty/muted cells (no status lookup). Use UTC dates per CLAUDE.md — `new Date()` is forbidden for date math; use a helper or pass dates as strings.

---

## Phase 1: Backend — Month Completions Query

### Overview

Add bounded date-range query to `CompletionRepository` and expose it as a Tauri command. Frontend gets raw `Completion[]` for any month range.

### Changes Required:

#### 1. CompletionRepository — bounded range query

**File**: `src-tauri/src/db/completions.rs`

**Intent**: Add `list_by_habit_in_range(habit_id, from_date, to_date)` method that returns completions within a closed date range. Mirrors existing `list_by_habit_since` but adds upper bound.

**Contract**: `pub fn list_by_habit_in_range(&self, habit_id: &str, from_date: &str, to_date: &str) -> Result<Vec<Completion>, AppError>` — SQL filter: `habit_id = ?1 AND trigger_date >= ?2 AND trigger_date <= ?3 ORDER BY trigger_date ASC, scheduled_time ASC`.

#### 2. Tauri command — get_month_completions

**File**: `src-tauri/src/commands/habits.rs`

**Intent**: Expose month completions to frontend. Synchronous command (follows `get_habit_status` pattern). Takes `habit_id`, `from_date`, `to_date` as strings.

**Contract**: `#[tauri::command(rename_all = "snake_case")] pub fn get_month_completions(state: State<'_, AppState>, habit_id: String, from_date: String, to_date: String) -> Result<Vec<Completion>, AppError>` — returns `Completion` directly (already `Serialize`).

#### 3. Register command

**File**: `src-tauri/src/lib.rs`

**Intent**: Add `get_month_completions` to the `generate_handler!` macro.

**Contract**: Add `commands::habits::get_month_completions` to the handler list at line ~101.

#### 4. TypeScript invoke wrapper + types

**File**: `src/lib/invoke.ts`

**Intent**: Add typed `getMonthCompletions` function wrapping the new Tauri command.

**Contract**: `export async function getMonthCompletions(habitId: string, fromDate: string, toDate: string): Promise<Completion[]>` — invokes `"get_month_completions"` with `{ habit_id: habitId, from_date: fromDate, to_date: toDate }`.

#### 5. Export Completion type from frontend types

**File**: `src/types/index.ts`

**Intent**: Ensure `Completion` interface is exported (it already exists at line 45-52). Verify it matches Rust `Completion` struct fields.

**Contract**: No change needed if already exported — verify only.

### Success Criteria:

#### Automated Verification:

- Rust unit test for `list_by_habit_in_range` passes: `cd src-tauri && cargo test`
- Rust compiles cleanly: `cd src-tauri && cargo check`
- TypeScript type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Call `getMonthCompletions` from browser console in dev mode and verify it returns correct completion data for a month with known completions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: UI Components — Calendar + Streak Hero + Stats

### Overview

Build four new components in isolation: `StreakHero`, `MonthStats`, `DayCell`, `MonthCalendar`. All use Lucide icons (not emoji), Mantine components, framer-motion animations.

### Changes Required:

#### 1. StreakHero component

**File**: `src/components/dashboard/StreakHero.tsx`

**Intent**: Big streak counter with animated Flame icon and tier-based motivational message. Duolingo-style emotional payoff section.

**Contract**: Props: `{ streak: number }`. Renders large streak number, `Flame` Lucide icon (teal/orange colored, animated scale on mount), and tier-based message string. Tiers:
- 0: "Time to start!"
- 1–2: "Nice start!"
- 3–6: "Building momentum!"
- 7–13: "One week warrior!"
- 14–29: "Unstoppable!"
- 30+: "Legendary streak!"

Uses `motion.div` for entrance animation. Mantine `Title`, `Text` for typography.

#### 2. DayCell component

**File**: `src/components/dashboard/DayCell.tsx`

**Intent**: Single calendar day cell rendering one of 5 visual states with colored circle + Lucide icon.

**Contract**: Props interface:

```typescript
interface DayCellProps {
  dayNumber: number;
  status: "done" | "failed" | "partial" | "not-scheduled" | "future" | "today-pending";
  isToday: boolean;
  isCurrentMonth: boolean;
  partialLabel?: string; // e.g. "2/3"
}
```

Visual states:
- `done`: teal background circle, `CircleCheck` icon (white)
- `failed`: red background circle, `CircleX` icon (white)
- `partial`: orange background circle, `AlertCircle` icon (white), small fraction text below
- `not-scheduled`: day number only, dimmed
- `future`: subtle outline circle, day number
- `today-pending`: teal outline ring (no fill), day number bold

Days outside current month (`isCurrentMonth: false`): render empty or very muted day number.

#### 3. MonthStats component

**File**: `src/components/dashboard/MonthStats.tsx`

**Intent**: Summary stat cards for current month + performance badge.

**Contract**: Props:

```typescript
interface MonthStatsProps {
  daysPracticed: number;
  totalScheduledDays: number;
  streak: number;
}
```

Renders two Mantine `Card` components side by side:
- Left: `CircleCheck` Lucide icon + `daysPracticed` count + "Days practiced" label
- Right: `Flame` Lucide icon + `streak` count + "Day streak" label

Performance badge above cards: computed from `daysPracticed / totalScheduledDays`:
- \>80%: "GREAT" (teal Badge)
- 50–80%: "GOOD" (orange Badge)
- <50%: "KEEP GOING" (gray Badge)

Uses Mantine `Badge`, `Card`, `Group`, `Stack`, `Text`.

#### 4. MonthCalendar component

**File**: `src/components/dashboard/MonthCalendar.tsx`

**Intent**: Full month calendar grid with navigation. Orchestrates `DayCell` components in a 7-column grid.

**Contract**: Props:

```typescript
interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed (JS Date convention)
  completions: Completion[];
  scheduleDays: number[]; // 0=Sun..6=Sat
  slotsPerDay: number;
  habitStartDate: string; // "YYYY-MM-DD"
  onMonthChange: (year: number, month: number) => void;
}
```

Renders:
- Header: "Month YYYY" with `ChevronLeft` / `ChevronRight` Lucide icons for navigation
- Day-of-week header row: Su Mo Tu We Th Fr Sa
- 5-6 rows of `DayCell` components

Derives each day's status by grouping `completions` by `trigger_date`, checking against `scheduleDays` and `slotsPerDay`. Navigation bounded: can't go before habit `start_date` month or after current month.

#### 5. Unit tests

**File**: `src/components/dashboard/DayCell.test.tsx`

**Intent**: Test all 5 visual states render correctly.

**Contract**: Test each status variant renders expected icon/text. Test `isCurrentMonth: false` renders muted.

**File**: `src/components/dashboard/MonthCalendar.test.tsx`

**Intent**: Test day status derivation from completions data and navigation bounds.

**Contract**: Test that given known completions array, correct DayCell statuses are computed. Test navigation doesn't go past habit start date or current month.

### Success Criteria:

#### Automated Verification:

- All component tests pass: `pnpm test`
- TypeScript type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Components render correctly in isolation (can verify via temporary test route or by importing into existing dashboard temporarily)
- Lucide icons display properly (no emoji anywhere)
- Framer-motion animations play on mount
- Color scheme matches theme (teal, warm off-white, sandy accent)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard Rewrite — Wire Everything Together

### Overview

Replace current `Dashboard.tsx` with new calendar-based layout. Connect data flow: load habit + completions, derive stats, handle month navigation.

### Changes Required:

#### 1. Rewrite Dashboard component

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Replace current layout with: StreakHero at top, MonthStats below, MonthCalendar filling rest. Manage month navigation state and data fetching. Keep onboarding guard (lives in route, not component). Keep `habit-updated` event listener for real-time updates.

**Contract**: Component manages:
- `currentMonth` / `currentYear` state (initialized to today's month)
- Fetches habit via `listHabits()`, status via `getHabitStatus()`, and month completions via `getMonthCompletions()` 
- Refetches completions when month changes
- Passes derived data to child components
- Keeps discriminated union state pattern (`loading | error | ready`)
- Listens to `habit-updated` Tauri event to refresh data

Layout order: `StreakHero` → `MonthStats` → `MonthCalendar`. Wrapped in `Container size="sm"` following existing pattern.

#### 2. Remove or deprecate TodayStatus

**File**: `src/components/dashboard/TodayStatus.tsx`

**Intent**: This component is replaced by the calendar view (today's cell in calendar shows status). Remove the import from Dashboard. Keep the file for now (no delete) in case it's useful for overlay or other views.

**Contract**: Remove import and usage from `Dashboard.tsx`. File remains but is unused.

#### 3. Update HabitCard (optional simplification)

**File**: `src/components/dashboard/HabitCard.tsx`

**Intent**: HabitCard still shows at top of dashboard (habit name + icon + schedule). Remove the schedule badge since calendar makes it obvious. Keep the card compact.

**Contract**: Remove the `📅` schedule Badge from HabitCard. Keep icon + name + description. Card acts as header identifying which habit the calendar is showing.

#### 4. Update Dashboard test

**File**: `src/components/dashboard/Dashboard.test.tsx`

**Intent**: Update test to verify new layout renders StreakHero, MonthStats, MonthCalendar components with correct data.

**Contract**: Mock `getMonthCompletions` invoke in addition to existing mocks. Verify streak hero, stats cards, and calendar grid render.

### Success Criteria:

#### Automated Verification:

- All tests pass: `pnpm test`
- TypeScript type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Rust tests still pass: `cd src-tauri && cargo test`

#### Manual Verification:

- Open app, dashboard shows streak hero with correct streak count
- Calendar shows current month with correct day-by-day completion status
- Navigate to previous month — data loads correctly
- Cannot navigate past habit start date or into future months
- Stats cards show correct days practiced count
- Performance badge shows correct tier (GREAT/GOOD/KEEP GOING)
- Today's cell has highlighted ring
- Lucide icons throughout — no emoji for status indicators
- Animations play smoothly on page load
- `habit-updated` event (from overlay done/snooze) refreshes calendar data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `list_by_habit_in_range` Rust unit test — verify bounded query returns correct subset
- `DayCell` — all 5 visual states render correctly
- `MonthCalendar` — day status derivation from completions, navigation bounds
- `Dashboard` — integration test with mocked Tauri invoke

### Integration Tests:

- Full flow: create habit → mark some days done/failed → open dashboard → verify calendar reflects actual data
- Month navigation: navigate back, verify data changes

### Manual Testing Steps:

1. Launch app with existing habit data
2. Verify streak hero shows correct number
3. Check each day cell matches known completion status
4. Navigate to previous month, verify data accuracy
5. Return to current month, verify today is highlighted
6. Complete a habit via overlay, return to dashboard, verify calendar updated
7. Check partial completion days show orange with fraction

## Performance Considerations

- `getMonthCompletions` fetches max ~31 days of data — small query, no pagination needed
- Calendar grid renders max 42 cells (6 weeks × 7 days) — no virtualization needed
- Completions grouped client-side via simple `reduce` — O(n) where n ≤ ~90 completions per month
- Month navigation refetches completions — could cache but unnecessary at this scale

## References

- Roadmap: `context/foundation/roadmap.md` — S-03
- PRD: `context/foundation/prd.md` — US-02, FR-008
- Existing streak logic: `src-tauri/src/streak.rs`
- Existing completions repo: `src-tauri/src/db/completions.rs`
- Current dashboard: `src/components/dashboard/Dashboard.tsx`
- Theme: `src/theme.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — Month Completions Query

#### Automated

- [x] 1.1 Rust unit test for `list_by_habit_in_range` passes — a6973f8
- [x] 1.2 Rust compiles cleanly (`cargo check`) — a6973f8
- [x] 1.3 TypeScript type-check passes (`tsc --noEmit`) — a6973f8
- [x] 1.4 Lint passes (`pnpm lint`) — a6973f8

#### Manual

- [ ] 1.5 `getMonthCompletions` returns correct data from browser console

### Phase 2: UI Components — Calendar + Streak Hero + Stats

#### Automated

- [x] 2.1 All component tests pass (`pnpm test`) — 4dab6ac
- [x] 2.2 TypeScript type-check passes (`tsc --noEmit`) — 4dab6ac
- [x] 2.3 Lint passes (`pnpm lint`) — 4dab6ac

#### Manual

- [ ] 2.4 Components render correctly with proper Lucide icons
- [ ] 2.5 Framer-motion animations play on mount
- [ ] 2.6 Color scheme matches theme

### Phase 3: Dashboard Rewrite — Wire Everything Together

#### Automated

- [x] 3.1 All tests pass (`pnpm test`)
- [x] 3.2 TypeScript type-check passes (`tsc --noEmit`)
- [x] 3.3 Lint passes (`pnpm lint`)
- [x] 3.4 Rust tests still pass (`cargo test`)

#### Manual

- [ ] 3.5 Dashboard shows streak hero with correct count
- [ ] 3.6 Calendar shows correct day-by-day completion status
- [ ] 3.7 Month navigation works within bounds
- [ ] 3.8 Stats and performance badge display correctly
- [ ] 3.9 Today cell highlighted, Lucide icons throughout
- [ ] 3.10 Overlay done/snooze refreshes calendar via event
