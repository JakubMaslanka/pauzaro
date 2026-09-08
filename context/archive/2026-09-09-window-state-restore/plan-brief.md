# Window State Restore — Plan Brief

> Full plan: `context/changes/window-state-restore/plan.md`

## What & Why

Wire `tauri-plugin-window-state` so the main window's position, size, and maximized state persist across app restarts. Desktop apps that forget window placement frustrate users who arrange windows deliberately. Also adds minimum window dimensions (600×400) to prevent unusable sizes.

## Starting Point

App has one main window (1000×600 default) with a tray-resident pattern — close hides the window instead of destroying it. One Tauri plugin exists (`tauri-plugin-opener`) providing the integration pattern. No window-state persistence exists today.

## Desired End State

User moves/resizes the main window, quits, relaunches — window reappears exactly where they left it. Maximized state is remembered. Window can't shrink below 600×400. Overlay windows are unaffected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Scope | State persistence + min dimensions | Prevents saving degenerate sizes alongside restoring them |
| State flags | Position + size + maximized | Fullscreen is irrelevant for a utility habit-tracker |
| Overlay handling | Main window only | Overlays are transient; persisting their state would restore stale popups |
| Save timing | On state change (hide + exit) | Survives force-quit better than exit-only; window-hide bypasses plugin's default close-based save |

## Scope

**In scope:**
- `tauri-plugin-window-state` integration (Cargo, plugin registration, capability, npm)
- Manual save hooks in window-hide handler and `RunEvent::Exit`
- `minWidth: 600` / `minHeight: 400` in tauri.conf.json
- State flags: `POSITION | SIZE | MAXIMIZED`

**Out of scope:**
- Overlay window state persistence
- Fullscreen/decorations persistence
- Frontend JS API usage
- Multi-monitor edge cases beyond plugin defaults

## Architecture / Approach

Pure Rust-side plugin integration — no frontend changes. Plugin persists state to a JSON file in the app data directory automatically. Two manual `save_window_state()` calls added: one in the `CloseRequested` handler (before `win.hide()`) and one in `RunEvent::Exit` (alongside existing `last_seen_at` write). Plugin's `Builder` configured with `StateFlags::POSITION | SIZE | MAXIMIZED` to limit scope.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Plugin Wiring + Min Dimensions | Dependency, registration, permission, min size | Cargo version conflict (unlikely — plugin is first-party) |
| 2. Save Timing Integration | Manual save on hide + exit, overlay exclusion | Save call in CloseRequested handler must fire before hide |
| 3. Final Verification | Full regression check across all exit paths | Force-quit may lose state if save didn't fire (acceptable) |

**Prerequisites:** None — this slice has no dependencies on other roadmap items.
**Estimated effort:** ~1 session, single phase each.

## Open Risks & Assumptions

- Plugin version 2.x is compatible with current `tauri = "2"` in Cargo.toml (high confidence — first-party)
- `save_window_state()` in `CloseRequested` handler completes synchronously before `win.hide()` (if async, may need await)
- Force-quit (SIGKILL) will lose state since save only fires on hide and clean exit — accepted tradeoff

## Success Criteria (Summary)

- Window position, size, and maximized state restored after tray-quit and relaunch
- Overlay windows unaffected by state plugin
- No regressions in tray behavior, scheduler, or recovery modal
