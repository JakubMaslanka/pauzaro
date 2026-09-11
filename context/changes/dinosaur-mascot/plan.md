# Pauzaro Mascot Integration + First-Release Polish — Implementation Plan

## Overview

Integrate the Pauzaro dinosaur mascot throughout the app — streak-reactive images in side nav and StreakHero, animated speech bubble onboarding redesign — and polish the app for first macOS release (native menu bar, proper naming, error boundary, accessibility, metadata).

## Current State Analysis

- **Side nav** (`AppNavbar.tsx:48`): dinosaur is a `🦕` emoji inside an `ActionIcon`. No image asset used.
- **StreakHero** (`StreakHero.tsx`): shows Flame icon from lucide-react, streak number, and text message. Uses Framer Motion spring animations.
- **Onboarding** (`OnboardingWizard.tsx`): 4-step wizard using emoji (`🦕`) on each step. Generic copy ("Hey there!"). No mascot images.
- **Assets**: `src/assets/icon.png` (unused dinosaur mascot), `src/assets/pauzaro-reactions/` with 5 PNGs (happy, sad, freeze, promissing, successful) — all unused.
- **App naming**: `tauri.conf.json` has `productName: "pauzaro"` and window `title: "pauzaro"` (lowercase). Rest of UI uses "Pauzaro".
- **No native macOS menu bar** — only system tray menu. No Edit menu (Cmd+C/V broken), no About dialog, no standard keyboard shortcuts.
- **No error boundary** — render crash = white screen.
- **No `defaultColorScheme`** — dark mode system preference breaks hardcoded light backgrounds.
- **Cargo.toml**: placeholder description "A Tauri App" and author "you".
- **Favicon**: still Vite default (`vite.svg`).
- **Accessibility**: 9 of 11 `ActionIcon` components lack `aria-label`.

### Key Discoveries:

- Streak data is `HabitStatus.streak: number` — no mood/emotion field exists. Mapping must be frontend-only.
- `StreakHero` uses Framer Motion springs — speech bubble animation fits naturally.
- Tauri 2 includes `tauri::menu::*` in core crate — no new dependency needed for native menu bar.
- `PredefinedMenuItem::about()` available from same module `tray.rs` already uses.
- `__root.tsx` has no error boundary; TanStack Router supports `errorComponent` on `createRootRoute`.
- MantineProvider at `__root.tsx:58` has no `defaultColorScheme` prop.

## Desired End State

- Pauzaro mascot (PNG images) replaces all dinosaur emoji throughout the app.
- Side nav top icon shows streak-reactive mascot image (5-tier: sad/promising/happy/successful/successful+glow, freeze override).
- StreakHero shows mascot image where Flame was, with animated speech bubble popping from mascot's head containing the streak message. Streak number + "day streak" label below.
- Onboarding wizard shows mascot images with speech bubble UI. Mascot introduces itself as "Pauzaro". Copy rewritten to be app-specific and playful.
- App displays as "Pauzaro" (capitalized) everywhere — window title, menu bar, About dialog, bundle name.
- Native macOS menu bar with Edit menu (Cmd+C/V/X/Z/A), standard window shortcuts (Cmd+Q/W/H/M), and About Pauzaro dialog.
- Global React error boundary catches render crashes with friendly fallback UI.
- Proper favicon, copyright, app category, version in settings.
- All ActionIcons have aria-labels. Explicit light color scheme.

## What We're NOT Doing

- AI-generated dynamic mascot emotions — static PNG images only
- Dark mode support — force light mode explicitly
- Custom About dialog with mascot — using native macOS About
- Mascot in overlay popup — only onboarding, side nav, StreakHero
- New mascot assets — using existing 5 PNGs + icon.png
- Lottie animations — Framer Motion CSS transforms only

## Implementation Approach

Five phases in dependency order: shared mascot infrastructure first, then three integration points (side nav, StreakHero, onboarding), then polish. Each phase is independently testable.

## Phase 1: Mascot Foundation

### Overview

Create shared components and utilities for mascot display: image component, streak-to-reaction mapping, and reusable speech bubble with animation.

### Changes Required:

#### 1. Rename typo file

**File**: `src/assets/pauzaro-reactions/promissing.png` → `src/assets/pauzaro-reactions/promising.png`

**Intent**: Fix typo before any code references this filename.

**Contract**: Git rename only. No code references exist yet.

#### 2. Streak-to-reaction mapping utility

**File**: `src/lib/mascot.ts` (new)

**Intent**: Pure function mapping streak number + freeze status to a mascot reaction identifier. Single source of truth for the 5-tier system.

**Contract**:

```ts
type MascotReaction = "sad" | "promising" | "happy" | "successful" | "successful-glow" | "freeze";

interface MascotState {
  streak: number;
  isFrozen: boolean;
}

function getMascotReaction(state: MascotState): MascotReaction;
```

Thresholds: `isFrozen` → `"freeze"`, streak 0 → `"sad"`, 1-2 → `"promising"`, 3-6 → `"happy"`, 7-13 → `"successful"`, 14+ → `"successful-glow"`. Freeze takes precedence over streak tier.

#### 3. MascotImage component

**File**: `src/components/shared/MascotImage.tsx` (new)

**Intent**: Shared component rendering the correct mascot PNG for a given reaction. Handles image import mapping and sizing. Used by side nav, StreakHero, and onboarding.

**Contract**:

```ts
interface MascotImageProps {
  reaction: MascotReaction;
  size?: number;
  className?: string;
}
```

Maps reaction to Vite-imported PNG: `"sad"` → `sad.png`, `"promising"` → `promising.png`, `"happy"` → `happy.png`, `"successful"` / `"successful-glow"` → `successful.png`, `"freeze"` → `freeze.png`. The `"successful-glow"` variant renders `successful.png` with a CSS glow/shimmer effect (box-shadow or filter) to differentiate from plain `"successful"`.

#### 4. SpeechBubble component

**File**: `src/components/shared/SpeechBubble.tsx` (new)

**Intent**: Animated speech bubble that pops from a mascot's head. Used in StreakHero and onboarding. Kid-friendly animation style — bouncy spring with overshoot.

**Contract**:

```ts
interface SpeechBubbleProps {
  message: string;
  visible: boolean;
  direction?: "left" | "right" | "top";
}
```

Uses Framer Motion `AnimatePresence` + `motion.div`. Animation: scale from 0 to 1 with spring (`stiffness: 400, damping: 12`) and slight rotation wobble. Speech bubble tail (CSS triangle) points toward mascot. Warm styling: rounded corners, `sand` background from theme, playful shadow.

#### 5. Unit tests for mascot utility

**File**: `src/lib/mascot.test.ts` (new)

**Intent**: Test all 5 tier boundaries and freeze override.

**Contract**: Test cases for streak values 0, 1, 2, 3, 6, 7, 13, 14, 100 and freeze=true scenarios.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Unit tests pass: `pnpm test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- MascotImage renders each of the 5 reactions correctly in isolation (Storybook or dev test)
- SpeechBubble animation feels bouncy and kid-friendly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Side Nav Mascot

### Overview

Replace the 🦕 emoji in AppNavbar with a streak-reactive MascotImage. Requires threading streak/freeze state into the navbar.

### Changes Required:

#### 1. Pass mascot state to AppNavbar

**File**: `src/components/layout/AppNavbar.tsx`

**Intent**: Accept streak and freeze status as props so the mascot image reflects current streak state.

**Contract**: Add `streak: number` and `isFrozen: boolean` to `AppNavbarProps` interface. Replace the `<span style={{ fontSize: 24 }}>🦕</span>` at line 48 with `<MascotImage reaction={getMascotReaction({ streak, isFrozen })} size={32} />`. Add `aria-label="Pauzaro mascot"` to the wrapping ActionIcon.

#### 2. Thread streak state from Dashboard parent

**File**: `src/routes/__root.tsx` (or wherever AppNavbar is called with props)

**Intent**: Provide streak data from the dashboard-level habit status to AppNavbar.

**Contract**: The `AppShellLayout` component in `__root.tsx` renders `<AppNavbar>` at line 134. Streak state lives in Dashboard's local state (`habitStatuses` at `Dashboard.tsx:131`). Since AppNavbar lives above Dashboard in the component tree (in the root layout), the active habit's streak needs to be lifted. Options: (a) fetch active habit status in root layout via invoke, or (b) create a lightweight Zustand store slice for "active mascot state" that Dashboard updates. Approach (b) preferred — add `mascotStreak: number` and `mascotFrozen: boolean` to an existing store (dashboard store at `src/stores/dashboard.ts`), updated whenever `habitStatuses` refreshes in Dashboard.

#### 3. Update dashboard store

**File**: `src/stores/dashboard.ts`

**Intent**: Add mascot state fields so AppNavbar can subscribe without prop drilling through the layout.

**Contract**: Add `mascotStreak: number`, `mascotFrozen: boolean`, and `setMascotState(streak: number, isFrozen: boolean): void` to the store. Dashboard calls `setMascotState` whenever `habitStatuses` updates for the active habit.

#### 4. Wire store in Dashboard

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Update mascot state in store whenever active habit status changes.

**Contract**: After computing `streak` and `freezesRemaining` (line 286-289), call `setMascotState(streak, frozenDates.length > 0)` (or derive frozen from whether today's date is in `frozenDates`). Use `useEffect` to sync when `status` or `activeHabit` changes.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Existing tests pass: `pnpm test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Side nav top icon shows correct mascot reaction matching current streak
- Mascot changes when switching between habits with different streak counts
- Mascot shows freeze image when active habit has freeze active
- Image renders crisp at 32px, no layout shift

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: StreakHero Redesign

### Overview

Replace the Flame icon with mascot image + animated speech bubble. Keep streak number + "day streak" label. Speech bubble animates on view entry.

### Changes Required:

#### 1. Redesign StreakHero component

**File**: `src/components/dashboard/StreakHero.tsx`

**Intent**: Replace Flame icon with MascotImage showing streak-reactive reaction. Add animated SpeechBubble containing the streak message (from existing `getStreakMessage`). Keep the streak number prominently displayed with "day streak" label below it. Freeze slot display (❄️ indicators) stays.

**Contract**: New props: add `isFrozen: boolean` alongside existing `streak` and `freezesRemaining`. Layout (top to bottom): MascotImage (size ~64-80), SpeechBubble with `getStreakMessage(streak)`, streak number (`<Title order={1} fz={56}>`), "day streak" label (`<Text>`), freeze slots. Remove `Flame` import from lucide-react.

Animation: SpeechBubble `visible` prop controlled by a state that triggers on mount. Use `useEffect` with a short delay (~300ms) so bubble appears after mascot image animates in. The existing spring animation on the outer `motion.div` stays. Bubble animation should feel like it "pops" out of the mascot — `direction="top"` on SpeechBubble, positioned relative to mascot image.

The speech bubble should also re-trigger when the user switches habits (new streak value). Track previous streak in a ref; when streak changes, toggle bubble visibility to re-trigger the entrance animation.

#### 2. Update Dashboard to pass frozen state

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Pass `isFrozen` prop to StreakHero.

**Contract**: At the StreakHero callsite (line 367), add `isFrozen={frozenDates.includes(todayDate)}` or similar logic using existing `frozenDates` array and `today_date` from status.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Existing tests pass: `pnpm test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Mascot image displays correct reaction for current streak tier
- Speech bubble animates in with bouncy kid-like animation on dashboard load
- Speech bubble re-triggers when switching between habits
- Streak number and "day streak" label clearly visible below mascot
- Freeze indicators still display correctly
- Layout doesn't break at minimum window size (600x400)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Onboarding Redesign

### Overview

Replace all emoji with mascot images and implement speech bubble UI where mascot "Pauzaro" guides the user through onboarding conversationally.

### Changes Required:

#### 1. WelcomeStep redesign

**File**: `src/components/onboarding/WelcomeStep.tsx`

**Intent**: Replace 🦕 emoji with `happy.png` mascot image. Mascot introduces itself via speech bubble as "Pauzaro". Rewrite copy to be app-specific.

**Contract**: Replace `<span>🦕</span>` (line 36-37) with `<MascotImage reaction="happy" size={120} />`. Add `<SpeechBubble>` below mascot with introduction text. New copy direction:
- Speech bubble: "Hi! I'm Pauzaro! 🦕"
- Title: "Your break-time buddy"
- Body: "I'll remind you to stretch, move, and rest while you code. Together we'll build healthy habits — and I'll cheer you on with every streak!"
- Button: "Let's go! 🚀" (keep)

#### 2. NameStep redesign

**File**: `src/components/onboarding/NameStep.tsx`

**Intent**: Replace `🦕💬` emoji header with mascot image + speech bubble asking for name.

**Contract**: Replace emoji at line 62 with `<MascotImage reaction="happy" size={80} />` + `<SpeechBubble message="What's your name? I want to know who I'm cheering for!" />`. Keep text input and submit logic unchanged. Subtitle/title can simplify since speech bubble carries the copy.

#### 3. HabitDetailsStep redesign

**File**: `src/components/onboarding/HabitDetailsStep.tsx`

**Intent**: Replace `✨🦕` emoji header with mascot + speech bubble about creating first habit.

**Contract**: Replace emoji at line 61 with `<MascotImage reaction="promising" size={80} />` + `<SpeechBubble message="Let's create your first habit! Pick something fun — I'll make sure you stick with it! ✨" />`. Keep form fields (name, description, icon picker) unchanged.

#### 4. ScheduleStep redesign

**File**: `src/components/onboarding/ScheduleStep.tsx`

**Intent**: Replace `📅🦕` emoji header with mascot + speech bubble about scheduling.

**Contract**: Replace emoji at line 104 with `<MascotImage reaction="happy" size={80} />` + `<SpeechBubble message="Almost there! Tell me when to nudge you — I promise I'll be on time! 📅" />`. Keep SchedulePicker, date inputs, and submit logic unchanged.

#### 5. Update onboarding test

**File**: `src/components/onboarding/OnboardingWizard.test.tsx`

**Intent**: Update test assertions that may reference removed emoji text or changed copy.

**Contract**: Update `getByText` matchers to reflect new copy. Ensure step navigation still works. Add check that MascotImage renders on welcome step.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Onboarding tests pass: `pnpm test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Each onboarding step shows mascot image (not emoji)
- Speech bubbles animate in on each step transition
- Copy reads naturally as Pauzaro "speaking"
- Mascot images render crisp, centered, and proportional
- Full onboarding flow completes successfully (creates user profile + habit)
- Layout works at minimum window size

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: First-Release Polish

### Overview

Capitalize app name, add native macOS menu bar with standard shortcuts and About dialog, add error boundary, fix favicon, add metadata, accessibility labels, force light color scheme, show version in settings.

### Changes Required:

#### 1. Capitalize productName and window title

**File**: `src-tauri/tauri.conf.json`

**Intent**: App displays as "Pauzaro" in macOS menu bar, Finder, Dock, and window title bar.

**Contract**: Change `productName` (line 3) from `"pauzaro"` to `"Pauzaro"`. Change window `title` (line 15) from `"pauzaro"` to `"Pauzaro"`.

#### 2. Add macOS bundle metadata

**File**: `src-tauri/tauri.conf.json`

**Intent**: Proper app metadata for macOS bundle — category, copyright, short description, minimum system version.

**Contract**: Add `macOS` section inside `bundle`:

```json
"macOS": {
  "minimumSystemVersion": "10.15"
}
```

Add top-level bundle fields:

```json
"copyright": "© 2026 Nondescript Studio",
"category": "DeveloperTool",
"shortDescription": "Your friendly break reminder for developers"
```

#### 3. Fix Cargo.toml placeholders

**File**: `src-tauri/Cargo.toml`

**Intent**: Replace placeholder description and author with real values.

**Contract**: Change `description = "A Tauri App"` to `description = "Desktop habit-tracking app that reminds developers to take breaks"`. Change `authors = ["you"]` to `authors = ["Nondescript Studio"]`.

#### 4. Add native macOS menu bar

**File**: `src-tauri/src/lib.rs`

**Intent**: Add standard macOS application menu bar with app menu (About + Quit), Edit menu (Undo/Redo/Cut/Copy/Paste/Select All), and Window menu (Minimize/Zoom/Close).

**Contract**: Build menu using `tauri::menu::MenuBuilder` inside `.setup()`. Use `PredefinedMenuItem` for standard items: `about` (with app name "Pauzaro"), `quit`, `undo`, `redo`, `cut`, `copy`, `paste`, `select_all`, `minimize`, `close_window`, `hide`, `separator`. Set menu on app with `app.set_menu(menu)`. Structure: App menu (About Pauzaro, separator, Hide, separator, Quit Pauzaro), Edit menu (Undo, Redo, separator, Cut, Copy, Paste, Select All), Window menu (Minimize, Zoom, separator, Close).

#### 5. Add React error boundary

**File**: `src/components/shared/ErrorBoundary.tsx` (new)

**Intent**: Catch render crashes app-wide with a friendly fallback instead of white screen.

**Contract**: Class component implementing `componentDidCatch` and `getDerivedStateFromError`. Fallback UI: centered layout with sad mascot image (`<MascotImage reaction="sad" />`), "Oops! Something went wrong" heading, "Try restarting the app" message, and a "Reload" button that calls `window.location.reload()`. Log error to console with structured format.

#### 6. Wire error boundary in root

**File**: `src/routes/__root.tsx`

**Intent**: Wrap app content with error boundary so any render crash shows fallback.

**Contract**: Wrap `<MantineProvider>` content (both overlay and main branches) with `<ErrorBoundary>`. Also add `errorComponent` to `createRootRoute` config for TanStack Router-level errors.

#### 7. Force light color scheme

**File**: `src/routes/__root.tsx`

**Intent**: Prevent dark mode system preference from breaking hardcoded light backgrounds.

**Contract**: Add `defaultColorScheme="light"` to both `<MantineProvider>` instances (lines 49 and 58). Import `ColorSchemeScript` from `@mantine/core` if needed for SSR safety (not needed for Tauri SPA, but `defaultColorScheme` prop alone suffices).

#### 8. Fix favicon

**File**: `index.html`

**Intent**: Replace Vite default favicon with Pauzaro app icon.

**Contract**: Change line 5 from `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` to `<link rel="icon" type="image/png" href="/src/assets/icon.png" />`. Vite resolves `src/assets/` imports at build time.

#### 9. Remove leftover default files

**Files**: `public/vite.svg`, `public/tauri.svg`

**Intent**: Clean up scaffolding artifacts that shipped with Tauri/Vite template.

**Contract**: Delete both files. Verify no other references exist (grep confirms none).

#### 10. Add aria-labels to ActionIcons

**File**: `src/components/layout/AppNavbar.tsx`

**Intent**: All icon-only buttons accessible to screen readers.

**Contract**: Add `aria-label` to every `ActionIcon`:
- Mascot icon (line 42): `aria-label="Pauzaro mascot"`
- Habit buttons (line 64): `aria-label={habit.name}`
- Create habit (line 92): `aria-label="Create habit"`
- Debug (line 122): `aria-label="Debug panel"`
- Settings (line 139): `aria-label="Settings"`

**File**: `src/components/shared/SchedulePicker.tsx`

**Intent**: Remove time slot button needs label.

**Contract**: Add `aria-label="Remove time slot"` to the ActionIcon at line 162.

**File**: `src/components/dashboard/TodayStatus.tsx`

**Intent**: Override button needs label.

**Contract**: Add `aria-label="Mark as done"` to the ActionIcon at line 31.

**File**: `src/components/dashboard/HabitMenu.tsx`

**Intent**: More options trigger needs label.

**Contract**: Add `aria-label="More options"` to the ActionIcon at line 25.

#### 11. Version display in Settings

**File**: `src/components/settings/SettingsView.tsx`

**Intent**: Show app version at bottom of settings screen for user reference and support.

**Contract**: Use `import { getVersion } from "@tauri-apps/api/app"` to fetch version string. Display as `<Text size="xs" c="dimmed" ta="center">Pauzaro v{version}</Text>` at bottom of the settings Stack. Fetch version in `useEffect` on mount; fallback to empty string if call fails.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- All tests pass: `pnpm test`
- Lint passes: `pnpm lint`
- Rust check passes: `cd src-tauri && cargo check`

#### Manual Verification:

- Window title bar shows "Pauzaro" (capitalized)
- macOS menu bar shows "Pauzaro" with About, Edit, and Window menus
- Cmd+C/V/X/Z/A work in text inputs
- Cmd+Q quits app, Cmd+W closes window, Cmd+H hides
- About Pauzaro shows app icon, name, version, copyright
- Error boundary: temporarily throw in a component, see friendly fallback instead of white screen
- Favicon shows Pauzaro icon (not Vite logo) in dev tools
- Settings shows "Pauzaro v0.1.0" at bottom
- All ActionIcon buttons announce their label via VoiceOver
- App does not switch to dark mode when macOS is in dark mode

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/mascot.test.ts`: all 5 tier boundaries (0, 1, 2, 3, 6, 7, 13, 14, 100), freeze override at each tier
- Onboarding wizard test updates for new copy
- Error boundary test: component that throws → fallback renders

### Integration Tests:

- Side nav renders MascotImage (not emoji) when streak data available
- StreakHero renders mascot + speech bubble with correct message for streak value
- Full onboarding flow still creates profile + habit after redesign

### Manual Testing Steps:

1. Fresh onboarding: verify mascot images on all 4 steps, speech bubbles animate, complete flow
2. Dashboard: verify StreakHero shows correct mascot for current streak, bubble animates on load
3. Switch habits: verify both side nav and StreakHero mascot update
4. Streak at 0: sad mascot in nav + StreakHero
5. Active freeze: freeze mascot in nav + StreakHero
6. macOS menu bar: test all Edit shortcuts in text inputs, About dialog, Quit
7. Error boundary: inject a throw, verify fallback
8. Minimum window size (600x400): verify layout doesn't break

## Performance Considerations

- Mascot PNGs are 48-84 KB each — small, but import all at module level to avoid per-render dynamic imports
- SpeechBubble animation uses CSS transforms only (GPU-accelerated) — no layout thrashing
- `getMascotReaction` is a pure function with simple conditionals — negligible cost
- Dashboard store subscription for mascot state uses primitive selectors (`mascotStreak`, `mascotFrozen`) to avoid unnecessary re-renders of AppNavbar

## References

- Mascot assets: `src/assets/pauzaro-reactions/`
- App icon: `src/assets/icon.png`
- Existing animations pattern: `src/components/dashboard/StreakHero.tsx` (Framer Motion springs)
- Tauri menu API: `tauri::menu::MenuBuilder`, `PredefinedMenuItem` (already used in `src-tauri/src/tray.rs`)
- Mantine theme: `src/theme.ts`
- Roadmap item: S-05 in `context/foundation/roadmap.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mascot Foundation

#### Automated

- [x] 1.1 Type checking passes — a6a7e29
- [x] 1.2 Unit tests pass (including mascot utility tests) — a6a7e29
- [x] 1.3 Lint passes — a6a7e29

#### Manual

- [x] 1.4 MascotImage renders all 5 reactions correctly — a6a7e29
- [x] 1.5 SpeechBubble animation feels bouncy and kid-friendly — a6a7e29

### Phase 2: Side Nav Mascot

#### Automated

- [x] 2.1 Type checking passes — a061c3f
- [x] 2.2 Existing tests pass — a061c3f
- [x] 2.3 Lint passes — a061c3f

#### Manual

- [ ] 2.4 Side nav shows correct mascot reaction for current streak
- [ ] 2.5 Mascot changes when switching habits
- [ ] 2.6 Freeze image shows when freeze active
- [ ] 2.7 Image renders crisp at 32px, no layout shift

### Phase 3: StreakHero Redesign

#### Automated

- [x] 3.1 Type checking passes — 06f0bdd
- [x] 3.2 Existing tests pass — 06f0bdd
- [x] 3.3 Lint passes — 06f0bdd

#### Manual

- [ ] 3.4 Mascot image shows correct reaction for streak tier
- [ ] 3.5 Speech bubble animates in on dashboard load
- [ ] 3.6 Speech bubble re-triggers on habit switch
- [ ] 3.7 Streak number and "day streak" label visible
- [ ] 3.8 Layout works at minimum window size

### Phase 4: Onboarding Redesign

#### Automated

- [x] 4.1 Type checking passes
- [x] 4.2 Onboarding tests pass
- [x] 4.3 Lint passes

#### Manual

- [ ] 4.4 Each step shows mascot image (not emoji)
- [ ] 4.5 Speech bubbles animate on step transitions
- [ ] 4.6 Copy reads naturally as Pauzaro speaking
- [ ] 4.7 Full onboarding flow completes (creates profile + habit)
- [ ] 4.8 Layout works at minimum window size

### Phase 5: First-Release Polish

#### Automated

- [ ] 5.1 Type checking passes
- [ ] 5.2 All tests pass
- [ ] 5.3 Lint passes
- [ ] 5.4 Rust check passes

#### Manual

- [ ] 5.5 Window title shows "Pauzaro" (capitalized)
- [ ] 5.6 macOS menu bar functional (About, Edit shortcuts, Window)
- [ ] 5.7 Cmd+C/V/X/Z/A work in text inputs
- [ ] 5.8 Cmd+Q quits, Cmd+W closes, Cmd+H hides
- [ ] 5.9 About dialog shows icon, name, version, copyright
- [ ] 5.10 Error boundary shows friendly fallback on crash
- [ ] 5.11 Favicon shows Pauzaro icon
- [ ] 5.12 Settings shows version at bottom
- [ ] 5.13 ActionIcons announce labels via VoiceOver
- [ ] 5.14 App stays in light mode when macOS is dark
