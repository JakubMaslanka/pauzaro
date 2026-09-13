# Calendar Week Start Setting — Implementation Plan

## Overview

Add a user-configurable "week starts on" setting (Sunday or Monday). Auto-detected from browser locale on first launch via `Intl.Locale.weekInfo`, persisted in SQLite, and surfaced in SettingsView. Both `MonthCalendar` grid and `SchedulePicker` day chips follow the setting.

## Current State Analysis

- **MonthCalendar** (`src/components/dashboard/MonthCalendar.tsx`): hardcoded Sunday-first — `DAY_HEADERS = ["Su", "Mo", ..., "Sa"]`, grid alignment via `startDow = getDay()` (0=Sunday → column 0)
- **SchedulePicker** (`src/components/shared/SchedulePicker.tsx`): hardcoded Monday-first — `DAY_LABELS = ["Mon", ..., "Sun"]`, `DAY_VALUES = [1,...,6,0]`
- **Already inconsistent**: calendar grid shows Sunday-first, day picker shows Monday-first
- **Settings table**: singleton row pattern (`id = 1`), only `autostart_enabled` column. No global frontend store — `SettingsView` uses local `useState`, loaded on mount only
- **Backend day values**: `schedule_days` uses JS `Date.getDay()` convention (0=Sun, 6=Sat), stored in DB. Must remain stable regardless of display order
- **No date library**: pure `Date` arithmetic in `buildCalendarGrid`

### Key Discoveries:

- `buildCalendarGrid` (`MonthCalendar.tsx:41-93`): `startDow = firstOfMonth.getDay()` determines padding cells. For Monday-first, transform is `(getDay() + 6) % 7`
- `SchedulePicker` (`SchedulePicker.tsx:15-16`): parallel `DAY_LABELS`/`DAY_VALUES` arrays define chip render order — reordering these arrays is sufficient
- `SettingsRepository` (`src-tauri/src/db/settings.rs`): simple CRUD on singleton row. `get()` reads columns, `set_autostart()` updates one column. Pattern extends trivially for `week_start_day`
- `settings-changed` Tauri event (`commands/settings.rs:57`): already emitted on setting mutation — reuse for week-start changes
- Both `SchedulePicker` consumers (`CreateHabitView`, `ScheduleStep`) pass `scheduleDays: number[]` to backend unchanged — display reorder has zero backend impact
- Migration system (`migrations.rs`): forward-only, index-tracked. Currently at migration 5. New migration = index 6

## Desired End State

User opens Settings → sees a "Calendar" card with a segmented control (Sunday / Monday). Changing it immediately updates MonthCalendar grid and SchedulePicker chips everywhere. On first launch after upgrade, locale auto-detection sets the best default. Backend `schedule_days` values are never affected by display order.

**Verification:** Change setting to Sunday → MonthCalendar headers start with "Su", SchedulePicker chips start with "Sun". Change to Monday → headers start with "Mo", chips start with "Mon". Underlying `schedule_days` DB values unchanged.

## What We're NOT Doing

- Saturday as a week-start option (Middle Eastern locales) — out of scope, Sunday/Monday only
- Dark/light theme support (parked in roadmap)
- Persisting week-start preference per-habit — it's a global app setting
- Changing backend `schedule_days` storage format (0=Sun, 6=Sat stays)
- i18n of day header labels (English only, per roadmap)

## Implementation Approach

Three-phase approach: backend first (migration + Rust), then frontend infrastructure (Zustand store + auto-detection + SettingsView refactor), then UI component updates + tests.

**Auto-detection strategy**: Migration defaults `week_start_day` to `'auto'` (sentinel). On first store load, frontend detects `'auto'`, runs `Intl.Locale.weekInfo` detection, and persists the resolved value (`'sunday'` or `'monday'`). Subsequent loads see the resolved value and skip detection. User can override anytime in Settings. This avoids needing an extra DB column to track "has user explicitly chosen".

---

## Phase 1: Backend — Migration + Rust Settings Expansion

### Overview

Add `week_start_day` column to settings table. Extend Rust struct, repository, and Tauri command layer to read/write it.

### Changes Required:

#### 1. SQL Migration

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add migration 6 that adds `week_start_day` column to settings table with `'auto'` default — the sentinel value that triggers frontend auto-detection on first load.

**Contract**: New entry appended to `MIGRATIONS` array. SQL: `ALTER TABLE settings ADD COLUMN week_start_day TEXT NOT NULL DEFAULT 'auto'`.

#### 2. Settings Model

**File**: `src-tauri/src/models/settings.rs`

**Intent**: Extend `Settings` struct with `week_start_day` field so it crosses the IPC boundary.

**Contract**: Add `pub week_start_day: String` to `Settings`. Serializes as `"week_start_day"` via serde defaults. Values: `"auto"` | `"sunday"` | `"monday"`.

#### 3. Settings Repository

**File**: `src-tauri/src/db/settings.rs`

**Intent**: Update `get()` to read new column, add `set_week_start()` method for persisting changes.

**Contract**:
- `get()`: SELECT now includes `week_start_day`, maps to `Settings.week_start_day`
- `set_week_start(day: &str)`: UPDATE `week_start_day` WHERE `id = 1`. Validates input is one of `"sunday"`, `"monday"` — returns `AppError::Validation` otherwise

#### 4. Tauri Command

**File**: `src-tauri/src/commands/settings.rs`

**Intent**: Add `set_week_start` command following same pattern as `set_autostart` — persist, emit `settings-changed` event, return updated `Settings`.

**Contract**: `#[tauri::command] pub fn set_week_start(app: AppHandle, state: State<'_, AppState>, day: String) -> Result<Settings, AppError>`. Acquires DB lock, calls `repo.set_week_start(&day)`, emits `"settings-changed"`, returns `repo.get()`.

#### 5. Command Registration

**File**: `src-tauri/src/lib.rs`

**Intent**: Register `set_week_start` in Tauri's command handler.

**Contract**: Add `commands::settings::set_week_start` to `generate_handler![]` macro invocation alongside existing settings commands.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- Existing settings tests pass: `cd src-tauri && cargo test settings`
- All Rust tests pass: `cd src-tauri && cargo test`

#### Manual Verification:

- App launches without migration errors
- `get_settings` returns `week_start_day: "auto"` on fresh DB or after migration

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend Infrastructure — Zustand Store + Auto-Detection

### Overview

Create a global Zustand settings store, locale detection utility, and invoke wrappers. Refactor `SettingsView` from local state to store. Wire auto-detection on store init.

### Changes Required:

#### 1. TypeScript Type Update

**File**: `src/types/index.ts`

**Intent**: Extend `Settings` interface to include `week_start_day` and define `WeekStartDay` union type for resolved (non-auto) values.

**Contract**:
- Add `week_start_day: "auto" | "sunday" | "monday"` to `Settings` interface
- Export `type WeekStartDay = "sunday" | "monday"` — used throughout frontend for the resolved value

#### 2. Invoke Wrapper

**File**: `src/lib/invoke.ts`

**Intent**: Add typed `setWeekStart` wrapper for the new Tauri command.

**Contract**: `export async function setWeekStart(day: WeekStartDay): Promise<Settings>` — invokes `"set_week_start"` with `{ day }`.

#### 3. Locale Detection Utility

**File**: `src/lib/locale.ts` (new)

**Intent**: Detect preferred week start from browser locale using `Intl.Locale.weekInfo` API. Falls back to `"monday"` on failure.

**Contract**: `export function detectWeekStart(): WeekStartDay`. Logic:

```typescript
// Intl.Locale weekInfo uses CLDR convention: firstDay 1=Mon, 7=Sun
// Some browsers expose .weekInfo property, others .getWeekInfo() method
const weekInfo = locale.weekInfo ?? (locale as any).getWeekInfo?.();
if (weekInfo?.firstDay === 7) return "sunday";
return "monday"; // Monday for all other values (1-6) and fallback
```

#### 4. Zustand Settings Store

**File**: `src/stores/settings.ts` (new)

**Intent**: Global reactive store for app settings. Replaces local state in `SettingsView`. Handles auto-detection flow on init. Exposes resolved `weekStartDay` (never `"auto"` to consumers).

**Contract**: Interface:
```typescript
interface SettingsStore {
  weekStartDay: WeekStartDay;
  autostartEnabled: boolean;
  loaded: boolean;
  init: () => Promise<void>;
  setWeekStart: (day: WeekStartDay) => Promise<void>;
  setAutostart: (enabled: boolean) => Promise<void>;
}
```

- `init()`: Calls `getSettings()`. If `week_start_day === "auto"`, runs `detectWeekStart()`, calls `setWeekStart(detected)` to persist. Sets up `listen("settings-changed")` event handler to sync state from tray/other sources. Sets `loaded = true`.
- `setWeekStart(day)`: Calls invoke `setWeekStart(day)`, updates store state.
- `setAutostart(enabled)`: Calls invoke `setAutostart(enabled)`, updates store state. On failure, does NOT update (matches current SettingsView behavior where rollback is handled by the command).
- Store exposes only resolved `weekStartDay` (`WeekStartDay`, never `"auto"`) — consumers never see the sentinel.

#### 5. Store Initialization

**File**: `src/routes/__root.tsx`

**Intent**: Initialize settings store on app mount so it's available before any route renders.

**Contract**: In root layout component's `useEffect`, call `useSettingsStore.getState().init()`. This runs once on app start, before dashboard or onboarding routes mount.

#### 6. SettingsView Refactor

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Replace local `useState` for settings with `useSettingsStore`. Keep `toggling`, `error`, and `version` as local state (UI-only concerns).

**Contract**:
- Remove: `const [settings, setSettings] = useState(...)`, `const [loading, setLoading] = useState(true)`, the `useEffect` that calls `getSettings()`, the `listen("settings-changed")` handler (moved to store)
- Add: `const autostartEnabled = useSettingsStore(s => s.autostartEnabled)`, `const loaded = useSettingsStore(s => s.loaded)`
- `handleToggle`: calls `useSettingsStore.getState().setAutostart(...)` instead of invoke wrapper directly
- Keep: `listen("autostart-error")` handler (error display is UI-only), `toggling` local state, `version` local state

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `pnpm tsc --noEmit`
- Lint passes: `pnpm lint`
- Existing frontend tests pass: `pnpm test`

#### Manual Verification:

- App launches, settings load without errors
- SettingsView autostart toggle still works (unchanged behavior)
- Console shows detected week start on first launch (logged in store init)
- After first launch, `get_settings` returns resolved value (not `"auto"`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Components + Tests

### Overview

Wire `weekStartDay` into MonthCalendar grid and SchedulePicker chips. Add Calendar card to SettingsView. Write unit tests for grid math, locale detection, and chip reorder.

### Changes Required:

#### 1. MonthCalendar Grid Parameterization

**File**: `src/components/dashboard/MonthCalendar.tsx`

**Intent**: Make `buildCalendarGrid` and `DAY_HEADERS` respect week start setting. Sunday-first keeps current behavior. Monday-first shifts grid so Monday = column 0.

**Contract**:
- Add `weekStartDay: WeekStartDay` to `MonthCalendarProps`
- Replace const `DAY_HEADERS` with a function/lookup: Sunday-first → `["Su","Mo","Tu","We","Th","Fr","Sa"]`, Monday-first → `["Mo","Tu","We","Th","Fr","Sa","Su"]`
- `buildCalendarGrid` accepts `weekStart: WeekStartDay` parameter. Key change to `startDow` calculation:
  - Sunday-first: `startDow = firstOfMonth.getDay()` (current, unchanged)
  - Monday-first: `startDow = (firstOfMonth.getDay() + 6) % 7` — shifts so Monday=0, Sunday=6
- Previous-month fill logic uses `startDow` as-is (count of padding cells stays correct with shifted index)
- `deriveDayStatus` schedule-day check (`scheduleDays.includes(dayOfWeek)`) uses raw `getDay()` — NOT affected by display shift (day values are absolute, not relative to grid position)

#### 2. MonthCalendar Consumer Wiring

**File**: Parent component that renders `MonthCalendar` (dashboard route component)

**Intent**: Pass `weekStartDay` from Zustand store to MonthCalendar.

**Contract**: Read `const weekStartDay = useSettingsStore(s => s.weekStartDay)` and pass as prop.

#### 3. SchedulePicker Chip Reorder

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Make day chip order dynamic based on week start. Sunday-first: `[Sun, Mon, ..., Sat]`. Monday-first: `[Mon, ..., Sun]` (current behavior).

**Contract**:
- Add `weekStartDay: WeekStartDay` to `SchedulePickerProps`
- Replace const `DAY_LABELS`/`DAY_VALUES` with computed values based on prop:
  - Monday-first: labels `["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`, values `[1,2,3,4,5,6,0]` (current)
  - Sunday-first: labels `["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]`, values `[0,1,2,3,4,5,6]`
- `handleDaysChange` callback unchanged — it sorts numeric values ascending before passing to parent. Display order doesn't affect stored values

#### 4. SchedulePicker Consumer Wiring

**Files**: `src/components/habits/CreateHabitView.tsx`, `src/components/onboarding/ScheduleStep.tsx`

**Intent**: Pass `weekStartDay` from Zustand store to SchedulePicker in both consumers.

**Contract**: Both components read `const weekStartDay = useSettingsStore(s => s.weekStartDay)` and pass to `<SchedulePicker weekStartDay={weekStartDay} .../>`.

#### 5. Settings Calendar Card

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Add a "Calendar" card below the autostart card with a SegmentedControl for week start.

**Contract**:
- New card rendered after autostart `UnstyledButton`, inside the existing `Stack`
- Card uses same `.card` CSS class for visual consistency
- Contents: icon (Calendar from lucide-react) + title "First day of week" + description text + Mantine `SegmentedControl` with data `[{ label: "Sunday", value: "sunday" }, { label: "Monday", value: "monday" }]`
- Value bound to `useSettingsStore(s => s.weekStartDay)`
- onChange calls `useSettingsStore.getState().setWeekStart(value)`
- Card is non-interactive wrapper (not `UnstyledButton` like autostart) — SegmentedControl handles interaction

#### 6. MonthCalendar Grid Tests

**File**: `src/components/dashboard/MonthCalendar.test.tsx`

**Intent**: Verify `buildCalendarGrid` produces correct padding and column alignment for both week starts.

**Contract**: Test cases:
- September 2026 (starts Tuesday): Sunday-first → 2 padding cells, Monday-first → 1 padding cell
- Month starting on Sunday: Sunday-first → 0 padding, Monday-first → 6 padding
- Month starting on Monday: Sunday-first → 1 padding, Monday-first → 0 padding
- Verify grid length is always multiple of 7

Note: `buildCalendarGrid` is currently a module-private function. Export it (or extract to utility) to make it directly testable. Alternative: test through component rendering by checking which day headers render first.

#### 7. Locale Detection Tests

**File**: `src/lib/locale.test.ts` (new)

**Intent**: Verify `detectWeekStart` correctly maps Intl.Locale weekInfo to "sunday"/"monday".

**Contract**: Mock `Intl.Locale`:
- `firstDay: 7` → returns `"sunday"`
- `firstDay: 1` → returns `"monday"`
- `firstDay: 6` (Saturday locales) → returns `"monday"` (clamped, since we only support Sun/Mon)
- `weekInfo` unavailable → returns `"monday"` (fallback)
- `Intl.Locale` constructor throws → returns `"monday"` (fallback)

#### 8. SchedulePicker Chip Order Tests

**File**: `src/components/shared/SchedulePicker.test.tsx`

**Intent**: Verify chip render order matches week start setting.

**Contract**:
- `weekStartDay="monday"` → first chip text is "Mon", last is "Sun"
- `weekStartDay="sunday"` → first chip text is "Sun", last is "Sat"
- Day toggle still sends correct numeric values regardless of display order

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `pnpm tsc --noEmit`
- All tests pass: `pnpm test`
- Lint passes: `pnpm lint`
- Rust check still passes: `cd src-tauri && cargo check`

#### Manual Verification:

- Switch to "Sunday" in Settings → MonthCalendar starts with "Su", SchedulePicker starts with "Sun"
- Switch to "Monday" → MonthCalendar starts with "Mo", SchedulePicker starts with "Mon"
- Create habit with day selection → stored `schedule_days` values unchanged (0=Sun, 6=Sat)
- OnboardingScheduleStep also shows correct chip order
- Month boundaries render correctly with both settings (no missing days, no extra rows)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `buildCalendarGrid` with both week starts — padding cell count, grid alignment, boundary months
- `detectWeekStart` with mocked Intl API — Sunday/Monday detection, fallback behavior
- SchedulePicker chip reorder — correct label/value pairing for both starts

### Manual Testing Steps:

1. Fresh install: verify auto-detection picks correct start for system locale
2. Settings > Calendar card: toggle between Sunday/Monday, verify MonthCalendar and SchedulePicker update immediately
3. Create new habit: verify SchedulePicker chips follow setting in both CreateHabitView and onboarding ScheduleStep
4. Navigate to different months: verify grid padding is correct at month boundaries
5. Existing habits: verify `schedule_days` values unchanged after setting change
6. Kill and relaunch app: verify setting persists

## Performance Considerations

- Zustand store subscription: components select primitive `weekStartDay` string — no unnecessary re-renders
- `buildCalendarGrid` already memoized via `useMemo` — adding `weekStartDay` to dependency array triggers recalc only on actual change
- `DAY_LABELS`/`DAY_VALUES` derivation is trivial (array reorder) — no memoization needed beyond what React provides
- Locale detection is synchronous (reads `Intl.Locale`) — no async overhead
- Store init IPC call (`getSettings`) is local SQLite — sub-millisecond

## References

- Roadmap item: `context/foundation/roadmap.md` → S-11
- MonthCalendar source: `src/components/dashboard/MonthCalendar.tsx`
- SchedulePicker source: `src/components/shared/SchedulePicker.tsx`
- Settings backend: `src-tauri/src/db/settings.rs`, `src-tauri/src/commands/settings.rs`
- Zustand store pattern: `src/stores/dashboard.ts`
- Intl.Locale weekInfo spec: https://tc39.es/proposal-intl-locale-info/#sec-Intl.Locale.prototype.weekInfo

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — Migration + Rust Settings Expansion

#### Automated

- [x] 1.1 Rust compiles: `cd src-tauri && cargo check` — b3c8666
- [x] 1.2 Existing settings tests pass: `cd src-tauri && cargo test settings` — b3c8666
- [x] 1.3 All Rust tests pass: `cd src-tauri && cargo test` — b3c8666

#### Manual

- [ ] 1.4 App launches without migration errors
- [ ] 1.5 `get_settings` returns `week_start_day: "auto"` on fresh DB

### Phase 2: Frontend Infrastructure — Zustand Store + Auto-Detection

#### Automated

- [x] 2.1 TypeScript compiles: `pnpm tsc --noEmit` — 97a9f51
- [x] 2.2 Lint passes: `pnpm lint` — 97a9f51
- [x] 2.3 Existing frontend tests pass: `pnpm test` — 97a9f51

#### Manual

- [ ] 2.4 SettingsView autostart toggle still works
- [ ] 2.5 After first launch, `get_settings` returns resolved value (not "auto")

### Phase 3: UI Components + Tests

#### Automated

- [x] 3.1 TypeScript compiles: `pnpm tsc --noEmit`
- [x] 3.2 All tests pass (including new): `pnpm test`
- [x] 3.3 Lint passes: `pnpm lint`
- [x] 3.4 Rust check still passes: `cd src-tauri && cargo check`

#### Manual

- [ ] 3.5 Sunday setting: MonthCalendar starts "Su", SchedulePicker starts "Sun"
- [ ] 3.6 Monday setting: MonthCalendar starts "Mo", SchedulePicker starts "Mon"
- [ ] 3.7 Stored schedule_days values unchanged after setting change
- [ ] 3.8 Onboarding ScheduleStep also follows setting
- [ ] 3.9 Month boundaries render correctly with both settings
