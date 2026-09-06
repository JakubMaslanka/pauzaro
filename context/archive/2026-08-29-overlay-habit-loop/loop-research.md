# S-02 Technical Research: Overlay Habit Loop

> Researched: 2026-08-29
> Sources: Exa web search (Tauri 2 docs, crates.io, GitHub repos, tutorials)

## 1. Overlay Windows — Built-in Tauri 2 API

No external library needed. `WebviewWindowBuilder` covers all requirements:

```rust
WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
    .always_on_top(true)      // stays above all windows
    .decorations(false)       // borderless
    .skip_taskbar(true)       // no taskbar entry
    .center()
    .inner_size(400.0, 300.0)
    .build()?;
```

### Key constraints

- **Must use `async` commands** on Windows — synchronous `WebviewWindowBuilder::new()` deadlocks due to Webview2 issue ([wry#583](https://github.com/tauri-apps/wry/issues/583))
- **Unique window labels** — calling `new()` with existing label crashes. Always check `app.get_webview_window("overlay")` first; focus if exists, create if not.
- **Capability needed** — `core:webview:allow-create-webview-window` in `capabilities/default.json`
- **Cross-window communication** — Tauri event system: `emit()` (broadcast), `emitTo(label)` (targeted), `listen()` (subscribe)
- **Close on focus loss** (optional) — `.on_window_event(|evt| match evt { WindowEvent::Focused(false) => window.close() })` if desired

### References

- Tauri docs: <https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html>
- Tutorial: <https://tauritutorials.com/blog/creating-windows-in-tauri>
- JS API: <https://v2.tauri.app/reference/javascript/api/namespacewindow/>

---

## 2. Background Scheduling — Options Evaluated

### Option A: `tokio-cron-scheduler` (v0.15.1)

- **What:** Pure Rust crate. Cron expressions, one-shot, repeated jobs. Async tokio-native.
- **Pros:** Flexible (`Job::new_one_shot` for snooze, cron for schedules), UTC by default, timezone support via `chrono-tz`, well-maintained.
- **Cons:** Extra dependency (~5 transitive crates). Runtime state must be rebuilt on app restart. Add/remove jobs on habit edit.
- **Memory:** ~30-50KB for scheduler + 50 jobs.
- **Link:** <https://docs.rs/crate/tokio-cron-scheduler/latest>

### Option B: `tauri-plugin-cron` (v0.1.1)

- **What:** Tauri 2 plugin wrapping cron scheduling. Rust backend threads, frontend events.
- **Pros:** Simple API: `addCronJob(name, expr, callback)`. Tauri-native.
- **Cons:** **No one-shot/duration-based scheduling** — cron expressions only. Snooze can't work without workarounds. Very young (v0.1.1).
- **Link:** <https://docs.rs/crate/tauri-plugin-cron/latest/source/README_EN.md>

### Option C: `tauri-plugin-schedule-task`

- **What:** Tauri 2 plugin. Absolute time + duration-based scheduling. Cross-platform (Android/iOS too).
- **Pros:** Supports one-shot + recurring. Uses `tokio-cron-scheduler` internally. `ScheduledTaskHandler` trait.
- **Cons:** Extra abstraction over `tokio-cron-scheduler`. Android/iOS focus adds complexity Pauzaro doesn't need. Must be first plugin initialized.
- **Link:** <https://crates.io/crates/tauri-plugin-schedule-task>

### Option D: `tauri-plugin-background-service` (v1.0)

- **What:** Full background service lifecycle. `BackgroundService` trait with `init()` + `run()`.
- **Pros:** Graceful shutdown via `CancellationToken`. Local notifications. Cross-platform keepalive.
- **Cons:** Heavyweight — designed for always-running services, not "fire at time X". No built-in cron/one-shot.
- **Link:** <https://crates.io/crates/tauri-plugin-background-service>

### Option E: Single timer loop (custom, no dependencies) ★ Recommended

- **What:** One `tokio::spawn` task that queries SQLite for next pending habit, sleeps until fire time, emits event, repeats.
- **Pros:** Zero new dependencies (uses tokio already in Tauri). Stateless — reads schedule from DB each iteration. Crash-safe. Snooze = DB write + wake loop via `tokio::sync::Notify`. Automatic sync on habit add/edit/delete.
- **Cons:** Must build yourself (~50 lines). No cron expression parsing (not needed — habit schedules are simple intervals/fixed times).

---

## 3. Decision: Single Timer Loop (Option E)

### Why

| Criterion | `tokio-cron-scheduler` | Single loop |
|---|---|---|
| Memory (50 habits) | ~30-50KB (scheduler + jobs) | ~0KB (one sleeping task) |
| Tokio tasks | 1 scheduler + spawn per fire | 1 task total |
| Sync with DB changes | Must add/remove jobs on habit CRUD | Next iteration reads fresh DB state |
| Snooze | Add one-shot job to scheduler | Write `snoozed_until` to DB, notify loop |
| App restart | Rebuild all jobs from DB | Loop starts, reads DB — zero setup |
| Dependencies | `tokio-cron-scheduler` + ~5 transitive | Zero (tokio already present) |
| Scalability to 50+ habits | Fine but unnecessary complexity | Fine — one SQL query per cycle |

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Rust (Tauri setup)                                       │
│                                                          │
│  tokio::spawn(schedule_loop)                             │
│    1. SELECT next pending habit from SQLite (by time)    │
│    2. tokio::time::sleep_until(fire_at)                  │
│    3. emit("show-overlay", habit_id)                     │
│    4. goto 1                                             │
│                                                          │
│  Notify (tokio::sync::Notify)                            │
│    - Wakes loop when: habit added/edited/deleted/snoozed │
│                                                          │
│  Commands:                                               │
│    show_overlay(habit_id) → WebviewWindowBuilder          │
│    mark_done(habit_id)   → INSERT completion, notify loop │
│    snooze(habit_id, min) → UPDATE snoozed_until, notify   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Frontend (React)                                         │
│                                                          │
│  listen("show-overlay") → open overlay window            │
│  Overlay UI: Done / Snooze buttons → invoke commands     │
│  Dashboard: streak recalculated after mark_done          │
└──────────────────────────────────────────────────────────┘
```

### Snooze flow

```
User clicks "Snooze 5 min"
  → invoke snooze(habit_id, 5)
  → Rust: UPDATE habit SET snoozed_until = now() + 5min WHERE id = ?
  → Rust: notify.notify_one()  // wake schedule loop
  → Loop: query DB, find next pending (maybe this snoozed habit in 5min, maybe another sooner)
  → Loop: sleep_until(earliest)
  → Fire overlay when time comes
```

### Memory estimate (app in background, 50 habits)

```
Tauri shell process:        ~15-20MB (webview idle)
Rust backend:               ~3-5MB  (tokio runtime + SQLite connection)
Schedule loop:              ~0KB    (sleeping, zero allocations)
────────────────────────────────────────────────────────────
Total:                      ~20-25MB (well under 50MB NFR)
```

### Skeleton code

```rust
use std::sync::Arc;
use tokio::sync::Notify;
use tauri::{AppHandle, Manager};

pub struct Scheduler {
    notify: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self { notify: Arc::new(Notify::new()) }
    }

    /// Wake the loop (call after habit CRUD or snooze)
    pub fn wake(&self) {
        self.notify.notify_one();
    }

    /// Main loop — run via tokio::spawn in Tauri setup
    pub async fn run(&self, app: AppHandle, db: Pool) {
        loop {
            let next = find_next_trigger(&db).await;

            match next {
                Some(trigger) => {
                    let delay = trigger.fire_at - Utc::now();
                    if delay > Duration::zero() {
                        tokio::select! {
                            _ = tokio::time::sleep(delay.to_std().unwrap()) => {
                                app.emit("show-overlay", &trigger.habit_id).unwrap();
                            }
                            _ = self.notify.notified() => {
                                // Schedule changed — re-query DB
                                continue;
                            }
                        }
                    } else {
                        // Overdue — fire immediately
                        app.emit("show-overlay", &trigger.habit_id).unwrap();
                    }
                }
                None => {
                    // No habits scheduled — wait for notification
                    self.notify.notified().await;
                }
            }
        }
    }
}
```

---

## 4. Open Questions for Planning

- **Overlay close behavior:** Auto-close on focus loss, or require explicit Done/Snooze/Dismiss?
- **Multiple overlays:** If 2 habits fire at same minute, show one overlay at a time (queue) or stack?
- **System tray:** Should app minimize to tray when main window closes? (affects "running in background")
- **Streak calculation:** Recalculate on `mark_done` only, or also on app start / day change?
