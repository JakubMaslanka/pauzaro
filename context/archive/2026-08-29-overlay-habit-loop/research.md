---
date: "2026-08-29T00:00:00+02:00"
researcher: Claude
git_commit: 7cff8cd90c5e4d68150ef13a48524328c62a4c56
branch: master
repository: pauzaro
topic: "S-02 Scheduling Option Compatibility Analysis — Option E vs Codebase"
tags: [research, codebase, scheduling, overlay, tokio, tauri, rusqlite]
status: complete
last_updated: "2026-08-29"
last_updated_by: Claude
---

# Research: S-02 Scheduling Option Compatibility Analysis

**Date**: 2026-08-29
**Researcher**: Claude
**Git Commit**: 7cff8cd90c5e4d68150ef13a48524328c62a4c56
**Branch**: master
**Repository**: pauzaro

## Research Question

Is Option E (single timer loop) from `loop-research.md` compatible with the existing Pauzaro codebase? Are other options (A, B, D — C excluded) a better fit given codebase details the initial research may have missed?

## Summary

**Option E is compatible and the best fit.** All required modifications are additive — no breaking changes to existing code. The initial research correctly identified Option E's strengths but missed several codebase-specific constraints that require adaptation. Other options (A, B, D) are worse fits because they add dependencies without solving the core challenge (schedule-to-fire-time computation), and Option A's cron model conflicts with the existing day-of-week + time-range schema.

---

## Detailed Findings

### 1. Codebase Architecture Snapshot

The current Rust backend is **entirely synchronous**:

| Aspect | Current state | Reference |
|--------|--------------|-----------|
| DB driver | `rusqlite` 0.34 (synchronous) | `src-tauri/Cargo.toml:25` |
| State wrapper | `std::sync::Mutex<Database>` | `src-tauri/src/lib.rs:13` |
| Commands | All synchronous (no `async`) | `src-tauri/src/commands/habits.rs:9-41` |
| Tokio in Cargo.toml | **Not listed** (transitive only via Tauri) | `src-tauri/Cargo.toml:20-26` |
| Chrono | **Not present** | `src-tauri/Cargo.toml:20-26` |
| Window capabilities | Only `core:default`, `opener:default` | `src-tauri/capabilities/default.json:6-8` |
| Schema tables | `user_profile`, `habits`, `habit_schedule_days`, `habit_schedule_times` | `src-tauri/src/db/migrations.rs:7-44` |
| Completions table | **Does not exist** | `src-tauri/src/db/migrations.rs` (exhaustive) |
| Trigger/scheduling logic | **None** | Searched entire `src-tauri/src/` — zero hits |

### 2. Tokio Runtime Access — Verified Compatible

Tauri 2.11.5 internally uses tokio 1.53.1 with features: `rt`, `rt-multi-thread`, `sync`, `fs`, `io-util`.

**Key finding:** Bare `tokio::spawn()` from the `setup` closure will **panic** — the setup closure runs on the main/event-loop thread, not inside a tokio context. Must use `tauri::async_runtime::spawn()` instead, which internally enters the runtime context before spawning.

```rust
// WRONG — panics at runtime
tauri::Builder::default().setup(|app| {
    tokio::spawn(async { ... }); // ← no tokio context on this thread
    Ok(())
})

// CORRECT
tauri::Builder::default().setup(|app| {
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // tokio context is set up by tauri::async_runtime
        scheduler.run(handle).await;
    });
    Ok(())
})
```

**Source:** Tauri's `async_runtime.rs` lines 206-209 — `spawn()` calls `handle.enter()` before `tokio::spawn()`.

**Dependencies to add to Cargo.toml:**

```toml
tokio = { version = "1", features = ["time", "macros"] }
```

Tauri already provides `rt`, `rt-multi-thread`, `sync`. Only `time` (for `tokio::time::sleep`) and `macros` (for `tokio::select!`) are missing.

### 3. AppHandle + AppState in Spawned Tasks — Verified Compatible

- `AppHandle` is `Send + Sync + 'static` — all fields are `Arc`-wrapped. Safe to clone and move into spawned task.
- `std::sync::Mutex<Database>` where `Database` wraps `rusqlite::Connection`: Connection is `Send` (not `Sync`), Mutex makes it `Send + Sync`. Accessible via `app.state::<AppState>()`.
- **Blocking concern:** `std::sync::Mutex::lock()` blocks the tokio worker thread. For quick SQLite queries (sub-ms) this is acceptable. For safety, use `tauri::async_runtime::spawn_blocking()` to move DB access to tokio's blocking thread pool.

**Source:** `rusqlite-0.34.0/src/lib.rs:392` — `unsafe impl Send for Connection {}`. Tauri's `Manager::manage()` requires `T: Send + Sync + 'static`.

### 4. Schedule Data Model — Gap Analysis

**Time format:** `"HH:MM"` (24-hour, no seconds). Confirmed by `<input type="time">` in `src/components/shared/SchedulePicker.tsx:153-168` and default values `"09:00"/"09:15"` at line 76.

**Day-of-week convention:** 0=Sunday through 6=Saturday. Matches both JavaScript `Date.getDay()` and SQLite `strftime('%w')`. Confirmed in `SchedulePicker.tsx:14`.

**Semantic gap — what does the time range mean?** The `start_time`/`end_time` pair represents a reminder window. The UI label is "When should we remind you?" (`ScheduleStep.tsx:103`) with arrow notation (`SchedulePicker.tsx:170`). Most natural interpretation: **fire overlay at `start_time`**, break window lasts until `end_time`.

**No "next fire time" computation exists anywhere.** This is the main build-yourself cost of Option E: a pure function `(now: DateTime, schedule_days: Vec<u8>, schedule_times: Vec<TimeSlot>) -> Option<DateTime>`. Better done in Rust with `chrono` than in SQL — testable, timezone-aware, handles edge cases cleanly.

**Missing schema for S-02 (new migration needed):**

```sql
-- Migration 2: completions + snooze support
CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    time_slot_start TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_completions_habit_id ON completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON completions(completed_at);

ALTER TABLE habits ADD COLUMN snoozed_until TEXT;
```

### 5. Window Creation — Capability Gap

Current `capabilities/default.json` lacks multi-window permissions. Need to add:

```json
"core:webview:allow-create-webview-window"
```

Overlay window creation **must use async command** on Windows (Webview2 deadlock — `wry#583`). On macOS this isn't strictly required but async is recommended for cross-platform safety.

**Source:** `tauri-2.11.5/src/webview/webview_window.rs:56-59` — explicit warning in `WebviewWindowBuilder::new()` docs.

### 6. Research Skeleton Code — Corrections Needed

The skeleton in `loop-research.md` has three issues when applied to this codebase:

| Issue | Skeleton assumes | Codebase reality | Fix |
|-------|-----------------|-------------------|-----|
| Spawning | `tokio::spawn(schedule_loop)` | No tokio context in setup | Use `tauri::async_runtime::spawn()` |
| DB access | Direct `Pool` parameter (async) | `std::sync::Mutex<Database>` (sync) | Use `spawn_blocking` for DB queries |
| Time types | `Utc::now()`, `Duration::zero()` (chrono) | No chrono dependency | Add `chrono = { version = "0.4", features = ["serde"] }` |

---

## Options Evaluation Against Codebase Constraints

### Option A: `tokio-cron-scheduler` — Poor fit

| Criterion | Assessment |
|-----------|-----------|
| Schema compatibility | **Bad.** Cron expressions don't map to day-of-week + `"HH:MM"` time ranges. Would need conversion layer that loses range semantics. |
| Sync DB compatibility | Same concern as Option E — needs async bridge for DB access |
| Snooze support | Works (`Job::new_one_shot`) but adds job-management complexity |
| Restart recovery | Must rebuild all jobs from DB on restart — more code than Option E's stateless loop |
| New dependencies | ~5 transitive crates beyond what's needed |
| Build-yourself cost | Must still build schedule-to-cron conversion + job lifecycle management |

**Verdict:** More complexity for no benefit. The cron expression model fights the existing schema rather than working with it.

### Option B: `tauri-plugin-cron` — Non-viable

| Criterion | Assessment |
|-----------|-----------|
| Snooze support | **Impossible.** Cron-only, no one-shot/duration scheduling. |
| Maturity | v0.1.1 — stability risk |
| Schema compatibility | Same cron mismatch as Option A |

**Verdict:** Dead end. Snooze is a core S-02 requirement (FR-007).

### Option D: `tauri-plugin-background-service` — Overengineered

| Criterion | Assessment |
|-----------|-----------|
| What it provides | Service lifecycle management (`init()` + `run()` trait), graceful shutdown via `CancellationToken` |
| What it doesn't provide | No scheduling, no cron, no one-shot timers |
| Build-yourself cost | Must build the entire timer loop inside `BackgroundService::run()` anyway — same work as Option E but wrapped in unnecessary abstraction |
| Cross-platform overhead | Android/iOS keepalive logic adds complexity Pauzaro doesn't need |

**Verdict:** Adds a dependency layer around the exact same work Option E does bare. The `CancellationToken` is the only value-add, achievable with `tokio_util::sync::CancellationToken` or a simple `AtomicBool` if needed.

### Option E: Single timer loop — Best fit ★

| Criterion | Assessment |
|-----------|-----------|
| Schema compatibility | **Excellent.** Reads `schedule_days` + `schedule_times` directly. No conversion layer. |
| Sync DB compatibility | Use `spawn_blocking` for `std::sync::Mutex` DB access from async loop |
| Snooze support | Write `snoozed_until` to DB + `notify.notify_one()` to wake loop |
| Restart recovery | Stateless — loop starts, queries DB, zero setup |
| New dependencies | `tokio` features `time`+`macros` (already transitive), `chrono` (standard, small) |
| Build-yourself cost | ~60-80 lines: scheduler struct + `find_next_trigger()` function + 3 Tauri commands |
| Existing patterns | Fits the synchronous DB + managed state pattern already in codebase |

**Verdict:** Best fit. Additive changes only. No architectural disruption.

---

## Corrected Option E Architecture (Codebase-Adapted)

```
┌──────────────────────────────────────────────────────────────┐
│ Rust (Tauri setup)                                           │
│                                                              │
│  tauri::async_runtime::spawn(scheduler.run(app_handle))      │
│    1. spawn_blocking → lock Mutex<Database>                  │
│       SELECT habits + schedule WHERE is_active = 1           │
│    2. find_next_trigger(now, habits) → Option<Trigger>       │
│       (pure Rust function using chrono, NOT SQL)             │
│    3. tokio::select! {                                       │
│         sleep_until(fire_at) => emit("show-overlay", id)     │
│         notify.notified()   => continue (schedule changed)   │
│       }                                                      │
│    4. goto 1                                                 │
│                                                              │
│  Scheduler (managed state):                                  │
│    notify: Arc<tokio::sync::Notify>                          │
│                                                              │
│  Commands (async for window creation):                       │
│    show_overlay(habit_id)  → WebviewWindowBuilder            │
│    mark_done(habit_id)     → INSERT completion, notify loop  │
│    snooze(habit_id, min)   → UPDATE snoozed_until, notify    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Frontend (React)                                             │
│                                                              │
│  listen("show-overlay") → render overlay route/window        │
│  Overlay UI: Done / Snooze → invoke commands                 │
│  Dashboard: refetch habits + completions after mark_done     │
└──────────────────────────────────────────────────────────────┘
```

### Corrected Skeleton Code

```rust
use std::sync::Arc;
use tokio::sync::Notify;
use tauri::{AppHandle, Manager};
use chrono::{Utc, NaiveTime, Datelike, Duration};

use crate::AppState;
use crate::models::Habit;

pub struct Scheduler {
    notify: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self { notify: Arc::new(Notify::new()) }
    }

    pub fn wake(&self) {
        self.notify.notify_one();
    }

    pub async fn run(&self, app: AppHandle) {
        loop {
            // DB access via spawn_blocking (safe with std::sync::Mutex)
            let app_clone = app.clone();
            let habits = tauri::async_runtime::spawn_blocking(move || {
                let state = app_clone.state::<AppState>();
                let db = state.db.lock().expect("db lock poisoned");
                // query active habits with schedules
                db::habits::HabitRepository::new(db.connection()).list_active_with_schedules()
            }).await.expect("spawn_blocking panicked");

            let now = Utc::now();
            match find_next_trigger(&now, &habits) {
                Some(trigger) => {
                    let delay = (trigger.fire_at - now)
                        .to_std()
                        .unwrap_or(std::time::Duration::ZERO);

                    if delay.is_zero() {
                        app.emit("show-overlay", &trigger.habit_id).unwrap();
                    } else {
                        let sleep = tokio::time::sleep(delay);
                        tokio::pin!(sleep);
                        tokio::select! {
                            () = &mut sleep => {
                                app.emit("show-overlay", &trigger.habit_id).unwrap();
                            }
                            _ = self.notify.notified() => {
                                continue; // schedule changed, re-query
                            }
                        }
                    }
                }
                None => {
                    // no habits scheduled — wait for notification
                    self.notify.notified().await;
                }
            }
        }
    }
}

/// Pure function: given current time and active habits, find the earliest next trigger.
/// Testable without any DB or Tauri dependency.
fn find_next_trigger(now: &DateTime<Utc>, habits: &[Habit]) -> Option<Trigger> {
    // For each habit:
    //   For each (day_of_week, time_slot) pair:
    //     Compute next calendar datetime where dow matches and time >= start_time
    //     Skip if snoozed_until > computed time
    //     Skip if already completed for this slot today
    // Return the earliest
    todo!("implement in planning phase")
}
```

---

## Required Cargo.toml Additions

```toml
[dependencies]
# existing deps unchanged...
tokio = { version = "1", features = ["time", "macros"] }
chrono = { version = "0.4", features = ["serde"] }
```

## Required Capability Addition

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    "opener:default",
    "core:webview:allow-create-webview-window"
  ]
}
```

## Required New Migration (Migration 2)

```sql
CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    time_slot_start TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_completions_habit_id ON completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON completions(completed_at);

ALTER TABLE habits ADD COLUMN snoozed_until TEXT;
```

---

## Code References

- `src-tauri/Cargo.toml:20-26` — current dependencies (no tokio, no chrono)
- `src-tauri/src/lib.rs:7-14` — `AppState` with `std::sync::Mutex<Database>`
- `src-tauri/src/lib.rs:17-50` — `setup` closure and command registration
- `src-tauri/src/db/mod.rs:11-26` — `Database` struct wrapping `rusqlite::Connection`
- `src-tauri/src/db/migrations.rs:7-44` — current schema (2 migrations, no completions)
- `src-tauri/src/db/habits.rs:1-197` — `HabitRepository` with sync CRUD
- `src-tauri/src/models/habit.rs:1-64` — `Habit`, `TimeSlot`, `CreateHabitInput` structs
- `src-tauri/src/commands/habits.rs:1-42` — sync command handlers
- `src-tauri/src/error.rs:1-25` — `AppError` enum
- `src-tauri/capabilities/default.json:1-10` — current capabilities (no multi-window)
- `src/components/shared/SchedulePicker.tsx:76` — default time slot `"09:00"/"09:15"` (HH:MM format)
- `src/components/shared/SchedulePicker.tsx:153-168` — `<input type="time">` produces HH:MM
- `src/components/onboarding/ScheduleStep.tsx:23-25` — initial time state
- `src/types/index.ts:8-10` — TypeScript `TimeSlot` interface
- `src/stores/habit.ts:1-29` — Zustand habit store (fetch + add only)
- `src/routes/dashboard.tsx:1-21` — dashboard route with onboarding guard

## Architecture Insights

1. **Synchronous-first pattern is intentional and correct.** `rusqlite` is sync, SQLite is inherently single-writer. The `std::sync::Mutex` pattern works well for command handlers. The scheduler loop is the only async component needed — it bridges to the sync DB via `spawn_blocking`.

2. **No architectural disruption.** Option E adds one `tauri::async_runtime::spawn()` call in `setup` and keeps all existing sync commands unchanged. New async commands (`show_overlay`, `mark_done`, `snooze`) are additive.

3. **`find_next_trigger` as pure function** is the key design decision. Keeping it pure (input: time + habits, output: trigger) makes it unit-testable without DB or Tauri. This is where most of the scheduling logic lives.

4. **Time-slot semantics decision needed before implementation.** The `start_time`/`end_time` pair needs a defined meaning. Recommended: fire overlay at `start_time`, break window lasts until `end_time`.

## Historical Context

- `loop-research.md` — initial web research evaluating 5 scheduling options (A-E)
- `loop-research-docs.md` — API docs verification for Tauri 2 window creation, events, and tokio primitives
- Both documents are accurate in their API claims (verified against actual Tauri 2.11.5 source) but assumed async DB access patterns that don't match this codebase's synchronous rusqlite setup

## Open Questions

1. **Time-slot trigger semantics:** Fire at `start_time`? Random in range? Multiple fires in range? (Recommendation: fire at `start_time`, `end_time` marks break window end)
2. **Overlay close behavior:** Auto-close on focus loss, or require explicit Done/Snooze/Dismiss? (From `loop-research.md` §4)
3. **Multiple simultaneous triggers:** If 2 habits fire at same minute, queue or stack? (Recommendation: queue — show one at a time)
4. **System tray:** Should app minimize to tray when main window closes? Affects "running in background" UX. (Recommendation: defer to S-03 or later — not required for core loop proof)
5. **Streak calculation scope:** Recalculate on `mark_done` only, or also on app start / day change? (Recommendation: on `mark_done` + on dashboard load)
