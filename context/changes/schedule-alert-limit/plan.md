# Schedule Alert Limit Implementation Plan

## Overview

Cap the number of time slots in `SchedulePicker` at 10 per day, add an info tooltip explaining the cap next to the "What time?" heading, and add a backend validation safety net in Rust. Both onboarding (`ScheduleStep`) and dashboard (`CreateHabitView`) are covered because they share the same `SchedulePicker` component.

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

## Desired End State

- The "+ Add time slot" button is disabled (grayed out, not hidden) when `times.length >= 10`.
- A small `?` icon (using `CircleHelp` from lucide-react) appears next to the "What time?" heading. Hovering it shows a Mantine `Tooltip` with the text: "You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness."
- Backend `CreateHabitInput::validate()` rejects `schedule_times.len() > 10` with a clear error message.
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

## Implementation Approach

Phase 1 handles the user-facing change (frontend component + tests). Phase 2 adds the backend safety net (Rust validation + test). Both are independent and small.

---

## Phase 1: Frontend - limit + tooltip

### Overview

Modify `SchedulePicker` to disable the add button at 10 slots and show an info tooltip on the "What time?" heading. Add unit tests.

### Changes Required:

#### 1. SchedulePicker component

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Add `Tooltip` to the Mantine import list and `CircleHelp` to the lucide-react import. Insert a `?` info icon wrapped in a `Tooltip` next to the "What time?" heading text, and add a `disabled` prop to the "+ Add time slot" `Button` that activates when `times.length >= 10`.

**Contract**:
- Import `Tooltip` from `@mantine/core` (add to existing destructured import at line 1).
- Import `CircleHelp` from `lucide-react` (add to existing import at line 9).
- The "What time?" `Text` element (line 136-138) wraps in a `Group` alongside an `ActionIcon` containing `CircleHelp`, itself wrapped in a `Tooltip` with `label="You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness."`.
- The `Button` at line 181 gets `disabled={times.length >= 10}`.
- Define `const MAX_TIME_SLOTS = 10` at the module level for the comparison (avoids magic number).

#### 2. SchedulePicker unit tests

**File**: `src/components/shared/SchedulePicker.test.tsx`

**Intent**: Add tests verifying the add button is disabled at 10 slots, enabled below 10, and that the info tooltip icon renders.

**Contract**:
- Test: render with 10 time slots, assert the "+ Add time slot" button has `disabled` attribute.
- Test: render with 9 time slots, assert the button is NOT disabled.
- Test: render with any slot count, assert the tooltip trigger (the `CircleHelp` icon's parent `ActionIcon` with appropriate aria-label) is present.

### Success Criteria:

#### Automated Verification:

- All existing SchedulePicker tests still pass: `pnpm test -- SchedulePicker`
- New tests pass: button disabled at 10, enabled below 10, tooltip icon renders
- Type checking passes: `tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- In onboarding ScheduleStep, the "+ Add time slot" button disables after adding 10 slots
- In CreateHabitView, same behavior
- Hovering the `?` icon shows the tooltip text
- Removing a slot re-enables the button

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
  - Button disabled when `times.length === 10`
  - Button enabled when `times.length === 9`
  - Info icon with tooltip trigger renders
- **Backend** (`habit.rs`):
  - `validate()` rejects 11 time slots
  - `validate()` accepts 10 time slots (boundary)

### Manual Testing Steps:

1. Open onboarding flow, add time slots one by one up to 10 - verify button disables at 10
2. Remove one slot - verify button re-enables
3. Hover the `?` icon next to "What time?" - verify tooltip appears with correct text
4. Repeat steps 1-3 in the CreateHabitView (dashboard)

## References

- Roadmap entry: `context/foundation/roadmap.md` (S-10, line 232)
- Component: `src/components/shared/SchedulePicker.tsx`
- Backend validation: `src-tauri/src/models/habit.rs:84-108`
- Existing tests: `src/components/shared/SchedulePicker.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` -- <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Frontend - limit + tooltip

#### Automated

- [ ] 1.1 All existing SchedulePicker tests still pass
- [ ] 1.2 New tests pass: button disabled at 10, enabled below 10, tooltip icon renders
- [ ] 1.3 Type checking passes: `tsc --noEmit`
- [ ] 1.4 Linting passes: `pnpm lint`

#### Manual

- [ ] 1.5 Button disables at 10 slots in onboarding and dashboard
- [ ] 1.6 Tooltip shows correct text on hover
- [ ] 1.7 Removing a slot re-enables the button

### Phase 2: Backend - safety-net validation

#### Automated

- [ ] 2.1 Rust tests pass: `cd src-tauri && cargo test`
- [ ] 2.2 Rust compiles cleanly: `cd src-tauri && cargo check`
