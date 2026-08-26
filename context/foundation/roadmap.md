---
project: "Pauzaro"
version: 1
status: draft
created: 2026-08-25
updated: 2026-08-25
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
| F-01 | sqlite-persistence-scaffold | (foundation) SQLite persistence wired through Tauri SQL plugin; migration runner operational | —             | NFR (local-only data)                 | ready    |
| S-01 | onboarding-first-habit      | launch app, complete onboarding, and create first habit with schedule                       | F-01          | US-01, FR-001, FR-002, FR-003, FR-004 | proposed |
| S-02 | overlay-habit-loop          | receive overlay at scheduled time, mark habit done or snooze, and see streak update         | S-01          | US-02, FR-006, FR-007                 | proposed |
| S-03 | dashboard-month-view        | view full month calendar with per-day completion status and streak history                   | S-02          | US-02, FR-008                         | proposed |
| S-04 | streak-freeze               | freeze streak for up to 2 days to protect series from missed days                           | S-02          | FR-012                                | proposed |
| S-05 | dinosaur-mascot             | see dinosaur mascot reacting to current streak status (happy/neutral/sad)                    | S-02          | FR-009                                | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                              | Note                                                               |
| ------ | ------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| A      | Core loop           | `F-01` → `S-01` → `S-02` → `S-03` | Main learning path — Tauri overlay, Rust scheduling, SQLite.       |
| B      | Gamification extras | `S-04` / `S-05`                    | Both join Stream A at `S-02`. Parallel with `S-03` and each other. |

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
- **Status:** ready

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
- **Status:** proposed

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
- **Status:** proposed

### S-03: Dashboard month view

- **Outcome:** user can view full month calendar with per-day completion status and streak history
- **Change ID:** dashboard-month-view
- **PRD refs:** US-02 (completes month-view acceptance criterion), FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Primarily a frontend slice (calendar grid). Low technical risk but high visual scope — Duolingo-style polish could expand if not time-boxed. Keep first version functional (grid + status icons), defer visual polish.
- **Status:** proposed

### S-04: Streak freeze

- **Outcome:** user can freeze streak for up to 2 days to protect series from one-off missed days
- **Change ID:** streak-freeze
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small scope but touches streak calculation logic from S-02. Must ensure freeze days are correctly excluded from streak-break detection. Edge cases: freeze activated mid-day, freeze on a day with scheduled but not-yet-triggered overlay.
- **Status:** proposed

### S-05: Dinosaur mascot

- **Outcome:** user can see dinosaur mascot reacting to current streak status (happy/neutral/sad)
- **Change ID:** dinosaur-mascot
- **PRD refs:** FR-009
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Needs static dinosaur assets (2-3 states). If no suitable assets are available, creating them is a design task outside code. PRD accepts relaxed visual polish for MVP — simple SVGs or placeholder images suffice.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                          | Ready for `/10x-plan` | Notes                                        |
| ---------- | --------------------------- | ---------------------------------------------- | --------------------- | -------------------------------------------- |
| F-01       | sqlite-persistence-scaffold | Set up SQLite persistence via Tauri SQL plugin | yes                   | Run `/10x-plan sqlite-persistence-scaffold`  |
| S-01       | onboarding-first-habit      | Onboarding flow + first habit creation         | no                    | Needs F-01                                   |
| S-02       | overlay-habit-loop          | Core habit loop: overlay + done/snooze + streak | no                    | Needs S-01                                   |
| S-03       | dashboard-month-view        | Dashboard with month calendar view             | no                    | Needs S-02                                   |
| S-04       | streak-freeze               | Streak freeze mechanism (max 2 days)           | no                    | Needs S-02                                   |
| S-05       | dinosaur-mascot             | Dinosaur mascot with streak-based states       | no                    | Needs S-02                                   |

## Open Roadmap Questions

(none — PRD has zero open questions; no new cross-cutting questions surfaced during framing)

## Parked

- **Multi-habit management (FR-005)** — Why parked: PRD §FR-005 demoted to nice-to-have (v2). MVP = 1 habit.
- **Internationalization (FR-010)** — Why parked: PRD §FR-010 demoted to nice-to-have. One language in MVP; i18n when other users appear.
- **Dark/light mode (FR-011)** — Why parked: PRD §FR-011 demoted to nice-to-have. System preference reading deferred to v2.
- **Cloud sync / multi-device** — Why parked: PRD §Non-Goals. Zero backend, zero network calls.
- **Community / leaderboard / social** — Why parked: PRD §Non-Goals. Solo app, no social features.
- **Mascot editor + Lottie animations** — Why parked: shape-notes §Forward: technical-roadmap. Developer tooling for v2; MVP uses static assets per FR-009 resolution.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)
