# Final Touches — Manual Verification Handoff

> Change: `final-touches`
> Plan: `context/changes/final-touches/plan.md`
> Status: `implemented` — all automated checks pass, manual verification pending

## Commits

| Phase | SHA | Description |
|-------|-----|-------------|
| 1 | `ab5b427` | Config quick wins — window height 660, Info.plist for capitalised app name |
| 2 | `857fc8a` | Dashboard tile refactor — always 2-col grid, freeze tile, hero cleanup |
| 3 | `921c1b9` | Tray dock icon fix — objc2 deps, explicit icon restore |

## Automated Verification (all passing)

- `tsc --noEmit` — clean
- `pnpm lint` (biome) — 67 files checked, no errors
- `pnpm test` (vitest) — 10 files, 75 tests passed
- `cargo check` — clean
- `cargo test` — 90 tests passed

## Manual Verification Checklist

### Phase 1: Config Quick Wins

- [ ] Run `pnpm tauri build` — build succeeds
- [ ] Inspect `.app/Contents/Info.plist` — `CFBundleDisplayName` = "Pauzaro", `CFBundleName` = "Pauzaro"
- [ ] App name in macOS Dock shows "Pauzaro" (capital P)
- [ ] Main window opens at 660px height (visibly taller than before)

### Phase 2: Dashboard Tile Refactor

- [ ] Dashboard tiles always in 2 columns (test with habit that has no end date)
- [ ] Dashboard tiles still 2 columns with end date set (switch to/create habit with end date)
- [ ] "Freezes left" tile shows fraction (e.g. "2/2") with snowflake icon
- [ ] "Freezes left" tile visible even when all freezes available (2/2)
- [ ] No ❄️ snowflake icons below "day streak" in StreakHero section
- [ ] Layout looks balanced with 3 tiles (no end date: practiced, streak, freezes) and 4 tiles (with end date: + days left)

### Phase 3: Tray Dock Icon Fix

- [ ] Launch app — Dock shows Pauzaro icon (baseline)
- [ ] Close app (X button) — app hides to tray, Dock icon disappears
- [ ] Click "Show Dashboard" in tray menu — Dock shows Pauzaro icon (NOT generic "exec" icon)
- [ ] Left-click tray icon directly — same correct Pauzaro icon in Dock
- [ ] Repeat close→show cycle 3 times — icon consistently correct each time

## Known Limitations

- The dock icon fix uses `NSImage::imageNamed(NSImageNameApplicationIcon)` which loads from the app bundle — this only works in release/bundled builds, not `pnpm tauri dev` (dev mode uses Tauri's own dev-only icon setter)
- The `objc2-app-kit` and `objc2-foundation` deps are macOS-only (`cfg(target_os = "macos")`) — no impact on other platforms

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Window height 600 → 660 |
| `src-tauri/Info.plist` | New — CFBundleDisplayName/CFBundleName override |
| `src-tauri/Cargo.toml` | Added objc2-app-kit, objc2-foundation (macOS-only) |
| `src-tauri/Cargo.lock` | Updated with new deps |
| `src-tauri/src/tray.rs` | Dock icon restore in show_main_window() |
| `src/components/dashboard/MonthStats.tsx` | Always 2-col grid, freeze tile, removed frozen-days tile |
| `src/components/dashboard/StreakHero.tsx` | Removed freeze snowflake icons and freezesRemaining prop |
| `src/components/dashboard/Dashboard.tsx` | Rewired props (freeze to MonthStats, removed from StreakHero) |
