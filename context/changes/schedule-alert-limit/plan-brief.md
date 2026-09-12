# Schedule Alert Limit -- Plan Brief

> Full plan: `context/changes/schedule-alert-limit/plan.md`

## What & Why

Cap time slots at 10 per day in the shared `SchedulePicker` component and add an info tooltip explaining the cap. Too many daily alerts dilute their effectiveness, so a reasonable ceiling protects the user experience. A backend validation safety net in Rust prevents any bypass of the frontend limit.

## Starting Point

`SchedulePicker` (`src/components/shared/SchedulePicker.tsx`) currently allows unlimited time slots. It's used by both `ScheduleStep` (onboarding) and `CreateHabitView` (dashboard). The backend `CreateHabitInput::validate()` checks that at least one slot exists but has no upper bound.

## Desired End State

The "+ Add time slot" button disables (stays visible, grayed out) once 10 slots are added. A `?` icon next to "What time?" shows a tooltip explaining the cap on hover. The Rust backend rejects >10 slots as a defense-in-depth measure. Both layers have unit tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Button behavior at limit | Disable (not hide) | User sees the action exists but is maxed out, no confusion about where the button went. |
| Backend validation | Include | Trivial to add and prevents any bypass of the frontend cap. |
| Tooltip text | Roadmap text as-is | Already reviewed in the roadmap: "You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness." |
| Test coverage | Frontend unit + Rust unit | Covers both layers; existing test patterns make it fast. |

## Scope

**In scope:**
- Disable add button at 10 slots in `SchedulePicker`
- Info tooltip with `CircleHelp` icon next to "What time?"
- Backend validation in `CreateHabitInput::validate()`
- Unit tests for both layers

**Out of scope:**
- Retroactive enforcement on existing habits
- Changes to `ScheduleStep` or `CreateHabitView` (limit lives in the shared component)
- Edit-habit flow changes
- `start_time` format validation (separate parked item)

## Architecture / Approach

Single-component change in `SchedulePicker` plus one validation line in Rust. The limit constant (`MAX_TIME_SLOTS = 10`) is defined at module level in the component. The tooltip uses Mantine's `Tooltip` wrapping an `ActionIcon` with `CircleHelp` from lucide-react, matching the existing icon patterns in the component.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Frontend - limit + tooltip | Disabled button at 10, info tooltip, frontend tests | None - straightforward Mantine patterns |
| 2. Backend - safety-net validation | Rust validation + unit test | None - 4 lines of Rust |

**Prerequisites:** None - all upstream slices (S-01) are done.
**Estimated effort:** ~1 session, both phases.

## Open Risks & Assumptions

- Assumes no existing habits have >10 time slots (extremely unlikely given the UI's auto-dedup behavior, but not enforced retroactively).

## Success Criteria (Summary)

- The add button disables at 10 slots in both onboarding and dashboard views
- The info tooltip renders with the correct explanation text
- Backend rejects habit creation with >10 time slots
