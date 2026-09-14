# Final Touches — Implementation Plan

## Overview

Five independent polish items to tighten the Pauzaro desktop experience before release: adjust window height, standardise dashboard tile layout to a consistent 2-column grid, move freeze counter info from StreakHero icons into stat tiles, capitalise the app name in the macOS Dock, and fix the generic "exec" icon that appears when restoring the app from the system tray.

## Current State Analysis

- **Window**: `tauri.conf.json` line 20 sets default height to `600`. User wants `660`.
- **Tile grid**: `MonthStats.tsx` line 67 — `cols={showEndDate ? 1 : 2}` switches to 1-column when an `endDate` is present. Below the grid, a performance `Badge` sits above. The grid holds 2–4 `Card` tiles depending on state (days practiced, day streak, days left, days frozen).
- **Freeze indicators**: `StreakHero.tsx` lines 96–108 renders two ❄️ emoji icons below the "day streak" label. Opacity indicates remaining vs consumed freezes. `Dashboard.tsx` line 305 derives `freezesRemaining` from `status?.freezes_remaining ?? 2`.
- **App name**: `Cargo.toml` line 2: `name = "pauzaro"` (lowercase). Generated `Info.plist` uses `CFBundleDisplayName: pauzaro` / `CFBundleName: pauzaro`. The `productName: "Pauzaro"` in `tauri.conf.json` is capitalised but the bundler derives plist display names from the Cargo package name.
- **Tray icon**: `tray.rs` line 102 sets `ActivationPolicy::Accessory` on close (hides from Dock). Line 202 sets `ActivationPolicy::Regular` on show. The underlying `tao` crate calls only `NSApplication.setActivationPolicy()` — it does NOT call `setApplicationIconImage`. Tauri itself only calls `setApplicationIconImage` in `#[cfg(dev)]` builds. So in release builds, switching from Accessory back to Regular leaves the Dock showing a generic executable icon.

### Key Discoveries:

- `MonthStats` already uses `SimpleGrid cols={2}` — the conditional just needs removal
- Freeze count (`freezesRemaining`) already flows from Dashboard → StreakHero; re-routing it to MonthStats is a prop addition
- Max freezes is hardcoded as `2` in `FREEZE_SLOTS` constant and backend `STREAK_CONFIG`
- Tauri auto-detects `src-tauri/Info.plist` and merges it with the generated plist (confirmed in `tauri-codegen` source at `context.rs:303`)
- The dock icon fix requires `objc2-app-kit` and `objc2-foundation` crates to call `NSApplication::sharedApplication().setApplicationIconImage()`

## Desired End State

1. Main window opens at 660px height by default
2. MonthStats always renders a 2-column grid regardless of tile count (3 or 4 tiles; odd count leaves orphan at half-width)
3. A "Freezes left" tile in MonthStats shows remaining/total as fraction (e.g. "1/2"), always visible. The ❄️ icons in StreakHero are removed.
4. macOS Dock and Finder show "Pauzaro" (capitalised)
5. Restoring the app from system tray via "Show Dashboard" shows the correct Pauzaro icon in the Dock, not a generic process icon

### Verification:

- `pnpm tauri build` produces a bundle where `Info.plist` contains `CFBundleDisplayName: Pauzaro`
- Closing app to tray then clicking "Show Dashboard" shows correct Pauzaro icon in Dock
- Dashboard tiles always appear in 2 columns, including when an end date is set
- Freeze tile always appears in MonthStats with fraction format

## What We're NOT Doing

- Changing the Cargo.toml crate name (must stay lowercase per Rust convention)
- Adding Windows-specific icon fixes (only macOS activation policy causes this bug)
- Changing tile card styling or animation — layout only
- Adding tests for config/plist changes (manual verification)

## Implementation Approach

Three phases grouped by risk surface: config-only changes first (zero UI risk), then dashboard tile refactor (frontend only), then the Rust-level dock icon fix (requires new dependencies and unsafe macOS API calls). Each phase is independently deployable.

## Phase 1: Config Quick Wins

### Overview

Two config-level changes: bump default window height and add a custom Info.plist for capitalised app name. No code changes, pure configuration.

### Changes Required:

#### 1. Window height

**File**: `src-tauri/tauri.conf.json`

**Intent**: Change default window height from 600 to 660 to better fit dashboard content.

**Contract**: `app.windows[0].height` field — `600` → `660`.

#### 2. macOS bundle display name

**File**: `src-tauri/Info.plist` (new file)

**Intent**: Override the auto-generated plist's `CFBundleDisplayName` and `CFBundleName` so macOS Dock and Finder show "Pauzaro" with a capital P. Tauri's codegen automatically detects `src-tauri/Info.plist` and merges it with the generated plist.

**Contract**: New plist file containing only `CFBundleDisplayName` and `CFBundleName` keys, both set to `"Pauzaro"`. Standard Apple plist XML format.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Pauzaro</string>
    <key>CFBundleName</key>
    <string>Pauzaro</string>
</dict>
</plist>
```

### Success Criteria:

#### Automated Verification:

- Type-check passes: `tsc --noEmit`
- Rust check passes: `cd src-tauri && cargo check`

#### Manual Verification:

- `pnpm tauri build` succeeds
- Inspect generated `.app/Contents/Info.plist` — `CFBundleDisplayName` and `CFBundleName` both read `"Pauzaro"`
- App name in macOS Dock shows "Pauzaro" (capitalised)
- Main window opens at correct height (660px)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dashboard Tile Refactor

### Overview

Three related UI changes: make MonthStats grid always 2 columns, add a freeze counter tile, and remove the ❄️ icons from StreakHero.

### Changes Required:

#### 1. Always 2-column grid

**File**: `src/components/dashboard/MonthStats.tsx`

**Intent**: Remove the conditional column count so tiles always render in a 2-column grid. Currently `cols={showEndDate ? 1 : 2}` switches to 1-column when endDate exists.

**Contract**: `SimpleGrid` `cols` prop — change from `cols={showEndDate ? 1 : 2}` to `cols={2}`.

#### 2. Add freeze counter tile

**File**: `src/components/dashboard/MonthStats.tsx`

**Intent**: Add a new stat tile showing freezes remaining as a fraction (e.g. "1/2"). Always visible regardless of freeze state. Uses the same `Card` pattern as existing tiles (icon + number + label).

**Contract**: New props `freezesRemaining: number` and `maxFreezes: number` on `MonthStatsProps`. New `Card` element after the "Day streak" card, rendering `Snowflake` icon (already imported), the fraction `${freezesRemaining}/${maxFreezes}` as the value, and "Freezes left" as the label.

#### 3. Remove existing "Days frozen" conditional tile

**File**: `src/components/dashboard/MonthStats.tsx`

**Intent**: Remove the conditional "Days frozen" tile (lines 106–118) that only shows when `frozenInMonth > 0`. This counted frozen days in the current displayed month — a different metric from the new "Freezes left" tile which shows remaining freeze capacity. The monthly frozen-day count is no longer needed since the new tile communicates the freeze state more clearly.

**Contract**: Remove the `frozenInMonth` computation (lines 53–59), remove the `frozenDates`, `currentYear`, `currentMonth` props from the interface, and remove the conditional Card block (lines 106–118).

#### 4. Remove ❄️ icons from StreakHero

**File**: `src/components/dashboard/StreakHero.tsx`

**Intent**: Remove the snowflake emoji icons below "day streak" label since freeze info now lives in MonthStats tiles.

**Contract**: Remove the `FREEZE_SLOTS` constant (lines 8–11), remove `freezesRemaining` from `StreakHeroProps`, and remove the `Group` block rendering the icons (lines 96–108).

#### 5. Wire new props through Dashboard

**File**: `src/components/dashboard/Dashboard.tsx`

**Intent**: Pass `freezesRemaining` and `maxFreezes` to MonthStats. Remove `freezesRemaining` prop from StreakHero. Clean up unused props from MonthStats (`frozenDates`, `currentYear`, `currentMonth`).

**Contract**: `MonthStats` invocation gains `freezesRemaining={freezesRemaining}` and `maxFreezes={2}`. `StreakHero` invocation loses `freezesRemaining` prop. `MonthStats` invocation loses `frozenDates`, `currentYear`, `currentMonth` props.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Frontend tests pass: `pnpm test`

#### Manual Verification:

- Dashboard tiles always appear in 2 columns — test with and without end date
- Freeze tile shows fraction (e.g. "2/2") with Snowflake icon
- Freeze tile visible even when all freezes available
- ❄️ icons no longer appear below "day streak" in StreakHero
- Layout looks balanced with 3 tiles (no endDate) and 4 tiles (with endDate)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Tray Dock Icon Fix

### Overview

Fix the macOS-specific bug where restoring the app from system tray shows a generic "exec" process icon in the Dock instead of the Pauzaro app icon. Requires adding `objc2` ecosystem crates and calling `NSApplication.setApplicationIconImage()` after switching activation policy back to `Regular`.

### Changes Required:

#### 1. Add macOS-specific dependencies

**File**: `src-tauri/Cargo.toml`

**Intent**: Add `objc2-app-kit` and `objc2-foundation` as macOS-only dependencies for accessing `NSApplication.setApplicationIconImage()`.

**Contract**: New entries under `[target.'cfg(target_os = "macos")'.dependencies]` section:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2-app-kit = { version = "0.3", features = ["NSApplication", "NSImage", "NSRunningApplication"] }
objc2-foundation = { version = "0.3", features = ["NSData", "NSThread"] }
```

#### 2. Restore dock icon after activation policy change

**File**: `src-tauri/src/tray.rs`

**Intent**: After `set_activation_policy(Regular)` in `show_main_window()`, explicitly re-set the dock icon via the `NSApplication` API. Tauri's `default_window_icon()` provides the icon bytes (same source used for the tray icon on line 60).

**Contract**: In `show_main_window()`, after line 202 (`set_activation_policy(Regular)`), add a call to `NSApplication::sharedApplication(mtm).setApplicationIconImage()` using the icon data from `app.default_window_icon()`. This requires converting the Tauri icon bytes to `NSData` → `NSImage`. The call is gated behind `#[cfg(target_os = "macos")]` (already the enclosing block).

```rust
// After set_activation_policy(Regular):
if let Some(icon) = app.default_window_icon() {
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{NSData, MainThreadMarker};
    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let ns_app = NSApplication::sharedApplication(mtm);
    let data = unsafe { NSData::with_bytes(icon.rgba()) };
    if let Some(ns_image) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe { ns_app.setApplicationIconImage(Some(&ns_image)) };
    }
}
```

Note: The exact `NSData` constructor and `NSImage::initWithData` API may differ slightly with `objc2` 0.3 vs earlier versions — verify against the crate docs during implementation. The icon bytes from `default_window_icon()` are PNG-encoded (Tauri feature `image-png` is enabled in Cargo.toml line 21), and `NSImage::initWithData` accepts PNG data.

### Success Criteria:

#### Automated Verification:

- Rust compiles: `cd src-tauri && cargo check`
- Rust tests pass: `cd src-tauri && cargo test`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Launch app normally — Dock shows Pauzaro icon
- Close app (hides to tray) — Dock icon disappears
- Click "Show Dashboard" from tray menu — Dock shows Pauzaro icon (NOT generic exec icon)
- Left-click tray icon — same correct icon restoration
- Repeat close→show cycle 3 times — icon consistently correct

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests needed — changes are config, layout, and platform API calls
- Existing tests must still pass (`pnpm test`, `cargo test`)

### Manual Testing Steps:

1. Build app with `pnpm tauri build`
2. Verify Dock shows "Pauzaro" (capitalised)
3. Verify window opens at 660px height
4. Navigate to dashboard — tiles in 2 columns
5. Check freeze tile shows "2/2" (or current state) with snowflake icon
6. Create/switch to habit with end date — tiles still 2 columns, now 3-4 tiles
7. Close app to tray → click "Show Dashboard" → verify Dock icon is Pauzaro icon
8. Repeat tray cycle — icon stays correct

## Performance Considerations

None. Config changes are zero-cost. Tile layout change removes a conditional (simpler). The `setApplicationIconImage` call happens once per show-from-tray event — negligible.

## References

- Tauri codegen plist merge: `~/.cargo/registry/.../tauri-codegen-2.6.3/src/context.rs:303`
- Tauri dev-only icon set: `~/.cargo/registry/.../tauri-2.11.5/src/app.rs:2566-2580`
- tao activation policy (no icon): `~/.cargo/registry/.../tao-0.35.3/src/platform/macos.rs:428-440`
- `MonthStats.tsx:67` — current conditional column count
- `StreakHero.tsx:96-108` — current freeze icons
- `tray.rs:199-210` — `show_main_window()`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Config Quick Wins

#### Automated

- [x] 1.1 Type-check passes: `tsc --noEmit`
- [x] 1.2 Rust check passes: `cd src-tauri && cargo check`

#### Manual

- [ ] 1.3 Generated Info.plist contains capitalised CFBundleDisplayName and CFBundleName
- [ ] 1.4 App name in macOS Dock shows "Pauzaro"
- [ ] 1.5 Main window opens at 660px height

### Phase 2: Dashboard Tile Refactor

#### Automated

- [ ] 2.1 Type-check passes: `tsc --noEmit`
- [ ] 2.2 Lint passes: `pnpm lint`
- [ ] 2.3 Frontend tests pass: `pnpm test`

#### Manual

- [ ] 2.4 Tiles always 2 columns (with and without end date)
- [ ] 2.5 Freeze tile shows fraction with Snowflake icon
- [ ] 2.6 Freeze tile visible when all freezes available
- [ ] 2.7 No ❄️ icons below "day streak" in StreakHero
- [ ] 2.8 Layout balanced with 3 and 4 tiles

### Phase 3: Tray Dock Icon Fix

#### Automated

- [ ] 3.1 Rust compiles: `cd src-tauri && cargo check`
- [ ] 3.2 Rust tests pass: `cd src-tauri && cargo test`
- [ ] 3.3 Lint passes: `pnpm lint`

#### Manual

- [ ] 3.4 Close to tray then "Show Dashboard" shows Pauzaro icon in Dock
- [ ] 3.5 Left-click tray icon also restores correct icon
- [ ] 3.6 Repeat close→show cycle 3 times — icon consistently correct
