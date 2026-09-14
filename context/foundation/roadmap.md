---
project: "Pauzaro"
version: 1
status: draft
created: 2026-08-25
updated: 2026-09-14

prd_version: 1
main_goal: learn
top_blocker: skills
---

# Roadmap: Pauzaro

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A developer in deep focus loses track of time — forgets breaks, movement, and stepping away from the screen. Existing solutions (Pomodoro apps, habit trackers) live in browsers or phones and don't interrupt desktop focus. Pauzaro is a lightweight desktop app that delivers configurable break reminders via overlay windows (not system notifications — harder to ignore in flow state) with streak-based gamification to build healthy habits.

## North star

**S-02: user can receive overlay at scheduled time, mark habit done or snooze, and see streak update on dashboard** — the core product hypothesis (the bet that a desktop overlay with streak tracking will change break behavior better than browser/phone tools) is validated only when this loop works end-to-end. Placed as early as prerequisites allow because everything else only matters if this works.

> The north star is the smallest end-to-end slice whose successful delivery proves the core product hypothesis — placed as early as prerequisites allow because everything else only matters if this works.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                                      | Prerequisites | PRD refs                              | Status   |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------- | -------- |
| F-01 | sqlite-persistence-scaffold | (foundation) SQLite persistence wired through Tauri SQL plugin; migration runner operational | —             | NFR (local-only data)                 | done |
| S-01 | onboarding-first-habit      | launch app, complete onboarding, and create first habit with schedule                       | F-01          | US-01, FR-001, FR-002, FR-003, FR-004 | done |
| S-02 | overlay-habit-loop          | receive overlay at scheduled time, mark habit done or snooze, and see streak update         | S-01          | US-02, FR-006, FR-007                 | done |
| S-03 | dashboard-month-view        | view full month calendar with per-day completion status and streak history                   | S-02          | US-02, FR-008                         | done |
| S-04 | streak-freeze               | freeze streak for up to 2 days to protect series from missed days                           | S-02          | FR-012                                | done |
| S-05 | dinosaur-mascot             | see dinosaur mascot reacting to current streak status (happy/neutral/sad)                    | S-02          | FR-009                                | done        |
| S-06 | missed-repetition-recovery  | on launch, see missed repetitions while app was closed and recover/dismiss them               | S-02          | US-02, FR-007 (streak integrity)      | done |
| S-07 | autostart-and-tray            | have app launch at system startup, live in menu bar tray, and toggle autostart in settings   | S-01          | —                                     | done |
| S-08 | window-state-restore          | have window position and size remembered across app restarts                                 | —             | —                                     | done |
| S-09 | single-instance-enforcement   | (infra) only one app instance runs at a time, keeping memory footprint minimal               | —             | —                                     | done |
| T-01 | testing-critical-path-backend | (testing) streak calc and snooze rules proven correct via Rust unit tests                  | S-02          | test-plan §3 Phase 1                  | done |
| T-02 | testing-scheduler-overlay   | (testing) scheduler fires correctly, overlay→dashboard sync works                            | T-01          | test-plan §3 Phase 2                  | done |
| S-10 | schedule-alert-limit          | see at most 10 time slots per day with info tooltip explaining the cap                      | S-01          | —                                     | done |
| S-11 | calendar-week-start-setting   | choose Sunday or Monday as first day of week, auto-detected from locale                     | S-03          | —                                     | done |
| S-12 | overlay-window-polish         | see a full-bleed overlay panel (no rounded corners, no scroll, edge-to-edge)                | S-02          | —                                     | done |
| S-13 | settings-version-footer       | always see app version pinned to the bottom of the settings view                            | S-07          | —                                     | done |
| S-14 | creation-view-simplify        | create a habit without seeing start/end date fields unless expanding "Options"               | S-01          | —                                     | done |
| T-03 | testing-cross-platform-gates | (testing) cross-platform overlay smoke + test runner wired into CI/pre-commit               | T-02          | test-plan §3 Phase 3                  | backlog |
| D-01 | readme-certification-docs    | (docs) README.md with project overview, architecture, setup, and feature docs for 10xDevs reviewers | —          | —                                     | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                              | Note                                                               |
| ------ | ------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| A      | Core loop           | `F-01` → `S-01` → `S-02` → `S-03` / `S-06` | Main learning path — Tauri overlay, Rust scheduling, SQLite. S-06 branches from S-02 (missed-rep recovery on launch). |
| B      | Gamification extras | `S-04` / `S-05`                    | Both join Stream A at `S-02`. Parallel with `S-03` and each other. |
| C      | Test coverage       | `T-01` → `T-02` → `T-03`          | Sequential rollout from `context/foundation/test-plan.md`. T-01 depends on S-02 (tests existing backend logic). Linear: JAC-13 → JAC-14 → JAC-15. |
| D      | Pre-release polish  | `S-10` / `S-11` / `S-12` / `S-13` / `S-14` | UX refinements before first public release. All independent of each other; each depends only on its parent slice being done (all parents are done). |
| E      | Documentation       | `D-01`                              | Certification-ready README for 10xDevs reviewers. No prerequisites. |

## Baseline

What's already in place in the codebase as of 2026-08-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — React 19 + Vite 7 configured (`vite.config.ts`); routing, component library, and state management absent
- **Backend / API:** partial — Tauri 2 scaffold with stub `greet` command (`src-tauri/src/lib.rs`); no domain logic
- **Data:** absent — no SQLite driver, no schema, no migrations
- **Auth:** not needed — single user, local-only (per tech-stack.md: `has_auth: false`)
- **Deploy / infra:** absent — no CI/CD, no container config, no deploy scripts
- **Observability:** absent — no logging, no error tracking, no metrics

## Foundations

### F-01: SQLite persistence scaffold

- **Outcome:** (foundation) SQLite persistence wired through Tauri SQL plugin; migration runner operational
- **Change ID:** sqlite-persistence-scaffold
- **PRD refs:** NFR ("dane użytkownika nigdy nie opuszczają urządzenia" — local-only persistence), Access Control (on-device storage)
- **Unlocks:** S-01 (habit persistence), S-02 (completion persistence), S-04 (freeze state)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tauri SQL plugin API is new territory; if plugin configuration is non-trivial, downstream slices stall. Sequenced first so any friction surfaces before domain work begins.
- **Status:** done

## Slices

### S-01: Onboarding + first habit creation

- **Outcome:** user can launch app, complete onboarding, and create first habit with schedule
- **Change ID:** onboarding-first-habit
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Four FRs in one slice, but all are part of a single linear onboarding flow (US-01). If habit creator form becomes complex (icon picker, schedule picker, date ranges), scope may bloat — keep UI minimal until core loop proves out.
- **Status:** done

### S-02: Core habit loop — overlay + done/snooze + streak ★

- **Outcome:** user can receive overlay at scheduled time, mark habit done or snooze, and see streak update on dashboard
- **Change ID:** overlay-habit-loop
- **PRD refs:** US-02, FR-006, FR-007
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How does Tauri 2 create always-on-top overlay windows that capture focus? — Owner: user. Block: no.
  - What is the idiomatic Rust pattern for background timers in Tauri (tokio interval vs OS-level scheduler)? — Owner: user. Block: no.
- **Risk:** Hardest technical slice — overlay window management, background scheduling, and snooze re-scheduling all exercise unfamiliar Tauri/Rust APIs. This IS the learning target (main_goal: learn). If overlay windows behave differently on macOS vs Windows, cross-platform work may expand scope.
- **Status:** done

### S-03: Dashboard month view

- **Outcome:** user can view full month calendar with per-day completion status and streak history
- **Change ID:** dashboard-month-view
- **PRD refs:** US-02 (completes month-view acceptance criterion), FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Primarily a frontend slice (calendar grid). Low technical risk but high visual scope — Duolingo-style polish could expand if not time-boxed. Keep first version functional (grid + status icons), defer visual polish.
- **Status:** done

### S-04: Streak freeze

- **Outcome:** user can freeze streak for up to 2 days to protect series from one-off missed days
- **Change ID:** streak-freeze
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small scope but touches streak calculation logic from S-02. Must ensure freeze days are correctly excluded from streak-break detection. Edge cases: freeze activated mid-day, freeze on a day with scheduled but not-yet-triggered overlay.
- **Status:** done

### S-05: Dinosaur mascot

- **Outcome:** user can see dinosaur mascot reacting to current streak status (happy/neutral/sad)
- **Change ID:** dinosaur-mascot
- **PRD refs:** FR-009
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Needs static dinosaur assets (2-3 states). If no suitable assets are available, creating them is a design task outside code. PRD accepts relaxed visual polish for MVP — simple SVGs or placeholder images suffice.
- **Status:** done

### S-06: Missed-repetition recovery on launch

- **Outcome:** on app launch, user sees which habit repetitions were missed while the app was closed and can mark them completed retroactively, dismiss them, or catch up now
- **Change ID:** missed-repetition-recovery
- **PRD refs:** US-02 (streak continuity), FR-007 (streak integrity when app not running)
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Recovery window:** 30 days max. If last activity > 30 days ago, streak resets to 0 and all intermediate days marked as failed — no recovery prompt shown (user lost interest). Recovery modal only appears for gaps ≤ 30 days.
- **Risk:** Touches streak calculation — must ensure retroactive "mark done" inserts completions with correct historical timestamps without corrupting existing streak data. Multi-habit listing adds moderate frontend scope. Edge cases: app closed mid-day (partial day), overlapping snooze state from S-02, gap exactly at 30-day boundary.
- **Scope:**
  - **Backend (Rust):** On startup, query each active habit's schedule against `completions` table. Compare last app-open timestamp against current date. If gap > 30 days: reset streak to 0, bulk-insert failed/missed status for all intermediate scheduled days, skip recovery prompt. If gap ≤ 30 days: for each scheduled time with no matching completion, emit a missed-repetition record. Store "last seen" timestamp (update on each app close / periodic heartbeat).
  - **Frontend (React):** Recovery modal/dialog on dashboard mount when missed list is non-empty. Shows grouped-by-habit list: "Habit Name — X missed repetitions". Three actions per habit: **"Done anyway"** (backfill completions, preserve streak), **"Dismiss"** (acknowledge, streak breaks as expected), **"Catch up now"** (trigger overlay immediately). Modal blocks dashboard until all habits addressed. If streak was auto-reset (>30 days), show brief toast: "Welcome back! Your streak was reset after 30 days of inactivity."
- **Status:** done
- **Linear:** [JAC-16](https://linear.app/jacobs-agents-playground/issue/JAC-16/s-06-missed-repetition-recovery-on-launch)

### S-07: Autostart + menu bar tray

- **Outcome:** app launches at system startup, lives in macOS menu bar (system tray) while running, and user can toggle "Launch at startup" in settings
- **Change ID:** autostart-and-tray
- **PRD refs:** —
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Tauri 2 autostart plugin (`tauri-plugin-autostart`) API and platform quirks — Owner: user. Block: no.
  - Tauri 2 system tray API (`tray` module) for menu bar icon — Owner: user. Block: no.
- **Risk:** Low-medium. Tauri has first-party plugins for both autostart and system tray. macOS may require additional entitlements for login items. Windows/Linux behavior differs (startup folder vs systemd vs XDG autostart).
- **Scope:**
  - **Backend (Rust):** Wire `tauri-plugin-autostart` for login-item registration. Configure Tauri system tray with app icon + context menu (show/quit). Persist autostart preference in SQLite settings table. On app init, sync autostart state with OS registration.
  - **Frontend (React):** Settings screen (or section in existing UI) with "Launch at startup" checkbox. Read current state from backend, toggle via Tauri command.
- **Status:** done
- **Linear:** [JAC-17](https://linear.app/jacobs-agents-playground/issue/JAC-17/s-07-autostart-menu-bar-tray)

### S-08: Window state restore

- **Outcome:** window position and size remembered across app restarts via Tauri Window State plugin
- **Change ID:** window-state-restore
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** all slices
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Tauri provides `tauri-plugin-window-state` out of the box. Minimal config — plugin saves/restores position, size, and maximized state automatically.
- **Scope:**
  - **Backend (Rust):** Add `tauri-plugin-window-state` dependency. Register plugin in Tauri builder. Plugin handles persistence to a local file automatically.
  - **Frontend:** No changes needed — plugin operates at window-manager level.
- **Status:** done
- **Linear:** [JAC-18](https://linear.app/jacobs-agents-playground/issue/JAC-18/s-08-window-state-restore)

### S-09: Single instance enforcement

- **Outcome:** only one instance of app runs at a time; launching again focuses existing window instead of opening duplicate, keeping memory footprint minimal
- **Change ID:** single-instance-enforcement
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** all slices
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Tauri provides `tauri-plugin-single-instance`. On second launch, plugin emits event to existing instance which brings window to front. Edge case: if first instance is unresponsive, user may need to force-quit before relaunching.
- **Scope:**
  - **Backend (Rust):** Add `tauri-plugin-single-instance` dependency. Register plugin with callback that focuses/unminimizes existing main window when duplicate launch detected.
  - **Frontend:** No changes needed — handled entirely in Rust.
- **Status:** done
- **Linear:** [JAC-19](https://linear.app/jacobs-agents-playground/issue/JAC-19/s-09-single-instance-enforcement)

### S-10: Schedule alert limit

- **Outcome:** user can add at most 10 time slots per day in the schedule picker; an info icon (question mark) next to the "What time?" section header shows a tooltip on hover explaining the cap
- **Change ID:** schedule-alert-limit
- **PRD refs:** —
- **Prerequisites:** S-01
- **Parallel with:** S-11, S-12, S-13, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Pure frontend validation change.
- **Scope:**
  - **Frontend (React):** In `SchedulePicker`, disable/hide the "+ Add time slot" button once `times.length >= 10`. Add a Mantine `Tooltip` wrapping a small `?` `ActionIcon` next to the "What time?" heading. Tooltip text: "You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness." Same limit applies in both `ScheduleStep` (onboarding) and `CreateHabitView` (dashboard) since both use the shared `SchedulePicker` component.
  - **Backend (Rust):** Optionally add server-side validation in `CreateHabitInput::validate()` rejecting `schedule_times.len() > 10` as a safety net.
- **Status:** done
- **Linear:** [JAC-20](https://linear.app/jacobs-agents-playground/issue/JAC-20/s-10-schedule-alert-limit-max-10-time-slots)

### S-11: Calendar week start setting

- **Outcome:** user can choose whether the calendar week starts on Sunday (US) or Monday (EU) via a new setting; the app auto-detects the best default from the browser locale (`navigator.language` / `Intl.DateTimeFormat`). Both the `MonthCalendar` grid and the `SchedulePicker` day chips follow this setting.
- **Change ID:** calendar-week-start-setting
- **PRD refs:** —
- **Prerequisites:** S-03
- **Parallel with:** S-10, S-12, S-13, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low-medium. Touches calendar grid rendering (`buildCalendarGrid`, `DAY_HEADERS` in `MonthCalendar`) and day chip ordering (`DAY_LABELS`, `DAY_VALUES` in `SchedulePicker`). Must ensure `schedule_days` values stored in DB (0=Sun, 1=Mon, ..., 6=Sat) remain stable regardless of display order.
- **Scope:**
  - **Backend (Rust):** Add `week_start_day` column to the `settings` table (values: `"sunday"` or `"monday"`, default `"sunday"`). New Tauri command `set_week_start` to update the setting. Extend `Settings` struct and `get_settings` response to include `week_start_day`.
  - **Frontend (React):**
    - **Auto-detection on first launch:** On initial settings creation, read `Intl.DateTimeFormat().resolvedOptions().locale`. If locale suggests a European or Monday-first region (most locales except `en-US`, `en-CA`, `ja`, `ko`, `zh`, etc.), default to `"monday"`; otherwise `"sunday"`. Send detected default to backend.
    - **Settings UI:** Add a new card in `SettingsView` with a segmented control or radio group: "Week starts on: Sunday / Monday".
    - **MonthCalendar:** Make `DAY_HEADERS` and `buildCalendarGrid` respect the setting. When `"monday"`: headers become `["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]`; grid fill logic shifts so Monday = column 0.
    - **SchedulePicker:** Make `DAY_LABELS` and `DAY_VALUES` order dynamic based on the setting. When `"sunday"`: chips show `["Sun", "Mon", "Tue", ..., "Sat"]`. When `"monday"`: chips show `["Mon", "Tue", ..., "Sun"]` (current default). The underlying day values (0-6) sent to the backend stay unchanged.
- **Status:** done
- **Linear:** [JAC-24](https://linear.app/jacobs-agents-playground/issue/JAC-24/s-11-calendar-week-start-setting)

### S-12: Overlay window polish

- **Outcome:** the overlay window renders as a full-bleed, edge-to-edge solid panel with no rounded corners and no scroll; its width accommodates all content without horizontal overflow
- **Change ID:** overlay-window-polish
- **PRD refs:** —
- **Prerequisites:** S-02
- **Parallel with:** S-10, S-11, S-13, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Primarily CSS and Rust window config adjustments.
- **Scope:**
  - **Backend (Rust):** In `TauriOverlaySpawner::spawn_overlay`, adjust `inner_size` to a comfortable fixed width (around 400px) and a height that fits the tallest state (auto-fail text) without scrolling. Keep `decorations(false)` and `always_on_top(true)`. Remove any `transparent` flag if set.
  - **Frontend (React):** In `OverlayPanel`, replace the current `OverlayCard` wrapper (centered `<Card radius="xl" shadow="xl">` inside transparent `100vh` container) with a full-bleed layout: remove outer padding, set `radius={0}` (square corners), remove `maxWidth` constraint, make the card fill the entire viewport edge-to-edge. The background should cover the full window area. Ensure no content overflow causes scrolling.
- **Status:** done
- **Linear:** [JAC-21](https://linear.app/jacobs-agents-playground/issue/JAC-21/s-12-overlay-window-polish-full-bleed-panel)

### S-13: Settings version sticky footer

- **Outcome:** the app version string ("Pauzaro vX.Y.Z") is pinned as a sticky footer at the bottom of the settings view, always visible regardless of scroll position
- **Change ID:** settings-version-footer
- **PRD refs:** —
- **Prerequisites:** S-07
- **Parallel with:** S-10, S-11, S-12, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. CSS-only change.
- **Scope:**
  - **Frontend (React):** In `SettingsView`, restructure the layout so the settings content scrolls independently while the version text remains fixed at the bottom of the viewport (or the settings container). Use `position: sticky; bottom: 0` or a flex layout with `margin-top: auto` on the version element. Keep the current styling (xs, dimmed, centered).
- **Status:** done
- **Linear:** [JAC-22](https://linear.app/jacobs-agents-playground/issue/JAC-22/s-13-settings-version-sticky-footer)

### S-14: Creation view simplification

- **Outcome:** user creates a habit without seeing a start date field (auto-set to today) and without seeing an end date at first glance; end date is accessible via an expandable "Advanced options" section
- **Change ID:** creation-view-simplify
- **PRD refs:** —
- **Prerequisites:** S-01
- **Parallel with:** S-10, S-11, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Frontend-only change; backend contract unchanged.
- **Scope:**
  - **Frontend (React):** Applies to both `CreateHabitView` (dashboard) and `ScheduleStep` (onboarding).
    - **Remove start date field:** Delete the start date `<input type="date">` from the schedule step. The `startDate` state stays initialized to today's date and is sent to the backend as-is, silently.
    - **Collapse end date into "Options":** Replace the end date input with a collapsible section. Default state: collapsed, showing only a subtle "Options" text button. On click, the section expands to reveal the end date picker. Use Mantine's `Collapse` component for smooth animation.
    - The schedule step's primary view becomes: day picker chips + time slot picker only. Clean and focused.
- **Status:** done
- **Linear:** [JAC-23](https://linear.app/jacobs-agents-playground/issue/JAC-23/s-14-creation-view-simplification-options-toggle)

### T-01: Critical-path backend logic tests

- **Outcome:** (testing) streak calculation and snooze 3x auto-fail rule proven correct via pure Rust unit tests
- **Change ID:** testing-critical-path-backend
- **PRD refs:** test-plan §3 Phase 1 — risks #2, #3
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — pure unit tests on existing logic, no I/O dependencies.
- **Status:** done
- **Linear:** [JAC-13](https://linear.app/jacobs-agents-playground/issue/JAC-13/t-01-critical-path-backend-logic-tests)

### T-02: Scheduler + overlay reliability tests

- **Outcome:** (testing) scheduler fires correctly at configured times, overlay→completion→dashboard path works end-to-end
- **Change ID:** testing-scheduler-overlay
- **PRD refs:** test-plan §3 Phase 2 — risks #1, #4
- **Prerequisites:** T-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Medium — integration tests require mock clock / Tauri test harness; patterns may need research.
- **Status:** done
- **Linear:** [JAC-14](https://linear.app/jacobs-agents-playground/issue/JAC-14/t-02-scheduler-overlay-reliability-tests)

### T-03: Cross-platform smoke + quality gates

- **Outcome:** (testing) cross-platform overlay behavior verified on macOS and Windows; test runners wired into pre-commit or CI
- **Change ID:** testing-cross-platform-gates
- **PRD refs:** test-plan §3 Phase 3 — risk #6
- **Prerequisites:** T-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — manual checklist is cheap; CI wiring depends on infra readiness.
- **Status:** backlog
- **Linear:** [JAC-15](https://linear.app/jacobs-agents-playground/issue/JAC-15/t-03-cross-platform-smoke-quality-gates)

### D-01: README for 10xDevs certification reviewers

- **Outcome:** (docs) project README.md contains full project overview, architecture diagram, tech stack, feature list, setup instructions, dev commands, and project structure — everything a 10xDevs certification reviewer needs to understand and evaluate the project
- **Change ID:** readme-certification-docs
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** all slices
- **Blockers:** —
- **Unknowns:** —
- **Risk:** None. Documentation-only change.
- **Scope:**
  - **README.md:** Replace Tauri template README with comprehensive project documentation: vision, tech stack, architecture (Tauri 2 + React 19 + Rust), features, prerequisites, setup, dev commands, project structure, testing strategy, and key design decisions.
- **Status:** done

## Open Roadmap Questions

(none — PRD has zero open questions; no new cross-cutting questions surfaced during framing)

## Parked

- **Internationalization (FR-010)** — Why parked: PRD §FR-010 demoted to nice-to-have. One language in MVP; i18n when other users appear.
- **Dark/light mode (FR-011)** — Why parked: PRD §FR-011 demoted to nice-to-have. System preference reading deferred to v2.
- **Cloud sync / multi-device** — Why parked: PRD §Non-Goals. Zero backend, zero network calls.
- **Community / leaderboard / social** — Why parked: PRD §Non-Goals. Solo app, no social features.
- **Mascot editor + Lottie animations** — Why parked: shape-notes §Forward: technical-roadmap. Developer tooling for v2; MVP uses static assets per FR-009 resolution.
- **SchedulePicker ref mutation during render** — Why parked: `slotKeysRef.current` mutated during render (push/slice) is unsafe under React 18+ concurrent mode. Not a bug today (Tauri webview has no concurrent features), but fragile. Fix: move key generation into addTimeSlot/removeTimeSlot callbacks. Source: impl-review F9 (2026-08-31).
- **Backend time format validation** — Why parked: `CreateHabitInput::validate()` doesn't check `start_time` format (expected "HH:MM"). Invalid string silently never fires in scheduler. Low risk since UI uses `<input type="time">`. Fix: add `NaiveTime::parse_from_str` check. Source: impl-review F10 (2026-08-31).

## Done

- **F-01: (foundation) SQLite persistence wired through Tauri SQL plugin; migration runner operational** — Archived 2026-09-06 → `context/archive/2026-08-26-sqlite-persistence-scaffold/`. Lesson: —.
- **S-01: launch app, complete onboarding, and create first habit with schedule** — Archived 2026-09-06 → `context/archive/2026-08-27-onboarding-first-habit/`. Lesson: —.
- **S-02: receive overlay at scheduled time, mark habit done or snooze, and see streak update** — Archived 2026-09-06 → `context/archive/2026-08-29-overlay-habit-loop/`. Lesson: —.
- **S-03: view full month calendar with per-day completion status and streak history** — Archived 2026-09-06 → `context/archive/2026-08-31-dashboard-month-view/`. Lesson: —.
- **S-06: on app launch, user sees which habit repetitions were missed while the app was closed and can mark them completed retroactively, dismiss them, or catch up now** — Archived 2026-09-06 → `context/archive/2026-09-03-repetition-recovery/`. Lesson: —.
- **T-01: (testing) streak calculation and snooze 3x auto-fail rule proven correct via pure Rust unit tests** — Archived 2026-09-06 → `context/archive/2026-09-01-testing-critical-path-backend/`. Lesson: —.
- **T-02: (testing) scheduler fires correctly at configured times, overlay→completion→dashboard path works end-to-end** — Archived 2026-09-06 → `context/archive/2026-09-02-testing-scheduler-overlay/`. Lesson: —.
- **S-08: window position and size remembered across app restarts via Tauri Window State plugin** — Archived 2026-09-09 → `context/archive/2026-09-09-window-state-restore/`. Lesson: —.
- **S-07: app launches at system startup, lives in menu bar tray, user can toggle autostart in settings** — Archived 2026-09-09 → `context/archive/2026-09-09-autostart-and-tray/`. Lesson: —.
- **S-04: freeze streak for up to 2 days to protect series from missed days** — Archived 2026-09-10 → `context/archive/2026-09-09-streak-freeze/`. Lesson: —.
- **S-09: (infra) only one app instance runs at a time, keeping memory footprint minimal** — Archived 2026-09-10 → `context/archive/2026-09-09-single-instance-enforcement/`. Lesson: —.
- **S-11: choose Sunday or Monday as first day of week, auto-detected from locale** — Archived 2026-09-14 → `context/archive/2026-09-13-calendar-week-start-setting/`. Lesson: —.
- **S-05: see dinosaur mascot reacting to current streak status (happy/neutral/sad)** — Archived 2026-09-14 → `context/archive/2026-09-10-dinosaur-mascot/`. Lesson: —.
