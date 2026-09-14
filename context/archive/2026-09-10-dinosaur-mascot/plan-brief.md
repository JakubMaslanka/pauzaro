# Pauzaro Mascot Integration + First-Release Polish — Plan Brief

> Full plan: `context/changes/dinosaur-mascot/plan.md`

## What & Why

Integrate the Pauzaro dinosaur mascot (5 static PNG reaction images) into the app's side nav, StreakHero, and onboarding flow — replacing placeholder emoji with branded, streak-reactive mascot visuals and animated speech bubbles. Simultaneously polish the app for first macOS release: proper naming, native menu bar, error boundary, accessibility, and bundle metadata.

## Starting Point

- Side nav and onboarding use 🦕 emoji — no actual mascot images integrated
- 5 mascot PNGs exist in `src/assets/pauzaro-reactions/` (unused) + `icon.png` (unused)
- StreakHero shows a lucide Flame icon with streak number
- No native macOS menu bar (Cmd+C/V broken), no About dialog, no error boundary
- `productName` in Tauri config is lowercase "pauzaro"
- Placeholder metadata in Cargo.toml, Vite favicon still present

## Desired End State

Pauzaro mascot is the visual identity throughout — a streak-reactive dinosaur image in the side nav, an animated mascot with speech bubble in StreakHero, and a conversational speech-bubble onboarding where the mascot introduces itself by name. The app ships as "Pauzaro" with a proper macOS menu bar, error boundary, accessibility labels, and correct metadata.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Streak-to-mascot mapping | 5-tier: sad/promising/happy/successful/glow | Uses all 5 assets with natural progression matching StreakHero messages | Plan |
| Freeze handling | Freeze image overrides streak tier | Freeze is a distinct state worth distinct visual feedback | Plan |
| Onboarding style | Speech bubble UI with named mascot "Pauzaro" | Duolingo-like conversational feel, maximum personality | Plan |
| Mascot placement | Onboarding + side nav + StreakHero | Visible at every key interaction point without touching overlay | Plan |
| StreakHero layout | Mascot replaces Flame, animated speech bubble pops from head | Kid-like animation reinforces playful brand; streak number + label stay | Plan |
| Polish scope | Full pass (menu, error boundary, a11y, color scheme, version) | Ship-ready quality for first macOS release | Plan |
| About dialog | Standard native macOS PredefinedMenuItem::about | Minimal work, standard macOS UX | Plan |
| Typo fix | Rename promissing.png → promising.png | Fix before any code references the file | Plan |

## Scope

**In scope:**
- Shared MascotImage and SpeechBubble components
- Streak-to-reaction mapping utility with tests
- Side nav: mascot image replacing emoji, streak-reactive
- StreakHero: mascot + animated speech bubble replacing Flame icon
- Onboarding: mascot images + speech bubbles on all 4 steps, new copy
- productName/title capitalization
- Native macOS menu bar (Edit, Window, About)
- React error boundary
- Favicon, copyright, category, description, Cargo.toml metadata
- aria-labels on all ActionIcons
- Force light color scheme
- Version display in Settings

**Out of scope:**
- AI-generated dynamic mascot emotions
- Dark mode support
- Custom About dialog with mascot
- Mascot in overlay popup
- New mascot assets / Lottie animations

## Architecture / Approach

Three shared components form the foundation: `MascotImage` (renders streak-reactive PNG), `SpeechBubble` (Framer Motion animated bubble), and `getMascotReaction()` (pure mapping function). These compose into three integration points: side nav icon (32px, store-driven), StreakHero (64-80px + animated bubble), and onboarding wizard (80-120px + static bubbles). A small Zustand store addition (`mascotStreak`/`mascotFrozen` in dashboard store) bridges Dashboard state to the root-level AppNavbar. Polish changes are mechanical: Tauri config edits, a native menu built with existing `tauri::menu` APIs, and standard React/Mantine patterns.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Mascot Foundation | Shared components + mapping utility + tests | SpeechBubble animation feel — subjective "kid-friendly" bar |
| 2. Side Nav Mascot | Streak-reactive mascot in navbar | Zustand store wiring between Dashboard and root layout |
| 3. StreakHero Redesign | Mascot + animated bubble replacing Flame | Layout balance with larger mascot image + bubble + number |
| 4. Onboarding Redesign | Full speech bubble onboarding with Pauzaro personality | Copy quality — must feel conversational, not corporate |
| 5. First-Release Polish | macOS menu, error boundary, a11y, metadata, naming | Menu bar keyboard shortcuts interacting with tray close-to-hide behavior |

**Prerequisites:** Mascot PNG assets in `src/assets/pauzaro-reactions/` (already present)
**Estimated effort:** ~3-4 sessions across 5 phases

## Open Risks & Assumptions

- Speech bubble animation "feel" is subjective — may need iteration after Phase 1 manual check
- macOS menu Cmd+Q vs close-to-tray: need to decide if Cmd+Q actually quits or hides (plan assumes quit)
- `successful-glow` effect (14+ streak) is CSS-only shimmer on `successful.png` — may not be visually distinct enough

## Success Criteria (Summary)

- Pauzaro mascot visible and streak-reactive in side nav, StreakHero, and onboarding (no emoji remaining)
- Speech bubbles animate with bouncy, kid-friendly motion on view entry
- App runs as "Pauzaro" with functional macOS menu bar (Edit shortcuts, About, Quit) and no white-screen crash on errors
