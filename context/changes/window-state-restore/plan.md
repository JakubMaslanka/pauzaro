# Window State Restore Implementation Plan

## Overview

Wire `tauri-plugin-window-state` to persist the main window's position, size, and maximized state across app restarts. Add minimum window dimensions to prevent unusably small window sizes. Overlay windows are excluded — they are transient and have their own positioning logic.

## Current State Analysis

- One Tauri plugin exists (`tauri-plugin-opener`) — established 4-step pattern: Cargo dep → `.plugin()` → npm package → capability permission
- Single `"main"` window defined in `tauri.conf.json` at 1000×600, no min/max constraints
- Window close is intercepted at `src-tauri/src/lib.rs:172-187` — hides window instead of destroying it (tray-resident pattern)
- Overlay windows (`overlay-*`) are dynamically spawned and ephemeral
- `RunEvent::Exit` handler at `lib.rs:226-238` already runs cleanup logic on actual process exit

### Key Discoveries:

- Plugin auto-saves on window close events. Since main window hides instead of closing, manual save is needed in the hide handler (`lib.rs:178`) and in `RunEvent::Exit` (`lib.rs:226`)
- `AppHandleExt::save_window_state(StateFlags)` enables manual save from any Rust context with access to `AppHandle`
- Plugin stores state in a JSON file in the app data directory automatically — no SQLite integration needed
- Permission identifier is `window-state:default` for capabilities config

## Desired End State

User resizes or moves the main window, restarts the app, and the window reappears at the same position, size, and maximized state. Window cannot be resized smaller than 600×400. Overlay windows are unaffected.

**Verification:** Resize window to non-default size/position → quit via tray → relaunch → window appears at saved position/size. Maximize → restart → still maximized.

## What We're NOT Doing

- Persisting overlay window state (transient, dynamically created)
- Persisting fullscreen or decorations state (not relevant for this app)
- Frontend JS API usage — plugin operates entirely at Rust/window-manager level
- Multi-monitor edge case handling beyond what the plugin provides natively

## Implementation Approach

Follow the existing `tauri-plugin-opener` integration pattern. Register the plugin with `StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED` to persist only the relevant properties. Add manual save calls where the window hides and on app exit, since the window-hide pattern bypasses the plugin's default close-based save. Add `minWidth`/`minHeight` to `tauri.conf.json` to prevent degenerate window sizes from being saved/restored.

## Phase 1: Plugin Wiring + Min Dimensions

### Overview

Add the window-state plugin dependency, register it in the Tauri builder, add capability permission, and set minimum window dimensions.

### Changes Required:

#### 1. Cargo dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `tauri-plugin-window-state` crate to dependencies, following the same version pinning pattern as `tauri-plugin-opener`.

**Contract**: New line in `[dependencies]`: `tauri-plugin-window-state = "2"`.

#### 2. Plugin registration in builder

**File**: `src-tauri/src/lib.rs`

**Intent**: Register the window-state plugin in the Tauri builder chain with state flags limited to position, size, and maximized. Place after the existing `tauri_plugin_opener` plugin registration.

**Contract**: New `.plugin()` call after line 31. Builder configured with `StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED` via `tauri_plugin_window_state::Builder::default().with_state_flags(...).build()`.

#### 3. Capability permission

**File**: `src-tauri/capabilities/default.json`

**Intent**: Grant the window-state plugin's default permissions so it can operate on managed windows.

**Contract**: Add `"window-state:default"` to the `permissions` array.

#### 4. Minimum window dimensions

**File**: `src-tauri/tauri.conf.json`

**Intent**: Prevent the user from resizing the window below a usable threshold, which also prevents saving/restoring a degenerate size.

**Contract**: Add `"minWidth": 600` and `"minHeight": 400` to the window object in `app.windows[0]`.

#### 5. npm package (frontend binding)

**File**: `package.json`

**Intent**: Add the JS guest bindings package. Even though we don't use the JS API directly, Tauri 2 plugins expect the npm package to be present for the plugin system to resolve correctly.

**Contract**: Add `"@tauri-apps/plugin-window-state": "^2"` to `dependencies`.

### Success Criteria:

#### Automated Verification:

- Cargo dependency resolves: `cd src-tauri && cargo check`
- npm package installs: `pnpm install`
- TypeScript still compiles: `tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- App launches with plugin active (no console errors about window-state)
- Window respects minWidth/minHeight — cannot resize below 600×400

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Save Timing Integration

### Overview

Add manual save calls to ensure window state is persisted when the window hides (close-button click) and on actual app exit. Scope saves to the main window only — overlay windows excluded by using targeted state flags.

### Changes Required:

#### 1. Save state on window hide

**File**: `src-tauri/src/lib.rs`

**Intent**: When the user clicks the close button and the window hides (line 178), save the current window state to disk before hiding. This ensures state is captured even though the window is never truly closed.

**Contract**: Call `app_handle.save_window_state(StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED)` inside the `CloseRequested` handler, before `win.hide()`. Requires importing `AppHandleExt` and `StateFlags` from `tauri_plugin_window_state`.

#### 2. Save state on app exit

**File**: `src-tauri/src/lib.rs`

**Intent**: Save window state in the `RunEvent::Exit` handler as a safety net — captures state on tray quit or OS shutdown. Place alongside the existing `last_seen_at` write.

**Contract**: Call `app.save_window_state(StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED)` in the `RunEvent::Exit` arm (around line 226), using the same `StateFlags` as the hide handler.

### Success Criteria:

#### Automated Verification:

- Rust compiles cleanly: `cd src-tauri && cargo check`
- Existing tests pass: `cd src-tauri && cargo test`

#### Manual Verification:

- Move window to non-default position → click close (hides to tray) → reopen from tray → position preserved (intra-session save works)
- Resize window → quit via tray "Quit" → relaunch → size restored
- Maximize window → quit → relaunch → window opens maximized
- Open overlay → dismiss → overlay does NOT affect saved main window state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Final Verification

### Overview

End-to-end verification that window state persists correctly across all exit paths and that no regressions exist in existing functionality (tray, overlays, recovery).

### Changes Required:

No code changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- Full Rust test suite passes: `cd src-tauri && cargo test`
- Frontend tests pass: `pnpm test`
- Type checking passes: `tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Window state survives: resize → tray quit → relaunch → correct position/size
- Window state survives: move → force-quit (Cmd+Q / kill) → relaunch → last saved state restored
- Maximized state round-trips correctly
- Overlay windows unaffected (spawn at correct position, no stale state restored)
- Tray show/hide behavior unchanged
- Recovery modal still appears correctly on launch when missed reps exist

---

## Testing Strategy

### Unit Tests:

- No new unit tests needed — plugin is a black-box integration with no custom logic to test

### Integration Tests:

- Existing Rust test suite (`cargo test`) must pass — no regressions in scheduler, streak calc, or recovery

### Manual Testing Steps:

1. Launch app → move window to non-default position → resize to non-default size
2. Click close button (hides to tray) → click tray icon (shows window) → verify position/size preserved
3. Quit via tray "Quit Pauzaro" → relaunch → verify window at saved position/size
4. Maximize → quit → relaunch → verify window opens maximized
5. Try to resize below 600×400 → verify it stops at minimum
6. Trigger overlay → dismiss → verify overlay positioning unaffected
7. Force-quit process → relaunch → verify last saved state used (may be slightly stale)

## Performance Considerations

- State save writes a small JSON file (~100 bytes) to app data directory — negligible I/O
- Save triggers on window hide and app exit — at most a few times per session
- No impact on scheduler, overlay rendering, or streak calculation

## References

- Tauri plugin-window-state docs: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/window-state
- Existing plugin pattern: `tauri-plugin-opener` in `Cargo.toml:22`, `lib.rs:31`, `package.json:26`, `capabilities/default.json:8`
- Window hide handler: `src-tauri/src/lib.rs:172-187`
- Exit handler: `src-tauri/src/lib.rs:226-238`
- Roadmap item: S-08 in `context/foundation/roadmap.md:41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Plugin Wiring + Min Dimensions

#### Automated

- [x] 1.1 Cargo dependency resolves — ff81f2e
- [x] 1.2 npm package installs — ff81f2e
- [x] 1.3 TypeScript compiles — ff81f2e
- [x] 1.4 Linting passes — ff81f2e

#### Manual

- [x] 1.5 App launches with plugin active — ff81f2e
- [x] 1.6 Window respects minWidth/minHeight — ff81f2e

### Phase 2: Save Timing Integration

#### Automated

- [x] 2.1 Rust compiles cleanly
- [x] 2.2 Existing Rust tests pass

#### Manual

- [x] 2.3 State preserved through hide/show cycle
- [x] 2.4 State restored after tray quit and relaunch
- [x] 2.5 Maximized state round-trips
- [x] 2.6 Overlay windows unaffected

### Phase 3: Final Verification

#### Automated

- [ ] 3.1 Full Rust test suite passes
- [ ] 3.2 Frontend tests pass
- [ ] 3.3 Type checking passes
- [ ] 3.4 Linting passes

#### Manual

- [ ] 3.5 State survives tray quit and relaunch
- [ ] 3.6 State survives force-quit and relaunch
- [ ] 3.7 Maximized state round-trips
- [ ] 3.8 Overlay windows unaffected
- [ ] 3.9 Tray show/hide unchanged
- [ ] 3.10 Recovery modal unaffected
