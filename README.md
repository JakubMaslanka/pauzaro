# 🦕 Pauzaro

**Your friendly break reminder for developers.**

A desktop habit-tracking app that delivers configurable break reminders via overlay notifications with streak-based gamification to build healthy habits. Think "Duolingo for developer breaks."

Built with **Tauri 2** (Rust backend) + **React 19** (TypeScript frontend). Runs fully offline, zero network calls, all data stays on-device.

> 📘 This project was developed as part of the [10xDevs](https://10xdevs.pl) AI-assisted development certification program.

---

## Features

| Feature | Description |
|---------|-------------|
| **Onboarding wizard** | Step-by-step habit creation: name, icon, schedule days, time slots |
| **Desktop overlay reminders** | Always-on-top overlay windows that interrupt focus — harder to ignore than regular system notifications |
| **Done / Snooze / Auto-fail** | Mark habit done, snooze (max 3x before auto-fail), or dismiss |
| **Streak tracking** | Consecutive-day streak counter with gamification |
| **Streak freeze** | Freeze streak for up to 2 days to protect from one-off misses |
| **Month calendar view** | Full month calendar grid with per-day completion status and streak history |
| **Dinosaur mascot** | Reactive mascot (happy/neutral/sad) based on current streak status |
| **Missed-repetition recovery** | On launch, detects habits missed while app was closed — mark done retroactively, dismiss, or catch up |
| **Autostart + system tray** | Launch at system startup, live in macOS menu bar with context menu |
| **Window state persistence** | Remembers window position and size across restarts |
| **Single instance** | Only one app instance runs at a time |
| **Week start setting** | Choose Sunday or Monday as first day of week, auto-detected from locale |
| **Schedule alert limit** | Max 10 time slots per day with info tooltip |
| **Configurable habit creation** | Start date auto-set to today, end date tucked under collapsible "Options" |

## Tech Stack

### Frontend
- **React 19** with strict TypeScript
- **Mantine 9** — UI component library with custom theme (`src/theme.ts`)
- **Zustand 5** — state management
- **TanStack Router** — file-based routing
- **Framer Motion** — animations
- **Day.js** — date manipulation
- **Lucide React** — icons

### Backend
- **Tauri 2** — desktop runtime (Rust)
- **Rusqlite** — SQLite persistence (bundled, no external DB)
- **Chrono** — date/time handling
- **Tokio** — async runtime for background scheduling

### Tooling
- **Vite 7** — bundler
- **pnpm** — package manager
- **Biome** — linting + formatting (tabs, double quotes)
- **Vitest** — unit/component tests
- **Playwright** — E2E tests
- **Testing Library** — React component testing
- **Stryker** — mutation testing
- **Lefthook** — git hooks

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Tauri 2 Shell                     │
│                                                     │
│  ┌───────────────────┐   ┌───────────────────────┐  │
│  │  React 19 Frontend│   │    Rust Backend        │  │
│  │                   │   │                        │  │
│  │  Routes:          │   │  Commands:             │  │
│  │  / (onboarding)   │   │  - habits (CRUD)       │  │
│  │  /dashboard       │   │  - overlay (spawn)     │  │
│  │  /create-habit    │   │  - settings            │  │
│  │  /settings        │   │  - recovery            │  │
│  │  /overlay/:id     │   │  - user profile        │  │
│  │                   │   │                        │  │
│  │  State (Zustand): │   │  Core Logic:           │  │
│  │  - dashboard      │   │  - scheduler (tokio)   │  │
│  │  - onboarding     │   │  - streak calculator   │  │
│  │  - habit          │   │  - overlay spawner     │  │
│  │  - settings       │   │  - recovery engine     │  │
│  │                   │   │                        │  │
│  │  UI: Mantine 9    │   │  DB: SQLite (rusqlite) │  │
│  └───────┬───────────┘   └───────────┬────────────┘  │
│          │      Tauri IPC (invoke)   │               │
│          └───────────────────────────┘               │
│                                                     │
│  Plugins: autostart, window-state, single-instance, │
│           system tray, opener                        │
└─────────────────────────────────────────────────────┘
```

**Data flow:** Frontend invokes Rust commands via Tauri IPC. Rust handles all persistence (SQLite), scheduling (tokio background tasks), and window management (overlay spawning). No network layer — everything local.

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 11
- **Rust** ≥ 1.85 (stable)
- **Tauri 2 system dependencies** — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft Visual Studio C++ Build Tools, WebView2
  - Linux: various system libraries (see Tauri docs)

## Getting Started

```bash
# Clone
git clone https://github.com/JakubMaslanka/pauzaro.git
cd pauzaro

# Install frontend dependencies
pnpm install

# Run full desktop app (frontend + Rust backend)
pnpm tauri dev

# Run frontend only (no Rust, no desktop features)
pnpm dev
```

## Development Commands

| Task | Command |
|------|---------|
| Dev (full Tauri app) | `pnpm tauri dev` |
| Dev (frontend only) | `pnpm dev` |
| Build production | `pnpm tauri build` |
| Type-check | `tsc --noEmit` |
| Rust check | `cd src-tauri && cargo check` |
| Rust tests | `cd src-tauri && cargo test` |
| Frontend tests | `pnpm test` |
| Frontend tests (watch) | `pnpm test:watch` |
| E2E tests | `pnpm test:e2e` |
| Lint + format check | `pnpm lint` |
| Lint + format fix | `pnpm lint:fix` |

## Project Structure

```
pauzaro/
├── src/                          # React frontend
│   ├── components/
│   │   ├── dashboard/            # Dashboard, calendar, streak, habit cards, recovery
│   │   ├── habits/               # Habit creation view
│   │   ├── layout/               # App navbar
│   │   ├── onboarding/           # Onboarding wizard steps
│   │   ├── overlay/              # Overlay panel (done/snooze/fail)
│   │   ├── settings/             # Settings view
│   │   ├── shared/               # Reusable: SchedulePicker, IconPicker, MascotImage
│   │   └── debug/                # Debug tools (dev only)
│   ├── routes/                   # TanStack Router file-based routes
│   ├── stores/                   # Zustand stores (dashboard, onboarding, habit, settings)
│   ├── lib/                      # Utilities (invoke wrapper, locale, mascot logic)
│   ├── types/                    # Shared TypeScript interfaces
│   └── theme.ts                  # Mantine theme configuration
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands/             # Tauri IPC command handlers
│       │   ├── habits.rs         # Habit CRUD
│       │   ├── overlay.rs        # Overlay window spawning
│       │   ├── recovery.rs       # Missed-repetition recovery
│       │   ├── settings.rs       # App settings
│       │   ├── user_profile.rs   # User profile
│       │   └── debug.rs          # Debug commands
│       ├── db/                   # Database layer
│       │   ├── migrations.rs     # SQLite schema migrations
│       │   ├── habits.rs         # Habit queries
│       │   ├── completions.rs    # Completion records
│       │   ├── freeze.rs         # Streak freeze state
│       │   ├── settings.rs       # Settings persistence
│       │   ├── pending_triggers.rs # Scheduled trigger tracking
│       │   ├── app_state.rs      # App state tracking
│       │   └── user_profile.rs   # User profile queries
│       ├── models/               # Data structures
│       ├── scheduler.rs          # Background scheduling (tokio)
│       ├── streak.rs             # Streak calculation logic
│       ├── recovery.rs           # Recovery engine
│       ├── tray.rs               # System tray setup
│       ├── error.rs              # Error types
│       ├── lib.rs                # Tauri app builder + plugin registration
│       └── main.rs               # Entry point
├── context/                      # Project planning docs (10xDevs methodology)
│   ├── foundation/               # PRD, roadmap, test plan, tech stack
│   └── archive/                  # Archived slice implementations
├── public/                       # Static assets (app icon)
└── CLAUDE.md                     # AI assistant project instructions
```

## Testing

**Frontend (Vitest + Testing Library):**
- Component tests for Dashboard, MonthCalendar, HabitCard, OverlayPanel, RecoveryModal, SchedulePicker, OnboardingWizard, DayCell
- Unit tests for locale detection and mascot state logic
- Run: `pnpm test`

**Backend (Rust unit tests):**
- Streak calculation correctness
- Snooze 3x auto-fail rule
- Scheduler timing accuracy
- Overlay-to-dashboard sync
- Run: `cd src-tauri && cargo test`

**E2E (Playwright):**
- Available via `pnpm test:e2e`

**Mutation testing (Stryker):**
- Configured for Vitest runner to validate test quality

## Key Design Decisions

1. **Overlay windows instead of system notifications** — Desktop overlays are harder to ignore during deep focus. Tauri creates always-on-top, undecorated windows that demand interaction (done/snooze/dismiss).

2. **Local-only data** — Zero network calls. SQLite database stored on-device. No accounts, no cloud sync. Privacy by architecture.

3. **Rust for scheduling** — Background timers use tokio intervals in Rust, not JavaScript timers. More reliable for long-running desktop processes.

4. **Streak gamification** — Duolingo-inspired streak counter with freeze mechanic and reactive mascot to create emotional investment in maintaining habits.

5. **Recovery on launch** — App detects missed repetitions from when it was closed and offers retroactive completion (up to 30-day window). Prevents streak loss from forgetting to open the app.

6. **Local time everywhere** — No UTC. `new Date()` in JS, `Local::now()` in Rust. Single-device app with no timezone sync needs.

## License

© 2026 Nondescript Studio
