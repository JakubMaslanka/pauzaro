# Schedule Alert Limit Implementation Plan

## Overview

Cap the number of time slots in `SchedulePicker` at 10 per day, add an info tooltip explaining the cap next to the "What time?" heading, and add a backend validation safety net in Rust. Additionally, restyle the component to be more coherent with the app's Mantine-based design system: replace raw `<input type="time">` with Mantine `TextInput`, replace hand-rolled `UnstyledButton` day chips with Mantine `Chip.Group` + `Chip`, and clean up inline styles. Both onboarding (`ScheduleStep`) and dashboard (`CreateHabitView`) are covered because they share the same `SchedulePicker` component.

## Current State Analysis

- `SchedulePicker` (`src/components/shared/SchedulePicker.tsx`) is a controlled component accepting `times: TimeSlot[]` and `onTimesChange`. No slot limit exists today.
- The "+ Add time slot" button at line 181 calls `addTimeSlot` unconditionally.
- `ActionIcon` is already imported (used for remove button). `Tooltip` is not imported yet.
- `lucide-react` is already used for icons (`X` for remove).
- Backend `CreateHabitInput::validate()` (`src-tauri/src/models/habit.rs:84-108`) checks `schedule_times.is_empty()` but has no upper-bound check.
- No existing unit tests for `validate()` in `habit.rs`.

### Key Discoveries:

- `SchedulePicker` is used in exactly two places: `ScheduleStep` (line 148) and `CreateHabitView` (line 213). Both pass the same props shape, so a single component change covers both consumers.
- The `addTimeSlot` callback has a fallback list of only 9 alternative hours, so practically the component can't auto-generate more than ~10 unique slots anyway, but users can manually type any time in the `<input type="time">`.
- `ActionIcon` with `variant="subtle"` and `size="sm"` is the established pattern for small icon buttons in this component (see remove button at line 162).
- The raw `<input type="time">` (line 144) violates the CLAUDE.md rule: "all UI must use Mantine components, never raw HTML elements for interactive controls." Other components consistently use `TextInput` with `size="md"` and `radius="lg"`.
- Day chips are hand-rolled with `UnstyledButton` + ~20 lines of inline styles (lines 108-129). Mantine's `Chip.Group` + `Chip` (multiple mode) provides the same toggle behavior with consistent theming and less code.
- `@mantine/dates` is not installed, but `TextInput type="time"` from `@mantine/core` renders the native time picker with Mantine styling.

## Desired End State

- The "+ Add time slot" button is disabled (grayed out, not hidden) when `times.length >= 10`.
- A small `?` icon (using `CircleHelp` from lucide-react) appears next to the "What time?" heading. Hovering it shows a Mantine `Tooltip` with the text: "You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness."
- Backend `CreateHabitInput::validate()` rejects `schedule_times.len() > 10` with a clear error message.
- Day selection uses Mantine `Chip.Group` + `Chip` (multiple mode) instead of hand-rolled `UnstyledButton` chips.
- Time slot inputs use Mantine `TextInput type="time"` instead of raw `<input type="time">`.
- Inline styles are replaced with Mantine style props where possible.
- Unit tests cover both the frontend cap and the backend validation.

### Verification:

- `pnpm test` passes with new SchedulePicker tests.
- `cd src-tauri && cargo test` passes with new validation test.
- `pnpm lint` and `tsc --noEmit` pass cleanly.

## What We're NOT Doing

- No migration or retroactive enforcement on existing habits that might have >10 slots (unlikely, but not blocked).
- No changes to `ScheduleStep` or `CreateHabitView` themselves - the limit lives entirely in the shared `SchedulePicker`.
- No edit-habit flow changes (the limit applies at creation time only, matching the current feature set).
- No `start_time` format validation (that's a separate parked roadmap item).
- No restyling of raw `<input type="date">` in `ScheduleStep` or `CreateHabitView` (those are separate components; only `SchedulePicker`'s time input is in scope).

## Implementation Approach

Phase 1 handles the user-facing change (frontend component + tests). Phase 2 adds the backend safety net (Rust validation + test). Both are independent and small.

---

## Phase 1: Frontend - limit, tooltip, and style overhaul

### Overview

Restyle `SchedulePicker` to use idiomatic Mantine components (Chip.Group for day selection, TextInput for time slots), add the 10-slot cap with a disabled button, add an info tooltip on the "What time?" heading, and write unit tests.

### Changes Required:

#### 1. SchedulePicker component - style overhaul

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Replace the hand-rolled day chips (`UnstyledButton` + inline styles, lines 104-131) with Mantine `Chip.Group` + `Chip` in multiple mode. Replace the raw `<input type="time">` (lines 144-159) with Mantine `TextInput type="time"`. Clean up inline styles to use Mantine style props. This aligns the component with the app's Mantine-first design system.

**Contract**:
- Import `Chip`, `TextInput`, `Tooltip` from `@mantine/core`. Remove `UnstyledButton` (no longer needed). Keep `ActionIcon`, `Button`, `Group`, `Stack`, `Text`.
- Import `CircleHelp` from `lucide-react` (alongside existing `X`).
- **Day chips**: Replace the `UnstyledButton` map (lines 104-131) with `Chip.Group multiple value={days.map(String)} onChange={...}` containing `Chip` elements for each day. The `onChange` callback converts string values back to numbers and calls `onDaysChange`. Use `color="teal"`, `variant="outline"`, `radius="xl"` on each `Chip` to match the app's playful style.
- **Time inputs**: Replace the raw `<input type="time">` with `<TextInput type="time" size="md" radius="lg" />`, matching the app's established `TextInput` pattern (see `HabitDetailsStep`, `CreateHabitView`). Carry the duplicate border styling via Mantine's `styles` prop or `error` prop rather than inline styles.
- Remove all inline `style={{...}}` objects from the day chips and time inputs. Use Mantine props (`size`, `radius`, `variant`, `color`) instead.

#### 2. SchedulePicker component - limit + tooltip

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Add the 10-slot cap and info tooltip. Disable the "+ Add time slot" button when `times.length >= 10`. Add a `?` info icon next to the "What time?" heading.

**Contract**:
- Define `const MAX_TIME_SLOTS = 10` at module level.
- The "What time?" `Text` element wraps in a `Group` alongside an `ActionIcon` containing `CircleHelp`, itself wrapped in a `Tooltip` with `label="You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness."`.
- The `Button` gets `disabled={times.length >= MAX_TIME_SLOTS}`.

#### 3. SchedulePicker unit tests

**File**: `src/components/shared/SchedulePicker.test.tsx`

**Intent**: Update existing tests to work with the new Mantine components (Chip replaces UnstyledButton, TextInput replaces raw input). Add new tests for the 10-slot cap and tooltip icon.

**Contract**:
- Update existing tests: day toggling tests should query by `Chip` role/label instead of `UnstyledButton` text. Time slot tests should work with `TextInput` instead of raw inputs.
- New test: render with 10 time slots, assert the "+ Add time slot" button has `disabled` attribute.
- New test: render with 9 time slots, assert the button is NOT disabled.
- New test: assert the tooltip trigger (the `CircleHelp` icon's parent `ActionIcon` with appropriate aria-label) is present.

### Success Criteria:

#### Automated Verification:

- All existing SchedulePicker tests still pass (updated for new components): `pnpm test -- SchedulePicker`
- New tests pass: button disabled at 10, enabled below 10, tooltip icon renders
- Type checking passes: `tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Day chips render with Mantine Chip styling (teal highlight, rounded, consistent with app theme)
- Time inputs render with Mantine TextInput styling (consistent border, radius, focus ring)
- In onboarding ScheduleStep, the "+ Add time slot" button disables after adding 10 slots
- In CreateHabitView, same behavior
- Hovering the `?` icon shows the tooltip text
- Removing a slot re-enables the button
- Overall look and feel is cohesive with the rest of the app

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Backend - safety-net validation

### Overview

Add an upper-bound check in `CreateHabitInput::validate()` to reject more than 10 time slots. Add a Rust unit test.

### Changes Required:

#### 1. CreateHabitInput validation

**File**: `src-tauri/src/models/habit.rs`

**Intent**: Add a check after the existing `schedule_times.is_empty()` guard (line 94-97) that rejects `schedule_times.len() > 10` with an `AppError::Validation` message.

**Contract**: New `if self.schedule_times.len() > 10` block returning `Err(AppError::Validation("..."))`. Placed immediately after the empty-check. Uses the same error pattern as the surrounding validations.

#### 2. Validation unit test

**File**: `src-tauri/src/models/habit.rs`

**Intent**: Add an in-module `#[cfg(test)]` block with a test that constructs a `CreateHabitInput` with 11 time slots and asserts `validate()` returns an error. Also test that 10 slots passes validation (boundary check).

**Contract**: New `#[cfg(test)] mod tests` block at the end of the file, following the pattern from `src-tauri/CLAUDE.md` (in-module tests for pure logic).

### Success Criteria:

#### Automated Verification:

- Rust tests pass: `cd src-tauri && cargo test`
- Rust compiles cleanly: `cd src-tauri && cargo check`

#### Manual Verification:

- None needed for this phase - pure validation logic covered by automated test.

---

## Testing Strategy

### Unit Tests:

- **Frontend** (`SchedulePicker.test.tsx`):
  - Existing tests updated for Chip/TextInput components
  - Button disabled when `times.length === 10`
  - Button enabled when `times.length === 9`
  - Info icon with tooltip trigger renders
- **Backend** (`habit.rs`):
  - `validate()` rejects 11 time slots
  - `validate()` accepts 10 time slots (boundary)

### Manual Testing Steps:

1. Open onboarding flow - verify day chips render with Mantine Chip styling
2. Verify time inputs render with Mantine TextInput styling (consistent border, focus ring)
3. Add time slots one by one up to 10 - verify button disables at 10
4. Remove one slot - verify button re-enables
5. Hover the `?` icon next to "What time?" - verify tooltip appears with correct text
6. Repeat steps 1-5 in the CreateHabitView (dashboard)
7. Verify the component looks cohesive with the rest of the app in both views

## References

- Roadmap entry: `context/foundation/roadmap.md` (S-10, line 232)
- Component: `src/components/shared/SchedulePicker.tsx`
- Backend validation: `src-tauri/src/models/habit.rs:84-108`
- Existing tests: `src/components/shared/SchedulePicker.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` -- <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Frontend - limit, tooltip, and style overhaul

#### Automated

- [ ] 1.1 All existing SchedulePicker tests still pass (updated for new components)
- [ ] 1.2 New tests pass: button disabled at 10, enabled below 10, tooltip icon renders
- [ ] 1.3 Type checking passes: `tsc --noEmit`
- [ ] 1.4 Linting passes: `pnpm lint`

#### Manual

- [ ] 1.5 Day chips render with Mantine Chip styling
- [ ] 1.6 Time inputs render with Mantine TextInput styling
- [ ] 1.7 Button disables at 10 slots in onboarding and dashboard
- [ ] 1.8 Tooltip shows correct text on hover
- [ ] 1.9 Removing a slot re-enables the button
- [ ] 1.10 Overall look cohesive with the rest of the app

### Phase 2: Backend - safety-net validation

#### Automated

- [ ] 2.1 Rust tests pass: `cd src-tauri && cargo test`
- [ ] 2.2 Rust compiles cleanly: `cd src-tauri && cargo check`
