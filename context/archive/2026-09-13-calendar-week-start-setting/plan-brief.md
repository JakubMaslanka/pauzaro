# Calendar Week Start Setting — Plan Brief

> Full plan: `context/changes/calendar-week-start-setting/plan.md`

## What & Why

Add a configurable "week starts on" setting (Sunday or Monday) that unifies the calendar grid and day picker display. Currently MonthCalendar is Sunday-first while SchedulePicker is Monday-first — this inconsistency confuses users whose locale expects a specific week start. Auto-detection from browser locale gives the right default on first launch.

## Starting Point

Settings table has one field (`autostart_enabled`), no global frontend store (SettingsView uses local `useState`). MonthCalendar hardcodes Sunday-first headers and grid math via `Date.getDay()`. SchedulePicker hardcodes Monday-first chip order. Backend `schedule_days` values (0=Sun, 6=Sat) are stable and unaffected by display order.

## Desired End State

User opens Settings → sees a "Calendar" card with Sun/Mon segmented control. Both MonthCalendar grid and SchedulePicker chips immediately reflect the choice. First launch after upgrade auto-detects locale and persists the best default. No backend data changes — `schedule_days` values stay absolute.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Week start options | Sunday and Monday only | Covers 95%+ of users; Saturday-start adds complexity for minimal benefit |
| State propagation | Zustand settings store | Matches codebase pattern (CLAUDE.md guidance), reactive, no prop drilling |
| Auto-detection method | `Intl.Locale.weekInfo` API | Precise CLDR-based detection, no manual locale list to maintain |
| Migration default | `'auto'` sentinel, frontend detects on first read | Cleanly separates "never set" from "explicitly chose Monday" without extra DB column |
| Settings UI placement | New "Calendar" card below autostart | Clean separation; room for future calendar settings |
| SchedulePicker chip reorder | Chips follow setting (both onboarding and creation) | Consistent mental model — calendar and picker agree on week start |
| Testing scope | Unit tests for grid math + locale detection + chip reorder | Covers the tricky math; settings persistence is simple CRUD |

## Scope

**In scope:**
- `week_start_day` column in settings table + Rust model/repo/command
- Zustand settings store (replaces SettingsView local state)
- Locale auto-detection via `Intl.Locale.weekInfo`
- MonthCalendar grid parameterization (headers + padding math)
- SchedulePicker chip reorder (both consumers: CreateHabitView, ScheduleStep)
- Settings Calendar card with SegmentedControl
- Unit tests for grid, detection, chip order

**Out of scope:**
- Saturday as week-start option
- Dark/light theme, i18n
- Per-habit week-start preference
- Backend `schedule_days` format changes

## Architecture / Approach

Backend adds one column to the singleton settings row. Frontend introduces a Zustand store that loads settings on app init, runs one-time locale detection if the sentinel `'auto'` is present, and exposes a resolved `WeekStartDay` to all consumers. MonthCalendar and SchedulePicker receive `weekStartDay` as a prop from their parent components (which subscribe to the store). The grid math shift for Monday-first is `(getDay() + 6) % 7`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend | Migration + Rust struct/repo/command for `week_start_day` | None — follows established singleton row pattern |
| 2. Frontend infrastructure | Zustand store, auto-detection, SettingsView refactor, invoke wrappers | Store init timing — must complete before components render |
| 3. UI components + tests | MonthCalendar grid, SchedulePicker chips, Settings card, unit tests | Grid padding math at month boundaries with shifted week start |

**Prerequisites:** S-03 (dashboard-month-view) done ✓, all parent slices complete
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- `Intl.Locale.weekInfo` is available in Tauri's WebKit/WebView2 — assumed based on Safari 15.4+ and Edge 99+ support. Fallback to "monday" if unavailable.
- Store init (`getSettings` IPC call) completes before first render of MonthCalendar/SchedulePicker. If not, components briefly show "monday" default — acceptable since IPC is local SQLite (sub-ms).

## Success Criteria (Summary)

- Switching between Sunday/Monday in Settings immediately updates MonthCalendar headers/grid and SchedulePicker chip order
- First launch after upgrade auto-detects locale and persists correct week start
- Backend `schedule_days` values remain unchanged regardless of display setting
