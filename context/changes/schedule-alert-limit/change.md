---
change_id: schedule-alert-limit
title: Cap daily time slots at 10 with info tooltip
status: planned
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

See at most 10 time slots per day in the schedule picker; an info icon (question mark) next to the "What time?" section header shows a tooltip on hover explaining the cap. Same limit applies in both ScheduleStep (onboarding) and CreateHabitView (dashboard) since both use the shared SchedulePicker component. Optionally add server-side validation in Rust as a safety net.
