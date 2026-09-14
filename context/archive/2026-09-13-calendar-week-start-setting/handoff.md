# Handoff: Calendar Week Start Setting

## Summary

Users can choose Sunday or Monday as the first day of the week. Auto-detected from browser locale on first launch. Both MonthCalendar grid and SchedulePicker day chips follow this setting.

## Commits

| Phase | SHA | Description |
|-------|-----|-------------|
| 1 | `b3c8666` | Backend: migration 6 adds `week_start_day` column, Rust settings expansion, `set_week_start` command |
| 2 | `97a9f51` | Frontend infra: Zustand settings store, locale detection, SettingsView refactor to store |
| 3 | `f977687` | UI: MonthCalendar grid parameterization, SchedulePicker chip reorder, Settings Calendar card, tests |

## Files Changed

### Backend (Rust)
- `src-tauri/src/db/migrations.rs` — Migration 6: `week_start_day TEXT NOT NULL DEFAULT 'auto'`
- `src-tauri/src/models/settings.rs` — Added `week_start_day: String` to Settings struct
- `src-tauri/src/db/settings.rs` — Updated `get()`, added `set_week_start()`
- `src-tauri/src/commands/settings.rs` — Added `set_week_start` Tauri command
- `src-tauri/src/lib.rs` — Registered command in `generate_handler`
- `src-tauri/src/tray.rs` — Refactored to read full settings from DB for emit
- `src-tauri/tests/db_integration.rs` — Updated migration count assertions

### Frontend (TypeScript/React)
- `src/types/index.ts` — Extended `Settings` interface, added `WeekStartDay` type
- `src/lib/invoke.ts` — Added `setWeekStart()` wrapper
- `src/lib/locale.ts` — New: `detectWeekStart()` using `Intl.Locale.weekInfo`
- `src/stores/settings.ts` — New: Zustand settings store with init/auto-detect flow
- `src/routes/__root.tsx` — Settings store init on app mount
- `src/components/settings/SettingsView.tsx` — Refactored to store, added Calendar card with SegmentedControl
- `src/components/dashboard/MonthCalendar.tsx` — `weekStartDay` prop, parameterized grid + headers, exported `buildCalendarGrid`
- `src/components/dashboard/Dashboard.tsx` — Passes `weekStartDay` from store to MonthCalendar
- `src/components/shared/SchedulePicker.tsx` — `weekStartDay` prop, dynamic chip order
- `src/components/habits/CreateHabitView.tsx` — Passes `weekStartDay` to SchedulePicker
- `src/components/onboarding/ScheduleStep.tsx` — Passes `weekStartDay` to SchedulePicker

### Tests
- `src/lib/locale.test.ts` — New: 6 tests for locale detection (Sunday, Monday, Saturday, getWeekInfo fallback, unavailable, throws)
- `src/components/dashboard/MonthCalendar.test.tsx` — Updated existing + 5 new grid math tests (padding, boundaries, both week starts)
- `src/components/shared/SchedulePicker.test.tsx` — Updated existing + 3 new chip order tests (Monday-first, Sunday-first, correct numeric values)

## Manual Verification Checklist

### First Launch / Auto-Detection
- [ ] Fresh install (or delete DB): app auto-detects locale and persists (not "auto")
- [ ] Console logs: `[settings] Auto-detected week start: <value> (locale: <lang>)`

### Settings UI
- [ ] Settings > "First day of week" card visible below autostart toggle
- [ ] SegmentedControl shows Sunday/Monday, reflects current value
- [ ] Switching immediately updates MonthCalendar headers and SchedulePicker chips
- [ ] Autostart toggle still works (unchanged behavior)

### MonthCalendar
- [ ] Sunday setting: headers start "Su Mo Tu We Th Fr Sa"
- [ ] Monday setting: headers start "Mo Tu We Th Fr Sa Su"
- [ ] Navigate to different months — grid padding correct at boundaries
- [ ] No missing days, no extra rows at month edges
- [ ] Day statuses (done/failed/partial/frozen) render correctly in both modes

### SchedulePicker
- [ ] Sunday setting: chips start "Sun Mon Tue Wed Thu Fri Sat"
- [ ] Monday setting: chips start "Mon Tue Wed Thu Fri Sat Sun"
- [ ] Day selection stores correct numeric values (0=Sun, 6=Sat) regardless of display order
- [ ] Appears correctly in both CreateHabitView and onboarding ScheduleStep

### Data Integrity
- [ ] Existing habits: `schedule_days` values unchanged after switching setting
- [ ] Create new habit, verify stored `schedule_days` match expected values
- [ ] Kill and relaunch app: setting persists

### Edge Cases
- [ ] Rapid toggle between Sunday/Monday in settings — no flicker or stale state
- [ ] Month starting on Sunday (Nov 2026): Sunday-first shows no padding, Monday-first shows 6 padding cells
- [ ] Month starting on Monday (Jun 2026): Monday-first shows no padding, Sunday-first shows 1 padding cell

## Architecture Notes

- **`'auto'` sentinel**: DB stores `'auto'` on migration. First app launch detects locale, persists resolved value. After that, DB always holds `"sunday"` or `"monday"` — consumers never see sentinel.
- **Day values stable**: Backend uses 0=Sun, 6=Sat (JS `getDay()` convention). Display order changes; stored values don't.
- **Grid math**: Sunday-first uses `getDay()` directly for column offset. Monday-first uses `(getDay() + 6) % 7` to shift Monday to column 0.
- **Store subscriptions**: Components select primitive `weekStartDay` string — minimal re-renders.
