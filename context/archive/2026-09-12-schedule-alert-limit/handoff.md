# Handoff: schedule-alert-limit

## Summary

Capped daily time slots at 10 in the `SchedulePicker` component with an info tooltip, restyled the component to use idiomatic Mantine components, and added a backend validation safety net in Rust.

## What Changed

### Frontend (`src/components/shared/SchedulePicker.tsx`)

- **Day chips**: Replaced hand-rolled `UnstyledButton` + inline styles with Mantine `Chip.Group` + `Chip` (multiple mode, `color="teal"`, `variant="outline"`, `radius="xl"`).
- **Time inputs**: Replaced raw `<input type="time">` with Mantine `TextInput type="time"` (`size="sm"`, `radius="md"`). Duplicate detection now uses the `error` prop instead of a separate `<Text>` element.
- **10-slot cap**: `MAX_TIME_SLOTS = 10` constant. The "+ Add time slot" button gets `disabled` when `times.length >= 10`.
- **Info tooltip**: A `CircleHelp` icon next to the "What time?" heading, wrapped in a `Tooltip` explaining the cap.

### Backend (`src-tauri/src/models/habit.rs`)

- `CreateHabitInput::validate()` now rejects `schedule_times.len() > 10` with `AppError::Validation`.
- In-module `#[cfg(test)]` tests verify the boundary (10 passes, 11 fails).

### Tests (`src/components/shared/SchedulePicker.test.tsx`)

- All 6 existing tests updated for the new Mantine components.
- 3 new tests: button disabled at 10 slots, button enabled at 9, tooltip icon renders.

## Manual Verification Checklist

These items need a human to verify in the running app:

- [ ] Day chips render with Mantine Chip styling (teal highlight, rounded, consistent with app theme)
- [ ] Time inputs render with Mantine TextInput styling (consistent border, radius, focus ring)
- [ ] In onboarding ScheduleStep, the "+ Add time slot" button disables after adding 10 slots
- [ ] In CreateHabitView (dashboard), same behavior
- [ ] Hovering the `?` icon next to "What time?" shows the tooltip text
- [ ] Removing a slot re-enables the button
- [ ] Overall look and feel is cohesive with the rest of the app in both views

## Automated Verification (all passing)

| Check | Result |
|---|---|
| `pnpm test` | 57 tests pass (9 files) |
| `pnpm lint` | Clean |
| `tsc --noEmit` | Clean |
| `cargo test` | 90 tests pass (43 unit + 47 integration) |
| `cargo check` | Clean |

## Commits

| Phase | SHA | Description |
|---|---|---|
| 1 | `9ae0d14` | Restyle SchedulePicker + add 10-slot cap with tooltip |
| 2 | `e73499a` | Backend validation for max 10 time slots |
