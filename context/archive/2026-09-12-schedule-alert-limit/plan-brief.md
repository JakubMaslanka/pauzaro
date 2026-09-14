# Schedule Alert Limit -- Plan Brief

> Full plan: `context/changes/schedule-alert-limit/plan.md`

## What & Why

Cap time slots at 10 per day in the shared `SchedulePicker` component, add an info tooltip explaining the cap, and restyle the component to be coherent with the app's Mantine-based design system. Too many daily alerts dilute their effectiveness, so a reasonable ceiling protects the user experience. The current SchedulePicker uses raw HTML inputs and hand-rolled chip styles that stand out against the rest of the Mantine-first UI. A backend validation safety net in Rust prevents any bypass of the frontend limit.

## Starting Point

`SchedulePicker` (`src/components/shared/SchedulePicker.tsx`) currently allows unlimited time slots. It uses raw `<input type="time">` and hand-rolled `UnstyledButton` day chips with verbose inline styles, both inconsistent with the app's Mantine-first pattern (all other inputs use `TextInput`). The backend `CreateHabitInput::validate()` checks that at least one slot exists but has no upper bound.

## Desired End State

The "+ Add time slot" button disables (stays visible, grayed out) once 10 slots are added. A `?` icon next to "What time?" shows a tooltip explaining the cap on hover. Day selection uses Mantine `Chip.Group` + `Chip` and time inputs use Mantine `TextInput`, making the component visually cohesive with the rest of the app. The Rust backend rejects >10 slots as a defense-in-depth measure. Both layers have unit tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Button behavior at limit | Disable (not hide) | User sees the action exists but is maxed out, no confusion about where the button went. |
| Backend validation | Include | Trivial to add and prevents any bypass of the frontend cap. |
| Tooltip text | Roadmap text as-is | Already reviewed in the roadmap: "You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness." |
| Test coverage | Frontend unit + Rust unit | Covers both layers; existing test patterns make it fast. |
| Style: day chips | Mantine Chip.Group + Chip | Idiomatic toggle pattern, replaces 20 lines of inline CSS with themed component. |
| Style: time inputs | Mantine TextInput type="time" | Matches established TextInput pattern (size="md", radius="lg"), no new dependency needed. |

## Scope

**In scope:**
- Disable add button at 10 slots in `SchedulePicker`
- Info tooltip with `CircleHelp` icon next to "What time?"
- Replace day chips with Mantine `Chip.Group` + `Chip`
- Replace raw time inputs with Mantine `TextInput type="time"`
- Clean up inline styles to use Mantine style props
- Backend validation in `CreateHabitInput::validate()`
- Unit tests for both layers

**Out of scope:**
- Retroactive enforcement on existing habits
- Changes to `ScheduleStep` or `CreateHabitView` (limit lives in the shared component)
- Restyling raw `<input type="date">` in other components (separate effort)
- Edit-habit flow changes
- `start_time` format validation (separate parked item)

## Architecture / Approach

Single-component restyle + feature addition in `SchedulePicker` plus one validation line in Rust. Day chips become Mantine `Chip.Group` + `Chip` (multiple mode, teal, radius xl). Time inputs become `TextInput type="time"` (size md, radius lg). The limit constant (`MAX_TIME_SLOTS = 10`) is defined at module level. The tooltip uses Mantine's `Tooltip` wrapping an `ActionIcon` with `CircleHelp` from lucide-react.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Frontend - limit, tooltip, and style overhaul | Disabled button at 10, info tooltip, Mantine Chip/TextInput restyle, frontend tests | Chip.Group API for multi-select needs value/onChange string conversion |
| 2. Backend - safety-net validation | Rust validation + unit test | None - 4 lines of Rust |

**Prerequisites:** None - all upstream slices (S-01) are done.
**Estimated effort:** ~1 session, both phases.

## Open Risks & Assumptions

- Assumes no existing habits have >10 time slots (extremely unlikely given the UI's auto-dedup behavior, but not enforced retroactively).

## Success Criteria (Summary)

- The add button disables at 10 slots in both onboarding and dashboard views
- The info tooltip renders with the correct explanation text
- SchedulePicker looks cohesive with the rest of the Mantine-based app (Chip day selection, TextInput time slots)
- Backend rejects habit creation with >10 time slots
