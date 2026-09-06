# Missed-Repetition Recovery — Plan Brief

> Full plan: `context/changes/repetition-recovery/plan.md`

## What & Why

When Pauzaro is quit (or crashes) while habit repetitions are scheduled, those reps go untracked — the user misses them silently, and their streak may break without them knowing why. This feature detects the gap on next launch and gives users a chance to recover: mark missed reps as done (if they did them offline) or dismiss them (accept the miss).

## Starting Point

The scheduler (`scheduler.rs`) fires overlays in real time but has no concept of "app was quit." No `last_seen` timestamp exists. Stale `pending_triggers` from before a gap are partially handled (1-day lookback in `list_active`), but older ones vanish silently. The existing `override_failed` mechanism in `mark_done` provides a single-slot recovery pattern; this feature is the bulk version. Note: window close hides the app to tray (scheduler keeps running) — only actual quit or crash creates a gap.

## Desired End State

On launch after any gap (up to 30 days), the user sees sequential per-habit recovery modals listing missed repetitions. They choose Done anyway (backfill) or Dismiss (mark failed). Gaps > 30 days auto-reset the streak with a Mantine Notification toast. After recovery, the dashboard loads with accurate data.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Last-seen tracking | App quit only (not window hide) | Window hide keeps scheduler running — no gap exists; only actual quit/crash creates one |
| Backfill timestamps | Original scheduled time | Streak calculation sees completions on correct day; matches existing override_failed pattern |
| Stale pending triggers | Auto-fail on startup | Clean slate prevents double-prompting from scheduler + recovery modal |
| Partial day handling | Only unresolved slots shown | Precise — no confusion about already-done/failed reps |
| Dismiss behavior | Insert failed completions | Complete audit trail; calendar shows red for dismissed days |
| Recovery UX | Sequential per-habit modals | Focused — user handles one habit at a time |
| Detection timing | App launch only | Predictable, no mid-session surprises |
| Testing | Full stack (Rust + Vitest) | Covers backend logic and frontend modal UX |

## Scope

**In scope:**
- `app_state` table with `last_seen_at` tracking (quit-time via `RunEvent::Exit`)
- Stale `pending_triggers` auto-fail on startup
- Gap detection and missed-rep computation (pure Rust function)
- Recovery Tauri commands: get missed reps, backfill done, dismiss
- Sequential per-habit recovery modals on dashboard mount
- 30-day cutoff: auto-reset streak + Mantine Notification toast
- Rust unit + integration tests, Vitest component tests

**Out of scope:**
- "Catch up now" / overlay-based recovery (removed — doesn't add value over Done anyway)
- Streak freeze interaction (S-04 separate)
- Recovery for inactive/deleted habits
- Periodic heartbeat for last_seen
- Cloud sync / cross-device recovery
- Changes to `calculate_streak` logic

## Architecture / Approach

New `recovery.rs` module contains a pure `compute_missed_repetitions` function — takes `last_seen`, `now`, habits, and completions, returns structured recovery data. On startup (`lib.rs` setup): read `last_seen_at` → update to now → cleanup stale triggers → compute missed reps → store as managed Tauri state. `last_seen_at` is written on app quit (`RunEvent::Exit`), not on window hide. Frontend queries recovery once via `get_missed_repetitions` command, shows recovery modals, then transitions to normal dashboard.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Foundation | `app_state` table, `last_seen_at` quit-time tracking, stale trigger cleanup | Migration must be idempotent; first-time users need sensible baseline |
| 2. Recovery Detection & Actions | Pure gap detection logic, Tauri commands for backfill/dismiss | Edge cases around day boundaries, partial days, 30-day cutoff |
| 3. Recovery Modal | Sequential per-habit modals, streak-reset Notification toast | Dashboard state machine (recovering → loading → ready) |
| 4. Testing | Full-stack tests: Rust unit + integration, Vitest component | Frontend test setup for mocking Tauri IPC in recovery flow |

**Prerequisites:** S-02 (overlay-habit-loop) complete — done ✓
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- **Crash staleness**: quit-time-only tracking means a crash leaves `last_seen_at` at previous quit — could overestimate missed reps by one session (user can dismiss extras)
- **First launch after upgrade**: migration seeds `last_seen_at = now`, so no false gap — but any actual gap before upgrade is invisible (acceptable tradeoff)
- **Roadmap change ID mismatch**: roadmap S-06 references `missed-repetition-recovery` but change folder is `repetition-recovery` — cosmetic, doesn't affect functionality

## Success Criteria (Summary)

- User quits app for 2+ scheduled days → reopens → recovery modals appear with accurate missed rep count
- Both actions (Done anyway, Dismiss) produce correct completion records with correct historical dates
- Gaps > 30 days auto-reset streak without showing recovery modal, Notification toast shown
- Window hide (close button) → reopen → NO recovery modal (app was running)
- Full test suite covers gap detection edge cases, recovery actions, and modal UX
