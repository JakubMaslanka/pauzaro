# Onboarding + First Habit Creation — Plan Brief

> Full plan: `context/changes/onboarding-first-habit/plan.md`

## What & Why

Build the complete first-run experience (US-01): a 3-step onboarding wizard that collects the user's name and creates their first habit with a schedule. This is the first user-facing feature — without it, the app has no purpose. It exercises the full stack: SQLite persistence (F-01), Rust commands, React UI with routing and state management.

## Starting Point

F-01 persistence scaffold is operational (`a1ce762`): `Database`, `AppError` (Database variant only), empty `MIGRATIONS` array, `AppState` with `Mutex<Database>`. Frontend is the default Tauri scaffold — no routing, no stores, no domain UI. Zustand, TanStack Router, Framer Motion, and lucide-react are not installed.

## Desired End State

User launches app, completes a 3-step wizard (welcome → name → habit creator), and lands on a dashboard showing the created habit with its icon, schedule summary, and details. On subsequent launches, the app skips onboarding and goes straight to the dashboard.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Routing | TanStack Router (file-based, hash history) | User familiar with it; file-based auto-generates route tree with full type safety; hash history required for Tauri. |
| Schedule storage | Normalized tables (habit_schedule_days + habit_schedule_times) | Proper relational model with indexes for future app expansion. |
| Habit schema | All PRD fields + is_active status | Covers FR-002/003/004 fully without future migration for missing fields. |
| Onboarding flow | Multi-step wizard (3 screens) | Clean separation, guided feel, matches PRD's welcome-explain-name-creator flow. |
| Icon picker | lucide-react with search, color, stroke width | Rich icon library; user can customize appearance per habit. |
| Profile storage | user_profile table | Same persistence pattern as habits; onboarding_completed flag drives routing. |
| Error handling | Add Validation + NotFound to AppError | Matches CLAUDE.md prescribed pattern; frontend can distinguish error types. |
| State management | Two Zustand stores (onboarding + habit) | Clean domain split; onboarding store is transient, habit store persists. |
| Animation | Framer Motion | Polished transitions between wizard steps per PRD's "welcome with animation". |
| Dashboard | Minimal — habit card only | Satisfies US-01 acceptance criteria without bleeding into S-03 month view. |
| Testing | Rust integration + React component tests | Covers both sides; core feature needs regression safety. |

## Scope

**In scope:**
- user_profile + habits + schedule tables with indexes and migrations
- Rust models, repositories, Tauri commands for profile + habit CRUD
- TanStack Router setup with file-based routing and hash history
- Zustand stores for onboarding and habits
- 3-step onboarding wizard with Framer Motion transitions
- lucide-react icon picker with search, color, and stroke width
- Schedule picker (day-of-week toggles + time slot inputs)
- Minimal dashboard with habit card
- Onboarding-complete routing guard
- Rust integration tests + React component tests

**Out of scope:**
- Multi-habit (v2), overlays/reminders (S-02), streaks (S-02), month view (S-03), streak freeze (S-04), mascot (S-05)
- Edit/delete habit, dark mode, i18n

## Architecture / Approach

```
Phase 1 (Rust):  migrations → models → repos → commands → tests
Phase 2 (React): deps → router → stores → types → invoke wrappers
Phase 3 (UI):    wizard steps → icon picker → schedule picker → form → tests
Phase 4 (UI):    dashboard → habit card → routing guard → tests
```

Data flows: React form → Zustand store → typed invoke → Tauri command → repository → SQLite. Dashboard reads back via same path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | DB schema, Rust models/repos/commands, integration tests | Schedule join queries across 3 tables; transaction handling for habit + schedule insert |
| 2. Frontend Foundation | Router, stores, types, invoke wrappers, scaffold routes | TanStack Router + Vite 7 plugin compatibility; hash history for Tauri |
| 3. Onboarding Wizard | 3-step wizard, icon picker, schedule picker, Framer Motion | Icon picker scope (search + color + stroke); schedule picker UX complexity |
| 4. Dashboard + Guard | Habit card, routing guard, onboarding redirect | Dynamic lucide-react icon rendering by stored name |

**Prerequisites:** F-01 (sqlite-persistence-scaffold) — completed (`a1ce762`)
**Estimated effort:** ~3-4 sessions across 4 phases

## Open Risks & Assumptions

- TanStack Router plugin (`@tanstack/router-plugin`) supports Vite 7 (peer dep says yes; untested in this project)
- lucide-react icon picker importing all icons for search may impact bundle size — mitigated by lazy-loading the popover
- Framer Motion + TanStack Router page transitions may need coordination (AnimatePresence at route level)
- Normalized schedule tables add join complexity vs JSON blob — accepted for future extensibility

## Success Criteria (Summary)

- Full onboarding flow works: welcome → name → habit creation → dashboard
- Created habit appears on dashboard with correct icon, color, and schedule
- Relaunching app skips onboarding, goes to dashboard
- `cargo test` and `pnpm test` both pass
