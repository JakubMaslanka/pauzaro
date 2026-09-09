# Autostart + Settings Toggle Implementation Plan

## Overview

Wire `tauri-plugin-autostart` for OS-level login item registration, expose the toggle in two places — a checkable tray menu item and a Mantine CheckboxCard on the settings page — with bidirectional sync and an error dialog when autostart registration fails. Also refactor the growing `lib.rs` by extracting tray logic into a dedicated module.

## Current State Analysis

- **System tray**: fully implemented in `lib.rs:151-181` — `TrayIconBuilder`, "Show Dashboard" / "Quit Pauzaro" menu, close-to-tray with macOS dock hiding, `ExitRequested` prevention
- **Autostart**: zero infrastructure — no plugin, no settings, no UI
- **Settings page**: route `/settings` exists (`src/routes/settings.tsx`), component `SettingsView.tsx` renders "Coming soon!" placeholder
- **Settings persistence**: no `settings` table, no Rust model/repository/commands
- **`lib.rs`**: 278 lines, handles DB init + recovery + scheduler + tray + window events — growing monolithic

### Key Discoveries:

- `lib.rs:14` already imports `TrayIconBuilder`, `TrayIconEvent` from `tauri::tray` — need to add `CheckMenuItemBuilder` from `tauri::menu`
- `lib.rs:156-158` builds tray menu with `MenuBuilder` — inserting a `CheckMenuItem` between existing items is straightforward
- `Cargo.toml:21` has `tauri` with `tray-icon` + `image-png` features — no new Tauri features needed
- Migrations tracked by `schema_version` table (currently at index 3) — migration 4 adds `settings` table
- `capabilities/default.json` needs autostart permission entries
- Existing persistence pattern (model → repository → command → invoke wrapper) is well-established and consistent across habits, user_profile, completions

## Desired End State

App registers/unregisters as OS login item via `tauri-plugin-autostart`. User can toggle "Launch on startup" from:
1. Tray menu — checkable menu item with checkmark reflecting current state
2. Settings page — Mantine CheckboxCard component

Both controls stay in sync: toggling one updates the other. Preference persists in SQLite `settings` table. On autostart registration failure, a dialog explains the issue and guides the user to OS settings. `lib.rs` is leaner with tray logic extracted to `tray.rs`.

## What We're NOT Doing

- Reworking existing tray menu items or close-to-tray behavior (already working)
- Adding other settings beyond autostart toggle (future work)
- Onboarding step for autostart (off by default, user opts in)
- Cross-platform testing matrix (deferred to T-03)
- Custom launch arguments for autostart

## Implementation Approach

Bottom-up: persistence layer first (migration + model + repository), then autostart plugin wiring with Tauri commands, then refactor `lib.rs` to extract tray module, then add `CheckMenuItem` to tray, finally frontend settings page with sync events. Each phase is independently testable.

## Critical Implementation Details

### Timing & lifecycle

Autostart plugin must be registered as a `.plugin()` call on the builder (before `.setup()`), not inside the setup closure. The tray `CheckMenuItem` initial checked state must read from the DB inside `.setup()` after the database is initialized — ordering matters. The `CheckMenuItem` handle must be stored in Tauri managed state so commands can update it when the frontend toggles autostart.

---

## Phase 1: Backend Foundation

### Overview

Add `settings` table, Rust persistence layer, `tauri-plugin-autostart` dependency, and Tauri commands for reading/writing autostart preference.

### Changes Required:

#### 1. Settings migration

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add migration 4 creating a single-row `settings` table with `autostart_enabled` column, defaulting to `0` (off). Follows the `app_state` singleton pattern (CHECK constraint on id = 1).

**Contract**: New entry appended to `MIGRATIONS` array at index 4. Table: `settings(id INTEGER PRIMARY KEY CHECK (id = 1), autostart_enabled INTEGER NOT NULL DEFAULT 0)`. Seed row inserted with `INSERT OR IGNORE`.

#### 2. Settings model

**File**: `src-tauri/src/models/settings.rs` (new)

**Intent**: Define `Settings` struct for IPC serialization and `UpdateSettingsInput` for the update command.

**Contract**: `Settings { autostart_enabled: bool }` with `Serialize`. `UpdateSettingsInput { autostart_enabled: bool }` with `Deserialize`. Re-export from `src-tauri/src/models/mod.rs`.

#### 3. Settings repository

**File**: `src-tauri/src/db/settings.rs` (new)

**Intent**: Database access for the settings singleton row. Read current settings, update autostart preference.

**Contract**: `SettingsRepository<'a>` with `new(conn)`, `get() -> Result<Settings, AppError>`, `set_autostart(enabled: bool) -> Result<(), AppError>`. Register module in `src-tauri/src/db/mod.rs`.

#### 4. Autostart plugin dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `tauri-plugin-autostart` crate for OS-level login item management.

**Contract**: `tauri-plugin-autostart = "2"` in `[dependencies]`.

**File**: `package.json`

**Intent**: Add JS bindings for autostart plugin (needed for capabilities, even though we use Rust-side API).

**Contract**: `"@tauri-apps/plugin-autostart": "^2"` in `dependencies`.

#### 5. Autostart plugin registration

**File**: `src-tauri/src/lib.rs`

**Intent**: Register autostart plugin on the Tauri builder so the `AutoLaunch` API is available.

**Contract**: `.plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))` added to builder chain alongside existing `.plugin()` calls.

#### 6. Capabilities update

**File**: `src-tauri/capabilities/default.json`

**Intent**: Grant autostart permissions so the plugin commands are accessible.

**Contract**: Add `"autostart:allow-enable"`, `"autostart:allow-disable"`, `"autostart:allow-is-enabled"` to the `permissions` array.

#### 7. Settings Tauri commands

**File**: `src-tauri/src/commands/settings.rs` (new)

**Intent**: Thin command layer for get/set settings. `set_autostart` command: persists preference to DB, calls autostart plugin `enable()`/`disable()`, and returns result. On plugin failure, returns an `AppError` so frontend can show error dialog.

**Contract**:
- `get_settings(state: State<AppState>) -> Result<Settings, AppError>` — reads from DB
- `set_autostart(app: AppHandle, state: State<AppState>, enabled: bool) -> Result<Settings, AppError>` — writes to DB, calls `app.autolaunch().enable()` or `.disable()`, returns updated settings. On autolaunch failure: rolls back DB write, returns `AppError::Autostart(String)`

Register module in `src-tauri/src/commands/mod.rs`. Register both commands in `lib.rs` invoke_handler.

#### 8. AppError variant

**File**: `src-tauri/src/error.rs`

**Intent**: Add `Autostart` variant for autostart registration failures, with descriptive message for the frontend error dialog.

**Contract**: `AppError::Autostart(String)` variant added. Display impl: `"Autostart error: {msg}"`.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- Unit tests pass: `cd src-tauri && cargo test`
- Migration applies on fresh DB (tested via existing migration runner)

#### Manual Verification:

- `pnpm tauri dev` starts without errors
- Settings table exists in SQLite with seed row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Refactor — Extract Tray Module

### Overview

Move tray setup, close-to-tray window event handler, and `show_main_window` helper from `lib.rs` into a dedicated `tray.rs` module. Reduces `lib.rs` to builder chain + setup orchestration. No behavioral changes.

### Changes Required:

#### 1. New tray module

**File**: `src-tauri/src/tray.rs` (new)

**Intent**: Encapsulate all tray-related code in one file — tray icon construction, menu building, menu event handling, tray click handling, close-to-tray window event, and `show_main_window` helper.

**Contract**: Public function `pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>>` that takes the `App` reference from `.setup()` and performs all tray initialization (currently `lib.rs:151-205`). Public function `pub fn show_main_window(app: &tauri::AppHandle)` (currently `lib.rs:267-277`). All tray-related imports move here.

#### 2. Update lib.rs

**File**: `src-tauri/src/lib.rs`

**Intent**: Replace inline tray code with a call to `tray::setup_tray(app)?`. Remove tray-related imports that moved to `tray.rs`. Add `pub mod tray;` declaration.

**Contract**: `.setup()` closure calls `tray::setup_tray(app)?` where tray code previously lived. `show_main_window` references in `.run()` callback change to `tray::show_main_window(app)`. Lines 151-205 and 267-277 removed from `lib.rs`.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- All tests pass: `cd src-tauri && cargo test`
- Frontend type-check passes: `tsc --noEmit`

#### Manual Verification:

- Tray icon appears, menu works (Show Dashboard, Quit)
- Close-to-tray still works (close window → hides to tray, not quit)
- macOS dock icon hides/shows correctly
- Behavior identical to before refactor

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Tray Menu Integration

### Overview

Add a `CheckMenuItem` "Launch on startup" to the tray menu between "Show Dashboard" and "Quit Pauzaro". Read initial checked state from DB on startup. Wire toggle to `set_autostart` logic. Emit Tauri event for frontend sync.

### Changes Required:

#### 1. CheckMenuItem in tray menu

**File**: `src-tauri/src/tray.rs`

**Intent**: Add a checkable "Launch on startup" menu item between existing items. Read initial autostart state from settings DB. Store the `CheckMenuItem` handle in managed state so other parts of the app can update its checked state.

**Contract**: `CheckMenuItemBuilder::with_id("autostart", "Launch on startup").checked(initial_state).build(app)?` inserted into `MenuBuilder` between `show` and `quit` items. A separator above "Quit" for visual grouping. New managed state struct (e.g., `TrayState { autostart_item: CheckMenuItem<Wry> }`) to hold the menu item handle.

#### 2. Tray menu event handler for autostart

**File**: `src-tauri/src/tray.rs`

**Intent**: Handle "autostart" menu event — toggle the autostart setting by calling the same logic as the Tauri command, then update the checkmark state. On failure, revert checkmark and show error dialog.

**Contract**: In `on_menu_event`, match `"autostart"` id. Read current checked state from the `CheckMenuItem`, call autostart enable/disable + DB write, emit `"settings-changed"` event to frontend. On failure: revert `.set_checked()`, show `tauri::api::dialog::MessageDialogBuilder` with error guidance.

#### 3. Sync event emission from commands

**File**: `src-tauri/src/commands/settings.rs`

**Intent**: When `set_autostart` command is called (from frontend), also update tray `CheckMenuItem` state and emit sync event so any open settings page reflects the change.

**Contract**: `set_autostart` command accesses `TrayState` from managed state, calls `tray_state.autostart_item.set_checked(enabled)`. Emits `"settings-changed"` event with `Settings` payload.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- All tests pass: `cd src-tauri && cargo test`

#### Manual Verification:

- Tray menu shows: "Show Dashboard" / "Launch on startup" / separator / "Quit Pauzaro"
- "Launch on startup" shows unchecked by default
- Clicking toggles checkmark and registers/unregisters login item
- After toggle on + app restart, checkmark persists as checked
- Login item appears in macOS System Settings > General > Login Items

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Frontend Settings Page

### Overview

Replace the SettingsView placeholder with a functional page featuring a Mantine CheckboxCard for autostart toggle. Add TypeScript types, invoke wrappers, and event listener for tray↔frontend sync. Show error dialog on failure.

### Changes Required:

#### 1. TypeScript types

**File**: `src/types/index.ts`

**Intent**: Add `Settings` interface matching Rust model.

**Contract**: `interface Settings { autostart_enabled: boolean; }` appended to existing types.

#### 2. Invoke wrappers

**File**: `src/lib/invoke.ts`

**Intent**: Add typed wrappers for settings Tauri commands.

**Contract**: `getSettings(): Promise<Settings>` wrapping `invoke("get_settings")`. `setAutostart(enabled: boolean): Promise<Settings>` wrapping `invoke("set_autostart", { enabled })`.

#### 3. SettingsView with CheckboxCard

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Replace "Coming soon!" stub with a functional settings page. Central content: a Mantine CheckboxCard (pattern from `ui.mantine.dev/component/checkbox-card/`) for "Launch on startup" toggle. Card shows title, description ("Start Pauzaro automatically when you log in"), and a checkbox. Loads current state on mount via `getSettings()`, toggles via `setAutostart()`.

**Contract**: Component fetches settings on mount, renders a CheckboxCard. On toggle: calls `setAutostart`, updates local state on success, shows Mantine `notifications` or modal dialog on failure with guidance text ("Could not register login item. Check System Settings > General > Login Items."). Listens for `"settings-changed"` Tauri event to sync when tray toggle is used while page is open.

#### 4. Tauri event listener for sync

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Subscribe to `"settings-changed"` events emitted by tray toggle so the CheckboxCard stays in sync without polling.

**Contract**: `useEffect` with `listen("settings-changed", ...)` from `@tauri-apps/api/event`. Updates local settings state when event received. Cleanup on unmount.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Frontend tests pass: `pnpm test`

#### Manual Verification:

- Settings page shows CheckboxCard for "Launch on startup"
- Toggling card calls backend and updates checkbox state
- Toggling tray menu item updates settings page in real time (if open)
- Toggling settings page updates tray checkmark
- On autostart failure: error dialog appears with actionable guidance
- Settings page animation consistent with app style (Framer Motion fade-in)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `SettingsRepository::get()` returns default settings on fresh DB
- `SettingsRepository::set_autostart(true)` persists and reads back correctly
- `set_autostart` command rolls back DB on autostart plugin failure (mock plugin)
- Settings page renders checkbox in correct initial state (mock invoke)

### Integration Tests:

- Migration 4 applies cleanly on existing DB with schema_version 3
- Full toggle cycle: get → set(true) → get confirms true → set(false) → get confirms false

### Manual Testing Steps:

1. Fresh install: settings page shows autostart unchecked
2. Enable via tray → check macOS Login Items → restart app → checkmark persists
3. Disable via settings page → check macOS Login Items removed → tray unchecked
4. Toggle tray while settings page open → checkbox updates
5. Toggle settings page → tray checkmark updates
6. Simulate failure (revoke permissions) → error dialog appears

## Performance Considerations

Negligible impact. Settings read is one SQLite query on a single-row table — sub-millisecond. Autostart enable/disable is a one-shot OS API call. Tauri event for sync is lightweight. No polling, no background tasks.

## References

- Tauri autostart plugin docs: https://v2.tauri.app/plugin/autostart/
- Mantine CheckboxCard pattern: https://ui.mantine.dev/component/checkbox-card/
- Existing tray implementation: `src-tauri/src/lib.rs:151-181`
- Settings page stub: `src/components/settings/SettingsView.tsx`
- Migration pattern: `src-tauri/src/db/migrations.rs`
- Repository pattern: `src-tauri/src/db/app_state.rs`
- Command pattern: `src-tauri/src/commands/user_profile.rs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend Foundation

#### Automated

- [x] 1.1 Rust compiles: `cd src-tauri && cargo check` — bd4e2d9
- [x] 1.2 Unit tests pass: `cd src-tauri && cargo test` — bd4e2d9
- [x] 1.3 Migration applies on fresh DB — bd4e2d9

#### Manual

- [ ] 1.4 `pnpm tauri dev` starts without errors
- [ ] 1.5 Settings table exists in SQLite with seed row

### Phase 2: Refactor — Extract Tray Module

#### Automated

- [ ] 2.1 Rust compiles: `cd src-tauri && cargo check`
- [ ] 2.2 All tests pass: `cd src-tauri && cargo test`
- [ ] 2.3 Frontend type-check passes: `tsc --noEmit`

#### Manual

- [ ] 2.4 Tray icon appears, menu works
- [ ] 2.5 Close-to-tray still works
- [ ] 2.6 macOS dock icon hides/shows correctly

### Phase 3: Tray Menu Integration

#### Automated

- [ ] 3.1 Rust compiles: `cd src-tauri && cargo check`
- [ ] 3.2 All tests pass: `cd src-tauri && cargo test`

#### Manual

- [ ] 3.3 Tray menu shows correct items in order
- [ ] 3.4 Toggle works and registers/unregisters login item
- [ ] 3.5 Checkmark persists across app restart
- [ ] 3.6 Login item visible in macOS System Settings

### Phase 4: Frontend Settings Page

#### Automated

- [ ] 4.1 Type-check passes: `tsc --noEmit`
- [ ] 4.2 Lint passes: `pnpm lint`
- [ ] 4.3 Frontend tests pass: `pnpm test`

#### Manual

- [ ] 4.4 Settings page shows CheckboxCard
- [ ] 4.5 Tray toggle syncs to settings page in real time
- [ ] 4.6 Settings page toggle syncs to tray checkmark
- [ ] 4.7 Error dialog appears on autostart failure
