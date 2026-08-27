# Onboarding + First Habit Creation — Implementation Plan

## Overview

Build the complete onboarding flow (US-01): 3-step wizard (welcome → name → habit creator), persist user profile and habit with normalized schedule to SQLite, show created habit on a minimal dashboard. First real feature on top of the F-01 persistence scaffold.

## Current State Analysis

F-01 (`sqlite-persistence-scaffold`) landed in `a1ce762`. The Rust backend has `Database`, `AppError` (Database variant only), and an empty `MIGRATIONS` array. The frontend is the default Tauri scaffold — no routing, no state management, no domain components. `zustand`, `@tanstack/react-router`, `framer-motion`, and `lucide-react` are not yet installed.

### Key Discoveries:

- `src-tauri/src/db/migrations.rs:7` — `MIGRATIONS` is an empty slice, ready for domain tables
- `src-tauri/src/error.rs:4` — only `Database(String)` variant; `Validation` and `NotFound` prescribed in `src-tauri/CLAUDE.md:64-69` but not yet added
- `src-tauri/CLAUDE.md:233-251` — prescribes module layout: `models/`, `commands/`, `db/` with domain files
- `src/CLAUDE.md:44-65` — prescribes Zustand store slices pattern with `HabitSlice` example
- `src/CLAUDE.md:93-120` — prescribes typed invoke wrappers and parallel invocation patterns
- `package.json` — no router, no state management, no animation library installed
- TanStack Router v1.170+ supports Vite 7 + React 19; needs `@tanstack/router-plugin` for file-based routing
- Tauri desktop app requires hash-based history (no server for HTML5 history fallback)

## Desired End State

User launches the app for the first time, sees a welcome screen with animation, enters their name, creates a habit (name, description, icon from lucide-react with color/stroke customization, schedule with day-of-week and time slots, optional end date), and lands on a dashboard showing the created habit as a card. On subsequent launches, the app goes directly to the dashboard.

**Verification:** `cd src-tauri && cargo test` passes (habit CRUD + profile), `pnpm test` passes (component tests), app launches via `pnpm tauri dev`, full onboarding flow works end-to-end, dashboard shows habit after completion.

## What We're NOT Doing

- Multi-habit management (FR-005) — deferred to v2, MVP = 1 habit
- Overlay notifications / reminders (S-02 scope)
- Completion tracking / streak calculation (S-02 scope)
- Month calendar view (S-03 scope)
- Streak freeze (S-04 scope)
- Dinosaur mascot (S-05 scope)
- Edit/delete habit — only creation in S-01
- Dark/light mode (FR-011, nice-to-have)
- i18n (FR-010, nice-to-have)

## Implementation Approach

Bottom-up: data layer first (Rust migrations, models, repos, commands), then frontend foundation (deps, routing, stores, types), then onboarding UI, then dashboard with routing guard. Each phase is independently testable.

## Critical Implementation Details

- **Hash history for TanStack Router** — Tauri serves frontend from local files / dev server without HTML5 history fallback. Must use `createHashHistory()` when creating the router, otherwise navigation breaks in production builds.
- **TanStack Router plugin ordering** — `TanStackRouterVite()` must come before `react()` in the Vite plugins array, or file-based route generation fails silently.

---

## Phase 1: Data Layer (Rust)

### Overview

Add domain tables (user_profile, habits, habit_schedule_days, habit_schedule_times) with indexes. Extend AppError. Create models, repositories, and Tauri commands. Verify with integration tests.

### Changes Required:

#### 1. UUID dependency

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `uuid` crate for generating unique IDs for all domain entities.

**Contract**: `uuid = { version = "1", features = ["v4"] }` in `[dependencies]`.

#### 2. Domain migrations

**File**: `src-tauri/src/db/migrations.rs`

**Intent**: Add two migrations to the `MIGRATIONS` array — one for user_profile, one for habits + schedule tables with indexes.

**Contract**:
- Migration 0: `user_profile` table (id TEXT PK, name TEXT NOT NULL, onboarding_completed INTEGER DEFAULT 0, created_at TEXT)
- Migration 1: `habits` table (id TEXT PK, name TEXT NOT NULL, description TEXT DEFAULT '', icon TEXT NOT NULL, icon_color TEXT DEFAULT '#000000', icon_stroke_width REAL DEFAULT 2.0, start_date TEXT NOT NULL, end_date TEXT nullable, is_active INTEGER DEFAULT 1, created_at TEXT) + `habit_schedule_days` table (id TEXT PK, habit_id TEXT FK → habits ON DELETE CASCADE, day_of_week INTEGER CHECK 0-6) + `habit_schedule_times` table (id TEXT PK, habit_id TEXT FK → habits ON DELETE CASCADE, start_time TEXT NOT NULL, end_time TEXT NOT NULL) + indexes on habit_id columns

All timestamps use UTC per CLAUDE.md data handling rule.

#### 3. Extended error types

**File**: `src-tauri/src/error.rs`

**Intent**: Add `Validation(String)` and `NotFound(String)` variants to `AppError` per `src-tauri/CLAUDE.md:64-69` pattern. Update `Display` impl.

**Contract**: `AppError::Validation(String)`, `AppError::NotFound(String)` variants. Both serialize cleanly for IPC.

#### 4. Domain models

**File**: `src-tauri/src/models/mod.rs`
**File**: `src-tauri/src/models/user_profile.rs`
**File**: `src-tauri/src/models/habit.rs`

**Intent**: Create typed structs for all domain entities. Models derive `Serialize`/`Deserialize` for IPC boundary. Input types have `validate()` methods.

**Contract**:
- `UserProfile { id, name, onboarding_completed: bool, created_at }` — Serialize + Deserialize
- `CreateUserProfileInput { name }` — Deserialize, with `validate()` (name not empty)
- `Habit { id, name, description, icon, icon_color, icon_stroke_width, start_date, end_date, is_active, created_at, schedule_days: Vec<u8>, schedule_times: Vec<TimeSlot> }` — Serialize. Note: includes denormalized schedule data from joined tables
- `TimeSlot { start_time, end_time }` — Serialize + Deserialize
- `CreateHabitInput { name, description, icon, icon_color, icon_stroke_width, schedule_days: Vec<u8>, schedule_times: Vec<TimeSlot>, start_date, end_date }` — Deserialize, with `validate()` (name not empty, at least 1 day, at least 1 time slot, valid day range 0-6)

#### 5. User profile repository

**File**: `src-tauri/src/db/user_profile.rs`

**Intent**: CRUD operations for user_profile table following the repository pattern from `src-tauri/CLAUDE.md:120-175`.

**Contract**: `UserProfileRepository` with methods:
- `create(&self, input: &CreateUserProfileInput) -> Result<UserProfile, AppError>` — generates UUID, inserts, returns created row
- `get(&self) -> Result<Option<UserProfile>, AppError>` — returns first profile or None (single-user app)
- `complete_onboarding(&self) -> Result<(), AppError>` — sets onboarding_completed = 1

#### 6. Habit repository

**File**: `src-tauri/src/db/habits.rs`

**Intent**: CRUD operations for habits + schedule tables. Inserts habit and schedule rows in a transaction. Returns habit with schedule data joined.

**Contract**: `HabitRepository` with methods:
- `create(&self, input: &CreateHabitInput) -> Result<Habit, AppError>` — wraps insert of habit + schedule_days + schedule_times in a transaction. Generates UUIDs for all rows
- `get(&self, id: &str) -> Result<Habit, AppError>` — joins habits with schedule tables. Returns `NotFound` if missing
- `list(&self) -> Result<Vec<Habit>, AppError>` — returns all habits with schedule data joined

#### 7. Tauri commands

**File**: `src-tauri/src/commands/mod.rs`
**File**: `src-tauri/src/commands/user_profile.rs`
**File**: `src-tauri/src/commands/habits.rs`

**Intent**: Thin command handlers that validate input, delegate to repositories, and return results. Follow `src-tauri/CLAUDE.md:6-17` pattern.

**Contract**:
- `create_user_profile(state, input) -> Result<UserProfile, AppError>`
- `get_user_profile(state) -> Result<Option<UserProfile>, AppError>`
- `complete_onboarding(state) -> Result<(), AppError>`
- `create_habit(state, input) -> Result<Habit, AppError>`
- `get_habit(state, id) -> Result<Habit, AppError>`
- `list_habits(state) -> Result<Vec<Habit>, AppError>`

#### 8. Wire modules and commands in lib.rs

**File**: `src-tauri/src/lib.rs`

**Intent**: Register new modules (`mod models`, `mod commands`) and add all new commands to `invoke_handler`. Keep `greet` command — it is removed in Phase 2 alongside the frontend that calls it.

**Contract**: `tauri::generate_handler![greet, commands::user_profile::create_user_profile, commands::user_profile::get_user_profile, commands::user_profile::complete_onboarding, commands::habits::create_habit, commands::habits::get_habit, commands::habits::list_habits]`

#### 9. Integration tests

**File**: `src-tauri/tests/db_integration.rs`

**Intent**: Extend existing integration tests to cover user profile and habit CRUD, including schedule persistence and validation errors.

**Contract**: Tests covering:
- Create user profile and retrieve it
- Complete onboarding flips the flag
- Create habit with schedule days and time slots, verify all persisted
- Get habit by ID returns schedule data joined
- List habits returns all with schedules
- Validation: reject empty habit name, reject empty schedule days
- Idempotent migrations on existing DB

### Success Criteria:

#### Automated Verification:

- Rust compiles cleanly: `cd src-tauri && cargo check`
- All tests pass: `cd src-tauri && cargo test`
- Integration tests cover profile + habit CRUD with schedules

#### Manual Verification:

- Migration applies to existing `pauzaro.db` (delete old DB, relaunch app, check tables with `sqlite3`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend Foundation

### Overview

Install all frontend dependencies, set up TanStack Router with file-based routing and hash history, create Zustand stores, typed invoke wrappers, and TypeScript types. Replace scaffold App with router-driven layout.

### Changes Required:

#### 1. Install dependencies

**File**: `package.json`

**Intent**: Add all frontend dependencies needed for S-01.

**Contract**: 
- Dependencies: `@tanstack/react-router`, `zustand`, `framer-motion`, `lucide-react`
- Dev dependencies: `@tanstack/router-plugin`
- Install via `pnpm add` / `pnpm add -D`

#### 2. Vite router plugin

**File**: `vite.config.ts`

**Intent**: Add TanStack Router Vite plugin for file-based route generation.

**Contract**: Import `TanStackRouterVite` from `@tanstack/router-plugin/vite`. Add as first plugin (before `react()`). This auto-generates `src/routeTree.gen.ts` from `src/routes/` directory.

#### 3. TypeScript types

**File**: `src/types/index.ts`

**Intent**: Frontend type definitions matching Rust models for type-safe IPC.

**Contract**: Interfaces for `UserProfile`, `Habit`, `TimeSlot`, `CreateUserProfileInput`, `CreateHabitInput`. Must match Rust struct field names exactly (serde default = snake_case).

#### 4. Typed invoke wrappers

**File**: `src/lib/invoke.ts`

**Intent**: Type-safe wrappers around `@tauri-apps/api/core` `invoke` per `src/CLAUDE.md:93-105` pattern. Each command gets a dedicated function with typed args and return type.

**Contract**: Functions:
- `createUserProfile(input: CreateUserProfileInput): Promise<UserProfile>`
- `getUserProfile(): Promise<UserProfile | null>`
- `completeOnboarding(): Promise<void>`
- `createHabit(input: CreateHabitInput): Promise<Habit>`
- `getHabit(id: string): Promise<Habit>`
- `listHabits(): Promise<Habit[]>`

#### 5. Zustand stores

**File**: `src/stores/onboarding.ts`
**File**: `src/stores/habit.ts`

**Intent**: Domain-split Zustand stores per `src/CLAUDE.md:44-65` pattern. Onboarding store manages wizard state (transient). Habit store manages habits list from backend.

**Contract**:
- `useOnboardingStore`: `{ step: number, name: string, setName, nextStep, prevStep, reset }`
- `useHabitStore`: `{ habits: Habit[], loading: boolean, error: string | null, fetchHabits, addHabit }`

#### 6. Route files

**File**: `src/routes/__root.tsx`
**File**: `src/routes/index.tsx`
**File**: `src/routes/onboarding.tsx`
**File**: `src/routes/dashboard.tsx`

**Intent**: Set up file-based routing structure. Root layout wraps all routes. Index route is a placeholder redirect. Onboarding and dashboard are placeholder pages wired in Phase 3 and 4.

**Contract**:
- `__root.tsx`: root layout with `<Outlet />`, base styles
- `index.tsx`: redirects to `/dashboard` or `/onboarding` based on `getUserProfile()` result (onboarding_completed flag). Use route `beforeLoad` for the check
- `onboarding.tsx`: renders placeholder, replaced in Phase 3
- `dashboard.tsx`: renders placeholder, replaced in Phase 4

#### 7. Router setup in main.tsx

**File**: `src/main.tsx`

**Intent**: Replace scaffold `<App />` render with `<RouterProvider>` using hash history for Tauri compatibility.

**Contract**: Import `routeTree` from auto-generated `routeTree.gen`, create router with `createHashHistory()`, render `<RouterProvider router={router} />`. Include `Register` type declaration for type-safe route references.

#### 8. Remove scaffold files

**File**: `src/App.tsx` (delete)
**File**: `src/App.css` (delete)
**File**: `src/assets/react.svg` (delete)
**File**: `index.html` (update title)

**Intent**: Remove default Tauri scaffold UI — replaced by route-based pages. Also remove `greet` command from `src-tauri/src/lib.rs` invoke_handler (deferred from Phase 1 to keep frontend working between phases). Clean up orphaned assets and update HTML title.

**Contract**: Delete App.tsx, App.css, and react.svg. Remove any imports referencing them. In `src-tauri/src/lib.rs`, remove the `greet` function and drop `greet` from `generate_handler![]`. In `index.html`, change `<title>` from "Tauri + React + Typescript" to "Pauzaro".

#### 9. Base styles

**File**: `src/styles/global.css`

**Intent**: Minimal global styles replacing App.css. Set up CSS custom properties for consistent theming.

**Contract**: CSS reset, font stack, CSS variables for colors/spacing. Import in `__root.tsx`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `tsc --noEmit`
- Frontend tests pass: `pnpm test`
- Lint passes: `pnpm lint`
- Routes generate without errors (routeTree.gen.ts created)

#### Manual Verification:

- App launches via `pnpm tauri dev`
- Navigation works: index redirects to onboarding (no profile yet)
- Onboarding placeholder page renders
- No console errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Onboarding Wizard

### Overview

Build the 3-step onboarding wizard: welcome screen, name input, habit creator (with lucide-react icon picker, schedule picker, dates). Wire to backend commands. Add Framer Motion transitions between steps. Component tests for key flows.

### Changes Required:

#### 1. Onboarding wizard orchestrator

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**: Container component managing wizard state via useOnboardingStore. Renders current step with Framer Motion `AnimatePresence` for transitions between steps. Handles forward/back navigation.

**Contract**: Renders WelcomeStep → NameStep → HabitCreatorStep based on `step` from store. Wraps step transitions in Framer Motion layout animations (slide or fade).

#### 2. Welcome step

**File**: `src/components/onboarding/WelcomeStep.tsx`

**Intent**: First onboarding screen — introduces app purpose with animation. Has a "Get Started" button to advance.

**Contract**: Displays app name/logo, brief explanation of what Pauzaro does, animated entrance (Framer Motion). Single CTA button advances to next step.

#### 3. Name step

**File**: `src/components/onboarding/NameStep.tsx`

**Intent**: Collect user's name. Validates non-empty before allowing advance.

**Contract**: Text input for name, synced to onboarding store. "Continue" button first calls `getUserProfile()` — if profile exists, skip creation and advance. Otherwise calls `createUserProfile` invoke wrapper, then advances step. Shows validation error if name empty. This handles the resume case: if the user closed the app mid-onboarding and relaunches, the existing profile is reused instead of creating a duplicate.

#### 4. Icon picker component

**File**: `src/components/shared/IconPicker.tsx`

**Intent**: Reusable icon picker using lucide-react library. Opens as a popover/modal with search, icon grid, color picker, and stroke width control.

**Contract**: Props: `{ value: { name: string, color: string, strokeWidth: number }, onChange: (icon) => void }`. Renders trigger button showing selected icon preview. Popover contains:
- Search input filtering lucide-react icons by name
- Scrollable icon grid
- Color picker (preset palette or hex input)
- Stroke width slider (1-3 range)

**Icon import strategy**: Use `import { icons } from "lucide-react"` to get the full `Record<string, LucideIcon>` map. Bundle size (~200KB) is acceptable for a desktop app. Create a shared `DynamicIcon` helper component (`src/components/shared/DynamicIcon.tsx`) that takes `{ name: string, color: string, strokeWidth: number }` and renders `icons[name]` with fallback for unknown names. Both IconPicker and HabitCard (Phase 4) use this helper.

#### 5. Schedule picker component

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Reusable schedule picker for selecting days of week and time slots.

**Contract**: Props: `{ days: number[], times: TimeSlot[], onDaysChange, onTimesChange }`. Renders:
- 7 day-of-week toggle buttons (Mon-Sun)
- List of time slot rows (start time + end time inputs), each removable
- "Add time slot" button
- At least 1 day and 1 time slot required (validation)

#### 6. Habit creator step

**File**: `src/components/onboarding/HabitCreatorStep.tsx`

**Intent**: Final onboarding step — full habit creation form. Collects name, description, icon (via IconPicker), schedule (via SchedulePicker), start date, optional end date.

**Contract**: Form with fields:
- Habit name (text input, required)
- Description (textarea, optional)
- Icon picker (IconPicker component)
- Schedule (SchedulePicker component)
- Start date (date input, defaults to today UTC)
- End date (date input, optional)
- "Create Habit" button calls `createHabit` + `completeOnboarding` invoke wrappers, then navigates to dashboard

#### 7. Wire onboarding route

**File**: `src/routes/onboarding.tsx`

**Intent**: Replace placeholder with OnboardingWizard component.

**Contract**: Route component renders `<OnboardingWizard />`.

#### 8. Component tests

**File**: `src/components/onboarding/OnboardingWizard.test.tsx`
**File**: `src/components/shared/SchedulePicker.test.tsx`

**Intent**: Test key onboarding flows and schedule picker logic.

**Contract**: Tests covering:
- Wizard advances through steps
- Name validation rejects empty input
- Schedule picker enforces at least 1 day and 1 time slot
- Habit creator form validates required fields
- Mock invoke calls verify correct payload sent to backend

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `tsc --noEmit`
- Frontend tests pass: `pnpm test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Welcome screen shows with animation
- Name input validates and persists
- Icon picker opens, search works, color/stroke customization works
- Schedule picker allows selecting days and adding/removing time slots
- Habit creation succeeds and navigates to dashboard
- Back navigation between wizard steps works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dashboard + Routing Guard

### Overview

Build minimal dashboard showing the created habit as a card. Add routing guard so completed onboarding redirects to dashboard on subsequent launches.

### Changes Required:

#### 1. Habit card component

**File**: `src/components/dashboard/HabitCard.tsx`

**Intent**: Display a single habit as a card with its icon (rendered with lucide-react, using stored color/stroke), name, description, and schedule summary (e.g., "Mon, Wed, Fri · 10:00-10:15").

**Contract**: Props: `{ habit: Habit }`. Renders icon from lucide-react dynamically by name, styled with habit's color and stroke width. Shows schedule as human-readable summary text.

#### 2. Dashboard page

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Main dashboard view. Fetches habits from backend and displays them as cards. Shows user greeting with name from profile.

**Contract**: On mount, calls `listHabits()` and `getUserProfile()` via invoke wrappers. Renders greeting ("Hello, {name}!") and HabitCard for each habit. Handles loading/error states per discriminated union pattern from `src/CLAUDE.md:126-133`.

#### 3. Wire dashboard route

**File**: `src/routes/dashboard.tsx`

**Intent**: Replace placeholder with Dashboard component.

**Contract**: Route component renders `<Dashboard />`.

#### 4. Routing guard

**File**: `src/routes/index.tsx`

**Intent**: Root index route checks onboarding status and redirects. If onboarding completed → dashboard. If not → onboarding.

**Contract**: Use TanStack Router `beforeLoad` to call `getUserProfile()`. If profile exists and `onboarding_completed` is true, redirect to `/dashboard`. Otherwise redirect to `/onboarding`.

#### 5. Dashboard component tests

**File**: `src/components/dashboard/Dashboard.test.tsx`
**File**: `src/components/dashboard/HabitCard.test.tsx`

**Intent**: Test dashboard rendering and habit card display.

**Contract**: Tests covering:
- Dashboard fetches and displays habits
- HabitCard renders icon, name, schedule summary
- Loading state renders correctly
- Empty state handled (should not occur after onboarding, but defensive)

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `tsc --noEmit`
- Frontend tests pass: `pnpm test`
- Lint passes: `pnpm lint`
- Rust tests still pass: `cd src-tauri && cargo test`

#### Manual Verification:

- After completing onboarding, dashboard shows created habit with correct icon/color/schedule
- Relaunching app goes directly to dashboard (skips onboarding)
- Habit card displays schedule summary correctly
- No console errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Rust Integration Tests:

- User profile create/get/complete_onboarding lifecycle
- Habit CRUD with schedule days and time slots joined
- Validation: empty name rejected, empty schedule rejected
- Migration idempotency on existing DB

### Frontend Component Tests:

- Onboarding wizard step transitions
- Name input validation
- Schedule picker day/time management
- Habit creator form validation and submit
- Dashboard data fetching and rendering
- HabitCard icon/schedule display

### Manual Testing Steps:

1. Delete existing `pauzaro.db`, launch app — should show onboarding
2. Complete full onboarding flow with a habit
3. Verify habit appears on dashboard with correct details
4. Close and relaunch — should go directly to dashboard
5. Check `pauzaro.db` with sqlite3 — verify all tables and data

## Performance Considerations

- lucide-react is tree-shakable but the icon picker needs to import all icons for search. Consider lazy-loading the picker popover to avoid loading all icons at mount
- Framer Motion adds ~30KB to bundle but is used throughout onboarding — acceptable tradeoff for animation quality
- Schedule queries join 3 tables — with indexes on habit_id, this is instant for single-user volumes

## Migration Notes

Existing `pauzaro.db` from F-01 has only `schema_version` table at version 0. The two new migrations will apply cleanly on next app launch, bringing version to 2.

## References

- Prescriptive Rust patterns: `src-tauri/CLAUDE.md` (commands, repos, models, errors)
- Prescriptive frontend patterns: `src/CLAUDE.md` (Zustand, invoke wrappers, discriminated unions)
- PRD user story: `context/foundation/prd.md:51-62` (US-01)
- PRD functional requirements: `context/foundation/prd.md:82-92` (FR-001 through FR-004)
- F-01 implementation: `context/changes/sqlite-persistence-scaffold/plan.md`
- Roadmap: `context/foundation/roadmap.md:77-87` (S-01)
- Change folder: `context/changes/onboarding-first-habit/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer (Rust)

#### Automated

- [x] 1.1 Rust compiles cleanly: `cd src-tauri && cargo check` — 0c7c314
- [x] 1.2 All tests pass: `cd src-tauri && cargo test` — 0c7c314
- [x] 1.3 Integration tests cover profile + habit CRUD with schedules — 0c7c314

#### Manual

- [ ] 1.4 Migration applies to existing pauzaro.db (tables verified with sqlite3)

### Phase 2: Frontend Foundation

#### Automated

- [x] 2.1 TypeScript compiles: `tsc --noEmit`
- [x] 2.2 Frontend tests pass: `pnpm test`
- [x] 2.3 Lint passes: `pnpm lint`
- [x] 2.4 Routes generate without errors (routeTree.gen.ts created)

#### Manual

- [x] 2.5 App launches via `pnpm tauri dev`
- [x] 2.6 Index redirects to onboarding (no profile yet)
- [x] 2.7 No console errors

### Phase 3: Onboarding Wizard

#### Automated

- [ ] 3.1 TypeScript compiles: `tsc --noEmit`
- [ ] 3.2 Frontend tests pass: `pnpm test`
- [ ] 3.3 Lint passes: `pnpm lint`

#### Manual

- [ ] 3.4 Welcome screen shows with animation
- [ ] 3.5 Name input validates and persists
- [ ] 3.6 Icon picker works (search, color, stroke width)
- [ ] 3.7 Schedule picker works (days toggle, time slots add/remove)
- [ ] 3.8 Habit creation succeeds and navigates to dashboard
- [ ] 3.9 Back navigation between wizard steps works

### Phase 4: Dashboard + Routing Guard

#### Automated

- [ ] 4.1 TypeScript compiles: `tsc --noEmit`
- [ ] 4.2 Frontend tests pass: `pnpm test`
- [ ] 4.3 Lint passes: `pnpm lint`
- [ ] 4.4 Rust tests still pass: `cd src-tauri && cargo test`

#### Manual

- [ ] 4.5 Dashboard shows created habit with correct icon/color/schedule
- [ ] 4.6 Relaunching app goes directly to dashboard
- [ ] 4.7 Habit card displays schedule summary correctly
- [ ] 4.8 No console errors
