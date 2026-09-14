# Final Touches — Plan Brief

> Full plan: `context/changes/final-touches/plan.md`

## What & Why

Five independent polish items for the Pauzaro desktop app: adjust default window height to 660px, standardise dashboard tiles to a persistent 2-column grid, move freeze counter info from StreakHero icons into stat tiles (fraction format), capitalise the app name in the macOS Dock, and fix the tray-restore bug that shows a generic "exec" icon instead of the Pauzaro icon.

## Starting Point

- Main window defaults to 600px height (`tauri.conf.json`)
- MonthStats tiles switch between 1-column and 2-column based on whether an end date exists
- Freeze counters shown as two ❄️ emoji icons below "day streak" in StreakHero
- `Cargo.toml` crate name is lowercase `pauzaro`, causing generated `Info.plist` to use lowercase display name
- `show_main_window()` in `tray.rs` toggles activation policy without restoring the dock icon — macOS doesn't do this automatically

## Desired End State

Dashboard tiles always in a clean 2-column grid with a "Freezes left" tile showing "X/2". Dock reads "Pauzaro". Tray restore shows the correct app icon. Window opens taller for better content fit.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Odd tile count layout | Orphan tile at half-width | Consistent grid, no special casing needed. |
| Freeze tile format | Fraction "X/2" | Shows both remaining and total — more context than a single number. |
| Freeze tile visibility | Always show | Consistent layout, user always knows about the feature. |
| App name fix approach | Custom `src-tauri/Info.plist` | Clean separation — crate name stays lowercase per Rust convention, display name overridden in plist. |

## Scope

**In scope:**
- Default window height 600 → 660
- MonthStats always 2-column grid
- Freeze counter tile (fraction format, always visible)
- Remove ❄️ icons from StreakHero
- Remove "Days frozen" conditional tile (replaced by "Freezes left" tile)
- Custom Info.plist for capitalised macOS Dock name
- Explicit dock icon restore after activation policy change

**Out of scope:**
- Cargo.toml crate name change
- Windows-specific icon fixes
- Tile styling/animation changes
- New tests for config/plist changes

## Architecture / Approach

Three independent phases: config changes (tauri.conf.json + Info.plist), frontend tile refactor (MonthStats + StreakHero + Dashboard prop wiring), and a Rust-level dock icon fix (objc2 crates for `NSApplication.setApplicationIconImage()`). Each phase is independently deployable and testable.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Config Quick Wins | Window height 660 + capitalised app name in Dock | None — pure config, but needs `pnpm tauri build` to verify plist merge |
| 2. Dashboard Tile Refactor | Always 2-col grid + freeze tile + hero cleanup | Low — prop re-wiring across 3 files, ensure no type errors |
| 3. Tray Dock Icon Fix | Correct Pauzaro icon restored in Dock after tray show | Medium — new Rust dependencies, unsafe macOS API call, needs release build to verify |

**Prerequisites:** None beyond current codebase
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- `objc2-app-kit` 0.3 API for `NSData::with_bytes` and `NSImage::initWithData` — exact signatures should be verified against crate docs during implementation
- The `default_window_icon()` returns PNG-encoded bytes (Tauri feature `image-png` is enabled) — assumed compatible with `NSImage::initWithData`
- Info.plist merge behaviour confirmed in Tauri codegen source but not yet tested in this project

## Success Criteria (Summary)

- Dock shows "Pauzaro" (capitalised) in both fresh launch and tray-restore scenarios
- Dashboard tiles always in 2 columns with a visible "Freezes left" tile
- No ❄️ icons below "day streak" in StreakHero
