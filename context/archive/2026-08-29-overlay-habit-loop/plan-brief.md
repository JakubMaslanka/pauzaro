# Overlay Habit Loop — Plan Brief

> Full plan: `context/changes/overlay-habit-loop/plan.md`
> Research: `context/changes/overlay-habit-loop/research.md`

## What & Why

Build the core habit loop — the north star of Pauzaro. A scheduler fires overlay windows at scheduled times, the user marks habits done or snoozes (3x snooze = auto-fail), and the dashboard reflects streak progress live. This validates the core product hypothesis: that a desktop overlay with streak tracking changes break behavior better than browser/phone tools.

## Starting Point

S-01 complete: onboarding wizard + habit creation with day-of-week + time range schedule. Backend is entirely synchronous Rust (rusqlite + std::sync::Mutex, 6 sync commands). Frontend has 3 routes, TanStack Router (hash), Mantine 9. No scheduling, timer, overlay, multi-window, or Tauri event code exists anywhere — all greenfield.

## Desired End State

User creates a habit. At each scheduled time, a floating panel (always-on-top, centered, ~400×300, no titlebar) appears with Done and Snooze buttons. Done records completion; Snooze re-fires in 9 min (max 3x, then auto-fail). If no interaction for 2 min, auto-snooze fires. Dashboard shows today's slot statuses (✅/⏳/❌) and current streak count, updating live. A hidden "lifebuoy" on failed slots allows manual recovery for users who did the activity but missed the overlay.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Scheduling architecture | Option E: single timer loop | Best fit with sync rusqlite + Mutex — additive, no architectural disruption | Research |
| Overlay style | Centered floating panel | Impossible to miss in focus flow — matches PRD "harder to ignore" intent | Plan |
| Time slot model | `start_time` only, drop `end_time` | Works like an alarm — fire at set time, end_time was wrongly assumed as range | Plan |
| Trigger rule | Fire once at `start_time` | Simplest trigger logic, one fire point per slot | Plan |
| No-response behavior | Auto-snooze after 2 min | Prevents zombie windows; enforces engagement through snooze counter | Plan |
| Snooze limit | 3x hardcoded (settings later) | PRD requirement; surfacing to settings deferred to reduce scope | Plan |
| Day completion | All slots must be done | Full accountability — Duolingo model; streak freeze (S-04) is safety net | Plan |
| Dashboard done | Hidden "lifebuoy" for failed slots only | Prevents gaming while giving honest recovery path | Plan |
| Snooze persistence | Persisted in DB (`pending_triggers` table) | No gaming by restarting app | Plan |
| Dashboard updates | Live via Tauri events | Immediate feedback without refresh | Plan |
| Scope | Today-status + streak; month view deferred to S-03 | Proves core loop without calendar UI complexity | Plan |

## Scope

**In scope:**
- Rust async scheduler loop (Option E)
- Overlay window creation and UI (Done + Snooze)
- Auto-snooze timeout (2 min)
- Auto-fail after 3x snooze
- Completions + pending_triggers DB tables
- Drop `end_time` from time slot model
- Snooze state persistence across restarts
- Streak calculation (consecutive completed days)
- Dashboard today-status + streak counter
- Lifebuoy mechanism for failed slots
- Live dashboard updates via Tauri events

**Out of scope:**
- Month view calendar (S-03)
- Streak freeze (S-04)
- Dinosaur mascot (S-05)
- Multi-habit edit/delete
- System tray
- Configurable snooze count/duration
- Notification sounds
- Cross-platform testing (macOS first)

## Architecture / Approach

Single async timer loop spawned via `tauri::async_runtime::spawn()`. Loop queries DB (via `spawn_blocking` for sync Mutex safety), computes next fire time through pure `find_next_trigger()` function, sleeps until fire time or wakes on `Notify` signal. On fire, creates overlay `WebviewWindow` directly from Rust. Overlay React component (same SPA, different route detected via window label) handles interaction via invoke commands. Commands update DB → notify scheduler → emit event to main window → close overlay.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Data Foundation | Migration (completions, pending_triggers, drop end_time), updated models/types, SchedulePicker simplification | Breaking change to existing TimeSlot schema |
| 2. Scheduler Engine | Async scheduler loop, `find_next_trigger()` with unit tests, spawned in Tauri setup | First async Rust code in codebase — unfamiliar tokio patterns |
| 3. Overlay Window + Events | Overlay window creation, React overlay UI, Done/Snooze commands, event wiring | WebviewWindow API + cross-window routing — first multi-window Tauri usage |
| 4. Streak + Dashboard | Streak calculation, today-status display, lifebuoy mechanism, live event updates | Streak edge cases (non-scheduled days, partial days, timezone boundaries) |

**Prerequisites:** S-01 complete (onboarding + habit creation working) ✓
**Estimated effort:** ~4 sessions across 4 phases

## Open Risks & Assumptions

- `DROP COLUMN end_time` requires SQLite ≥ 3.35.0 — rusqlite 0.34 bundled includes 3.46+ (verified, low risk)
- Schedule times are local user time, DB timestamps are UTC — timezone handling in `find_next_trigger` must use `chrono::Local`
- Overlay window behavior may differ on Windows (Webview2 deadlock on sync window creation — use async) — macOS first, Windows deferred
- Force-closing overlay window doesn't increment snooze count — user can dismiss but overlay re-fires on next scheduler loop (intentional)

## Success Criteria (Summary)

- Overlay appears at scheduled time and cannot be passively ignored (auto-snooze enforces engagement)
- Full Done/Snooze/Auto-fail cycle works end-to-end with persistent state
- Dashboard reflects streak and today's status in real-time after overlay interaction
