# Single Instance Enforcement Implementation Plan

## Overview

Prevent multiple Pauzaro instances from running simultaneously. When a second instance is launched, it exits immediately and the existing instance's main window is focused (including unminimize). Uses `tauri-plugin-single-instance` — same plugin pattern as the three already wired (`autostart`, `opener`, `window-state`).

## Current State Analysis

- Tauri app builder in `lib.rs:32-216` uses `.build()` then `.run()` — plugin slots in at the existing chain
- Three plugins already registered: `autostart` (line 33), `opener` (line 37), `window-state` (line 39)
- `tray::show_main_window()` at `tray.rs:187-197` does `show()` + `set_focus()` but **not** `unminimize()` — second launch on a minimized window would fail to restore
- Window label `"main"` used consistently across `tray.rs` and `lib.rs`
- No capabilities/permissions needed for this plugin (it's a Rust-only integration)

### Key Discoveries:

- `show_main_window()` is already called from tray click (`tray.rs:76`) and macOS dock reopen (`lib.rs:194`) — adding `unminimize()` benefits all callers
- The `.build().run()` pattern (not `.run()` on builder) means the plugin init callback has full access to `AppHandle`
- Roadmap S-09 has Change ID `single-instance` — needs updating to `single-instance-enforcement` to match this change folder

## Desired End State

Launching Pauzaro while it's already running causes the second process to exit immediately. The existing instance's main window is shown, unminimized if needed, and focused. Works regardless of whether the window is hidden to tray, minimized, or visible. Verified by manual double-launch test.

## What We're NOT Doing

- CLI argument forwarding to existing instance (no deep links exist)
- Health-check/timeout for unresponsive first instance (OS force-quit is sufficient)
- Any frontend changes (entirely Rust-side)
- Lock-file or custom IPC approach (plugin handles it)

## Implementation Approach

Wire `tauri-plugin-single-instance` with a callback that calls `tray::show_main_window()`. Fix `show_main_window()` to include `unminimize()` so all callers (tray, dock reopen, single-instance) handle the minimized case. Update roadmap Change ID to match.

## Phase 1: Plugin wiring + window fix

### Overview

Add the single-instance plugin dependency, register it in the Tauri builder, fix `show_main_window()` to handle minimized windows, and align the roadmap Change ID.

### Changes Required:

#### 1. Add plugin dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `tauri-plugin-single-instance` as a dependency alongside existing Tauri plugins.

**Contract**: New line in `[dependencies]` section: `tauri-plugin-single-instance = "2"` (same version scheme as other plugins at lines 22-24).

#### 2. Register single-instance plugin in Tauri builder

**File**: `src-tauri/src/lib.rs`

**Intent**: Register the plugin before the existing plugins so it runs early in the init chain. The callback focuses the existing window when a duplicate launch is detected.

**Contract**: `.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| { ... }))` added to the builder chain (before line 33). Callback calls `tray::show_main_window(app)`.

#### 3. Fix show_main_window to handle minimized state

**File**: `src-tauri/src/tray.rs`

**Intent**: Add `unminimize()` call before `show()` + `set_focus()` so the window restores from minimized state. Benefits all callers: tray click, dock reopen, and the new single-instance callback.

**Contract**: In `show_main_window()` (line 187-197), after getting the window handle, call `w.unminimize()` before `w.show()`. The `WebviewWindow::unminimize()` method is a no-op when the window isn't minimized, so unconditional call is safe.

#### 4. Align roadmap Change ID

**File**: `context/foundation/roadmap.md`

**Intent**: Update S-09's Change ID from `single-instance` to `single-instance-enforcement` so roadmap sync works correctly.

**Contract**: Two edits — the `## At a glance` table row and the `### S-09` body's `- **Change ID:**` line.

### Success Criteria:

#### Automated Verification:

- Cargo check passes: `cd src-tauri && cargo check`
- Rust tests pass: `cd src-tauri && cargo test`
- TypeScript type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Launch app normally — works as before
- While app is running, launch second instance from terminal — second process exits, existing window focuses
- Minimize window, launch second instance — window unminimizes and focuses
- Hide to tray (close window), launch second instance — window shows from tray and focuses
- Tray icon click still works as before (regression check)
- macOS dock click while hidden still works (regression check)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Existing Rust tests cover streak/scheduler logic — no new unit tests needed (plugin is declarative wiring)
- Verify existing tests still pass (no regressions from new plugin)

### Manual Testing Steps:

1. `pnpm tauri dev` — app launches normally
2. Open second terminal, run `pnpm tauri dev` again — second instance should exit, first should focus
3. Minimize first instance, repeat step 2 — window should unminimize + focus
4. Close window to tray, repeat step 2 — window should show from tray + focus
5. Click tray icon — should still show window (regression)
6. macOS: click dock icon while hidden — should still show window (regression)

## Performance Considerations

None. Plugin adds negligible overhead — a mutex/lock-file check at startup (~1ms). No runtime cost after init.

## Migration Notes

None. No schema changes, no data changes, no breaking changes.

## References

- Roadmap item: `context/foundation/roadmap.md` S-09
- Tray module: `src-tauri/src/tray.rs:187-197` (`show_main_window`)
- App builder: `src-tauri/src/lib.rs:32-46` (plugin registration chain)
- Existing plugin pattern: `src-tauri/src/lib.rs:33-36` (autostart plugin as model)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Plugin wiring + window fix

#### Automated

- [x] 1.1 Cargo check passes
- [x] 1.2 Rust tests pass
- [x] 1.3 TypeScript type-check passes
- [x] 1.4 Lint passes

#### Manual

- [x] 1.5 Second instance exits and focuses existing window
- [x] 1.6 Minimized window unminimizes on second launch
- [x] 1.7 Tray-hidden window shows on second launch
- [x] 1.8 Tray click regression check
- [x] 1.9 macOS dock click regression check
