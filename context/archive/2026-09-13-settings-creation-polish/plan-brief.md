# Settings & Creation Polish - Plan Brief

> Full plan: `context/changes/settings-creation-polish/plan.md`

## What & Why

Two pre-release UX polish items (roadmap S-13 + S-14) bundled into one change. The settings view's version text should stay visible at all times as a sticky footer. The habit creation form should feel simpler by hiding date fields the user rarely needs, keeping only the schedule picker (days + times) front and center.

## Starting Point

- SettingsView already shows "Pauzaro v0.1.0" at the bottom, but it's an inline `<Text>` inside a `<Stack>` that scrolls away when content grows.
- Both `CreateHabitView` and `ScheduleStep` render start and end date fields as raw `<input type="date">` elements. Start date always defaults to today. End date is optional and rarely used.
- `@mantine/dates` is not installed. No `Collapse` component usage exists in the codebase.

## Desired End State

The settings page has a sticky version footer pinned at the bottom with a subtle visual separator, always visible regardless of scroll. The habit creation form (both dashboard and onboarding paths) shows only the schedule picker by default. A subtle "Options" text toggle with a chevron smoothly reveals a Mantine `DateInput` for the optional end date. Start date is silently set to today with no visible field.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Sticky footer approach | `position: sticky; bottom: 0` with background | Roadmap S-13 explicitly requires "always visible regardless of scroll"; flex push-down would scroll away on long pages. |
| Options toggle style | Teal text button with chevron | Minimal, doesn't compete with the main form elements; acceptable if easy to miss since end date is rarely needed. |
| Date input component | Mantine `DateInput` (new dep) | Raw `<input type="date">` violates CLAUDE.md "Mantine only" convention; swapping aligns with project standards. |
| Testing approach | Manual only | Pure layout/UX changes where automated tests add little value; existing SchedulePicker tests cover form logic. |
| Toggle label | "Options" (not "Advanced options") | The end date isn't advanced, just optional. |

## Scope

**In scope:**
- Sticky version footer in SettingsView with theme-aware background
- Remove start date field from both CreateHabitView and ScheduleStep
- Add collapsible "Options" section with Mantine DateInput for end date
- Install `@mantine/dates` + `dayjs`

**Out of scope:**
- No backend changes
- No new tests
- No changes to SchedulePicker component
- No restyling of other form elements

## Architecture / Approach

Frontend-only change. Phase 1 restructures the SettingsView layout (CSS sticky positioning). Phase 2 installs `@mantine/dates`, then removes date inputs and adds `Collapse` + `DateInput` toggle to both CreateHabitView and ScheduleStep. The form submission contract stays identical; `startDate` state is kept but its input element is removed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Settings sticky version footer | Version text pinned at bottom of settings | Minimal; CSS-only change |
| 2. Habit creation simplification | Clean schedule-only form with collapsible end date | First use of `Collapse` and `@mantine/dates` in codebase; date string conversion between DateInput (Date object) and existing state (YYYY-MM-DD string) |

**Prerequisites:** None beyond existing codebase (S-01 and S-07 are done)
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- `@mantine/dates` v9 compatibility assumed (same major version as `@mantine/core` ^9.5.2)
- `dayjs` adds a small bundle size increase (acceptable for a desktop app)
- Date string conversion (`YYYY-MM-DD` string to/from JS `Date`) must handle timezone correctly using local dates (per CLAUDE.md: "Use local time everywhere")

## Success Criteria (Summary)

- Version footer is always visible at the bottom of the settings page
- Habit creation shows only schedule picker by default; end date is one click away in "Options"
- All existing tests pass, lint and type-check clean
