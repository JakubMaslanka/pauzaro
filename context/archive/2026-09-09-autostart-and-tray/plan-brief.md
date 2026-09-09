# Autostart + Settings Toggle — Plan Brief

> Full plan: `context/changes/autostart-and-tray/plan.md`

## What & Why

Wire `tauri-plugin-autostart` so Pauzaro can register itself as an OS login item. Without autostart, the app must be manually launched each session — users miss habit reminders until they remember to open it. A persistent toggle in both the tray menu and settings page gives control without friction.

## Starting Point

System tray is fully implemented (`lib.rs:151-181`): icon, "Show Dashboard" / "Quit Pauzaro" menu, close-to-tray, macOS dock hiding. Settings page exists as a "Coming soon!" stub. No settings table, no autostart infrastructure, no settings persistence layer.

## Desired End State

App optionally launches at OS login. User toggles "Launch on startup" from either the tray menu (checkable item with checkmark) or the settings page (Mantine CheckboxCard). Both controls stay synced via Tauri events. Preference persists in SQLite. On failure, a dialog guides the user to OS settings. `lib.rs` is cleaner with tray logic extracted to `tray.rs`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Autostart default | Off — user opts in | Respects user agency; surprise login items feel intrusive |
| Toggle locations | Tray menu + settings page | Tray for quick access, settings page for discoverability |
| Settings page UI | Mantine CheckboxCard | Matches app design language; richer than a bare checkbox |
| Settings persistence | New `settings` table, single-row typed | Clean separation from `app_state`; type-safe, extensible |
| Error handling | Dialog with OS guidance | Most helpful for the user — autostart failure is actionable |
| Tray refactor | Extract `tray.rs` module | `lib.rs` at 278 lines and growing; tray logic is self-contained |

## Scope

**In scope:**
- `tauri-plugin-autostart` plugin wiring (Rust + JS + capabilities)
- SQLite `settings` table (migration 4) + model + repository + commands
- Tray `CheckMenuItem` "Launch on startup" with sync
- Settings page CheckboxCard with sync
- Error dialog on autostart registration failure
- Extract tray logic from `lib.rs` into `tray.rs`

**Out of scope:**
- Reworking existing tray menu items or close-to-tray behavior
- Other settings (profile editing, notification prefs, data export)
- Onboarding autostart prompt
- Cross-platform testing (deferred to T-03)

## Architecture / Approach

Bottom-up: persistence layer (migration → model → repository → commands) → autostart plugin registration → refactor `lib.rs` extracting tray module → add `CheckMenuItem` to tray menu → frontend settings page with CheckboxCard. Bidirectional sync via `"settings-changed"` Tauri event. `TrayState` managed state holds `CheckMenuItem` handle so both tray and frontend commands can update it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend Foundation | Settings table, Rust persistence stack, autostart plugin, Tauri commands | Plugin API mismatch with Tauri 2 — mitigated by first-party plugin |
| 2. Refactor: Extract Tray Module | `tray.rs` module, leaner `lib.rs` | Regression in tray/close behavior — pure move, manual verification |
| 3. Tray Menu Integration | CheckMenuItem toggle, sync events, error dialog | CheckMenuItem state management across tray ↔ commands |
| 4. Frontend Settings Page | CheckboxCard UI, invoke wrappers, event sync | UI/UX polish — low risk, follows established patterns |

**Prerequisites:** S-01 complete (app has working UI + navigation + DB). All prerequisites met.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- macOS may require user to grant "Login Items" permission in System Settings — error dialog covers this
- `tauri-plugin-autostart` v2 API assumed stable — first-party plugin, high confidence
- `CheckMenuItem` handle stored in managed state assumes single tray icon — true for this app

## Success Criteria (Summary)

- Toggling autostart from tray or settings page registers/unregisters OS login item
- Preference persists across app restarts in both UI locations
- Error dialog with actionable guidance appears on registration failure
