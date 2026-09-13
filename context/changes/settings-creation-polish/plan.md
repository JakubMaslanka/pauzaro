# Settings & Creation Polish Implementation Plan

## Overview

Two pre-release UX polish items bundled into one change:
- **S-13**: Make the existing "Pauzaro vX.Y.Z" text in SettingsView a sticky footer, always visible regardless of scroll position.
- **S-14**: Simplify the habit creation form by removing the start date field (auto-set to today silently) and collapsing the end date behind an expandable "Options" section using Mantine's `Collapse`, with the raw `<input type="date">` replaced by Mantine `DateInput`.

## Current State Analysis

### SettingsView (`src/components/settings/SettingsView.tsx`)
- Layout: `Container > motion.div > Stack` with a single autostart toggle card
- Version text already exists at the bottom: `<Text size="xs" c="dimmed" ta="center" mt="xl">Pauzaro v{version}</Text>`
- It sits inline inside the Stack, so it scrolls with content and won't stay visible when more settings cards are added
- Uses CSS Modules (`SettingsView.module.css`) with Mantine CSS variables

### CreateHabitView (`src/components/habits/CreateHabitView.tsx`)
- Two-step wizard ("details" then "schedule")
- Schedule step (lines 220-262) renders start and end date as raw `<input type="date">` with inline styles, inside a `<Group grow>`
- `startDate` defaults to today via `useState` lazy init (line 43-46)
- `endDate` defaults to empty string (line 47)
- Submits `start_date: startDate` and `end_date: endDate || undefined` to the backend

### ScheduleStep (`src/components/onboarding/ScheduleStep.tsx`)
- Nearly identical date field code (lines 155-197)
- Same `startDate` / `endDate` state pattern (lines 42-49)
- Same raw `<input type="date">` elements with identical inline styles
- Same submission shape

### Key Discoveries:

- `@mantine/dates` is not installed; it requires `dayjs` as a peer dependency (`src/components/settings/SettingsView.tsx:10`)
- No `Collapse` component usage anywhere in the codebase; this will be the first instance
- No sticky footer pattern exists in the codebase
- The `SchedulePicker` component does not handle dates; date fields live in the parent components
- The `CreateHabitInput` type has `start_date: string` (required) and `end_date?: string` (optional) - no backend changes needed

## Desired End State

After this plan is complete:
- The settings view has a sticky version footer that stays pinned at the bottom of the settings area regardless of scroll position, with a subtle visual separator from scrolling content above.
- Both `CreateHabitView` and `ScheduleStep` show only day chips + time slots as the primary form. A subtle teal "Options" text button with a chevron sits below the schedule picker. Clicking it smoothly expands to reveal a Mantine `DateInput` for the end date. Start date is silently auto-set to today with no visible field. The form submission contract remains identical.

### Verification:
- `pnpm lint` passes
- `tsc --noEmit` passes
- `pnpm test` passes (existing SchedulePicker tests still green)
- Manual: version footer stays visible when settings page content grows
- Manual: habit creation form shows only schedule picker by default, "Options" toggle reveals end date DateInput, form submits correctly with and without end date

## What We're NOT Doing

- No backend changes (start_date is still sent to the backend as today's date, end_date remains optional)
- No new tests (manual verification only for these layout/UX changes)
- No changes to the `SchedulePicker` component itself
- No restyling of other form elements beyond the date fields being touched
- No new settings or persistence changes

## Implementation Approach

Two sequential phases matching the two roadmap items. Phase 1 (settings footer) is independent and self-contained. Phase 2 (creation simplification) touches two files with nearly identical changes, plus a package install.

## Phase 1: Settings sticky version footer

### Overview

Restructure the SettingsView layout so the version text is pinned to the bottom of the visible area with `position: sticky; bottom: 0`, with a subtle visual separator so it doesn't awkwardly overlap scrolling content.

### Changes Required:

#### 1. SettingsView layout restructure

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Extract the version text from the `Stack` and position it as a sticky footer below the scrolling content. The version element needs to sit outside the Stack but inside the Container, pinned to the bottom of the settings area.

**Contract**: The version `<Text>` moves out of the `<Stack>` and into its own wrapper with `position: sticky; bottom: 0`. A CSS class in the module handles the sticky positioning, background, and subtle top border/fade matching the warm off-white (`#F7F5F0`) background. The `Container` needs minimum height to push the footer to the bottom when content is short (flex layout with `minHeight` on the container or a spacer).

#### 2. Sticky footer CSS

**File**: `src/components/settings/SettingsView.module.css`

**Intent**: Add a `.versionFooter` class that pins the version text at the bottom with a background that prevents content overlap, matching the app's warm off-white theme in both light and dark modes.

**Contract**: New `.versionFooter` class with `position: sticky; bottom: 0`, padding, centered text, and a background with subtle top fade or border using Mantine CSS variables. Needs `light-dark()` for theme-aware background color. The Stack content area above needs bottom padding to avoid being hidden behind the footer.

### Success Criteria:

#### Automated Verification:

- Lint passes: `pnpm lint`
- Type-check passes: `tsc --noEmit`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- Version text is visible at the bottom of the settings page on initial load
- Version text stays pinned when more content would cause scrolling (can test by temporarily adding placeholder cards)
- Footer has a subtle visual separator that doesn't look out of place
- Footer background matches the app theme in both light and dark contexts
- Framer Motion entrance animation still works smoothly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Habit creation simplification

### Overview

Remove the start date field from both `CreateHabitView` and `ScheduleStep`, install `@mantine/dates` + `dayjs`, and replace the raw end date `<input>` with a Mantine `DateInput` inside a `Collapse` toggle triggered by a teal text button labeled "Options".

### Changes Required:

#### 1. Install @mantine/dates and dayjs

**Intent**: Add the Mantine dates package and its dayjs peer dependency so we can use `DateInput` for the end date field.

**Contract**: `pnpm add @mantine/dates dayjs` adds both to `dependencies` in `package.json`.

#### 2. Simplify CreateHabitView schedule step

**File**: `src/components/habits/CreateHabitView.tsx`

**Intent**: Remove the entire `<Group grow>` block (lines 220-262) containing both date inputs. Replace it with a teal text button ("Options" with a rotating chevron) that toggles a Mantine `Collapse` revealing a `DateInput` for the end date. Keep `startDate` state and its auto-today initialization, but remove its visible `<input>`. The `startDate` is still passed in `handleSubmit` as before.

**Contract**: 
- Import `Collapse` from `@mantine/core` and `DateInput` from `@mantine/dates`
- Add `const [optionsOpen, setOptionsOpen] = useState(false)` state
- The toggle: a `Text` component styled as a teal link with `ChevronDown` icon from lucide-react, rotated 180deg when open (CSS transform transition)
- The `DateInput` uses `value={endDate ? new Date(endDate + "T00:00:00") : null}` and `onChange` converts back to `YYYY-MM-DD` string for the existing `endDate` state. Props: `label`, `placeholder`, `clearable`, `size="md"`, `radius="lg"` matching other inputs
- `startDate` state and its lazy initializer remain unchanged; only the `<input type="date">` element is removed
- `handleSubmit` remains unchanged (still sends `start_date: startDate` and `end_date: endDate || undefined`)

#### 3. Simplify ScheduleStep

**File**: `src/components/onboarding/ScheduleStep.tsx`

**Intent**: Same transformation as CreateHabitView: remove the `<Group grow>` block (lines 155-197), add the "Options" toggle with `Collapse` + `DateInput` for end date, keep `startDate` state hidden.

**Contract**: Identical pattern to CreateHabitView change. Same imports, same toggle behavior, same `DateInput` props. The `stagger` animation wrapper around the form section already exists and does not need changes since the Collapse sits inside it.

### Success Criteria:

#### Automated Verification:

- Dependencies install: `pnpm install` succeeds
- Lint passes: `pnpm lint`
- Type-check passes: `tsc --noEmit`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- CreateHabitView schedule step shows only day chips + time slots by default (no date fields visible)
- "Options" text button appears below the schedule picker with a chevron
- Clicking "Options" smoothly expands to show the end date DateInput
- Clicking again collapses it
- End date DateInput works (select a date, clear it)
- Creating a habit without setting end date works (start date is silently today)
- Creating a habit with an end date works
- ScheduleStep (onboarding) has the same behavior as CreateHabitView
- Onboarding flow completes successfully end-to-end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests (LOW complexity, manual verification sufficient)
- Existing `SchedulePicker.test.tsx` tests must remain green (they test day/time picking, not dates)

### Manual Testing Steps:

1. Open settings page, verify version footer is pinned at the bottom
2. Navigate to "Create habit" from dashboard, fill details, proceed to schedule step
3. Verify no date fields visible by default, only day chips and time slots
4. Click "Options" toggle, verify smooth collapse animation reveals DateInput
5. Set an end date, create the habit, verify it persists correctly
6. Create another habit without setting end date, verify start_date is today
7. Start the app fresh (onboarding flow), verify ScheduleStep has the same UX
8. Complete the full onboarding flow to confirm nothing is broken

## References

- Roadmap items: S-13 (`settings-version-footer`), S-14 (`creation-view-simplify`) in `context/foundation/roadmap.md`
- SettingsView: `src/components/settings/SettingsView.tsx`
- CreateHabitView: `src/components/habits/CreateHabitView.tsx`
- ScheduleStep: `src/components/onboarding/ScheduleStep.tsx`
- SchedulePicker: `src/components/shared/SchedulePicker.tsx`
- Mantine Collapse docs: https://mantine.dev/core/collapse/
- Mantine DateInput docs: https://mantine.dev/dates/date-input/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Settings sticky version footer

#### Automated

- [x] 1.1 Lint passes
- [x] 1.2 Type-check passes
- [x] 1.3 Existing tests pass

#### Manual

- [ ] 1.4 Version footer pinned at bottom and stays visible on scroll
- [ ] 1.5 Footer visual separator looks right in both themes
- [ ] 1.6 Entrance animation still smooth

### Phase 2: Habit creation simplification

#### Automated

- [ ] 2.1 Dependencies install successfully
- [ ] 2.2 Lint passes
- [ ] 2.3 Type-check passes
- [ ] 2.4 Existing tests pass

#### Manual

- [ ] 2.5 CreateHabitView shows only schedule picker by default
- [ ] 2.6 Options toggle reveals/hides end date DateInput smoothly
- [ ] 2.7 Habit creation works with and without end date
- [ ] 2.8 ScheduleStep (onboarding) has identical behavior
- [ ] 2.9 Full onboarding flow completes successfully
