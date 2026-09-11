# Dinosaur Mascot — Manual Testing Handoff

All 5 phases implemented and committed. Run `pnpm tauri dev` to test.

## Phase 1: Mascot Foundation

- [x] **1.4** MascotImage renders all 5 reactions correctly (sad, promising, happy, successful, successful-glow)
- [x] **1.5** SpeechBubble animation feels bouncy and kid-friendly

> Open dashboard, use debug panel to change streak values and verify each tier renders the correct PNG. Check that `successful-glow` has a visible CSS glow effect vs plain `successful`.

## Phase 2: Side Nav Mascot

- [x] **2.4** Side nav shows correct mascot reaction for current streak
- [x] **2.5** Mascot changes when switching between habits with different streaks
- [x] **2.6** Freeze image shows when active habit has a freeze active
- [x] **2.7** Image renders crisp at 32px, no layout shift

> Create multiple habits with different streak counts. Click between them in the side nav — top mascot icon should update each time. Activate a freeze and confirm the freeze mascot appears.

## Phase 3: StreakHero Redesign

- [x] **3.4** Mascot image shows correct reaction for current streak tier
- [x] **3.5** Speech bubble animates in with bouncy animation on dashboard load
- [x] **3.6** Speech bubble re-triggers when switching between habits
- [x] **3.7** Streak number and "day streak" label clearly visible below mascot
- [x] **3.8** Layout doesn't break at minimum window size (600×400)

> Load dashboard — speech bubble should pop in after ~300ms. Switch habits and confirm bubble re-animates. Resize window to 600×400, verify nothing overflows.

## Phase 4: Onboarding Redesign

- [x] **4.4** Each onboarding step shows mascot image (not emoji)
- [x] **4.5** Speech bubbles animate on step transitions
- [x] **4.6** Copy reads naturally as Pauzaro "speaking"
- [x] **4.7** Full onboarding flow completes successfully (creates user profile + habit)
- [x] **4.8** Layout works at minimum window size

> Reset app data to trigger onboarding. Walk through all 4 steps (Welcome → Name → Habit Details → Schedule). Confirm mascot PNG appears on each, no leftover 🦕 emoji. Complete flow and verify habit is created.

## Phase 5: First-Release Polish

- [x] **5.5** Window title bar shows "Pauzaro" (capitalized)
- [x] **5.6** macOS menu bar shows "Pauzaro" with About, Edit, and Window menus
- [x] **5.7** Cmd+C / Cmd+V / Cmd+X / Cmd+Z / Cmd+A work in text inputs
- [x] **5.8** Cmd+Q quits app, Cmd+W closes window, Cmd+H hides
- [x] **5.9** About Pauzaro dialog shows app icon, name, version, copyright
- [x] **5.10** Error boundary: temporarily throw in a component → friendly fallback with sad mascot appears (not white screen)
- [x] **5.11** Favicon shows Pauzaro icon in dev tools (not Vite logo)
- [x] **5.12** Settings page shows "Pauzaro v0.1.0" at bottom
- [x] **5.13** All ActionIcon buttons announce their label via VoiceOver (mascot, habit names, create, debug, settings, remove time slot, mark done, more options)
- [x] **5.14** App stays in light mode when macOS system is set to dark mode

> For error boundary test: add `throw new Error("test")` in any component render, confirm sad mascot fallback. Remove after. For VoiceOver: enable it via System Settings → Accessibility, tab through icon buttons.

## Commits

| Phase | SHA | Message |
|-------|-----|---------|
| 1 | `a6a7e29` | Mascot Foundation |
| 2 | `a061c3f` | Side Nav Mascot |
| 3 | `06f0bdd` | StreakHero Redesign |
| 4 | `09f6d5f` | Onboarding Redesign |
| 5 | `32b2c3c` | First-Release Polish |
| Epilogue | `201b4eb` | Close out plan |
