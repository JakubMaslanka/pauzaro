# Single Instance Enforcement — Plan Brief

> Full plan: `context/changes/single-instance-enforcement/plan.md`

## What & Why

Prevent multiple Pauzaro instances from running simultaneously. A second launch should exit immediately and focus the existing window. Keeps memory footprint minimal and avoids confusing duplicate-tray-icon / duplicate-scheduler scenarios.

## Starting Point

App has no single-instance guard. Three Tauri plugins already wired (`autostart`, `opener`, `window-state`) — pattern established. `tray::show_main_window()` exists but doesn't handle minimized windows (`unminimize()` missing).

## Desired End State

Launching Pauzaro while it's already running causes the second process to exit. The existing instance's window is shown, unminimized, and focused — regardless of whether it was hidden to tray, minimized, or visible.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Unminimize gap | Fix in this change | One-line fix that benefits all callers (tray, dock, single-instance) |
| CLI arg forwarding | Focus only | No deep links or CLI consumers exist today |
| Hung-app handling | Document only | OS force-quit is standard for all single-instance desktop apps |
| Roadmap Change ID | Update roadmap to match folder | Folder already exists; roadmap edit is trivial |

## Scope

**In scope:**
- Add `tauri-plugin-single-instance` dependency and register plugin
- Callback that focuses existing window on duplicate launch
- Fix `show_main_window()` to include `unminimize()`
- Align roadmap S-09 Change ID

**Out of scope:**
- CLI argument forwarding / deep links
- Health-check for unresponsive instance
- Frontend changes
- Custom IPC / lock-file approach

## Architecture / Approach

Pure Rust-side change. Plugin is registered in the Tauri builder chain (same as existing plugins). Its init callback receives the `AppHandle` and calls the existing `tray::show_main_window()` function. The `unminimize()` addition to that function is a no-op when the window isn't minimized, so all existing callers benefit safely.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Plugin wiring + window fix | Single-instance enforcement + unminimize fix + roadmap alignment | Near-zero — follows established plugin pattern |

**Prerequisites:** None — no dependencies on other slices.
**Estimated effort:** ~1 session, single phase.

## Open Risks & Assumptions

- Plugin assumes OS-level mutex works correctly (standard Tauri behavior, no known issues)
- If first instance is unresponsive, user must force-quit before relaunching (documented, not coded around)

## Success Criteria (Summary)

- Second launch exits and focuses existing window in all states (visible, minimized, tray-hidden)
- No regressions in tray click or dock reopen behavior
- All existing tests pass
