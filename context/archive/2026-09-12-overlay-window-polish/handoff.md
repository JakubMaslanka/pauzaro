# Handoff: overlay-window-polish (S-12)

## Summary

The overlay window has been converted from a floating card centered on a transparent backdrop into a full-bleed, edge-to-edge solid panel. Three files were changed.

## Changes Made

### 1. `src-tauri/src/scheduler.rs`
- Window width reduced from 420px to 400px (`inner_size(400.0, 380.0)`)

### 2. `src/components/overlay/OverlayPanel.tsx`
- Removed `Card` import from `@mantine/core` (no longer needed)
- Replaced `OverlayCard` wrapper: was a transparent centering div wrapping a Mantine `<Card>` with `radius="xl"`, `shadow="xl"`, `withBorder`; now a single `<div>` that fills the viewport edge-to-edge with `background: "#F7F5F0"`, flexbox vertical centering, `padding: "0 24px"`, and `overflow: hidden`

### 3. `src/components/debug/DebugView.tsx`
- Overlay window width changed from 420 to 400 to match production
- Removed `transparent: true` from `WebviewWindow` options so debug overlays match production appearance

## Automated Verification (all passing)

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Pass |
| `pnpm lint` | Pass (64 files, 0 issues) |
| `cargo check` | Pass |
| `cargo test` | 4/4 pass |
| `pnpm test` | 9 suites, 57/57 pass |

## Manual Testing Needed

These three checks require running the Tauri app (`pnpm tauri dev`):

1. **Full-bleed layout**: Trigger a habit overlay (via scheduler or DebugView "Show Overlay Window" button). Verify the overlay renders as a solid 400px-wide panel with no rounded corners, no shadow, no border, and no gap between content and window edges.

2. **All four states render without scrolling**:
   - **Loading**: Briefly visible when overlay opens (centered teal spinner)
   - **Ready**: Shows habit icon, name, description, Done/Snooze buttons. Try a habit with a long description to confirm no overflow
   - **Auto-failed**: Snooze 3 times (or simulate via code) to reach the "Marked as failed" state
   - **Error**: Pass an invalid habit ID in the URL to trigger the error state
   - None of these should show a scrollbar

3. **Debug overlay matches production**: Open DebugView (`/debug` route), click "Show Overlay Window". The overlay should look identical to one triggered by the real scheduler (no transparent background, same 400px width).

## Rollback

Revert commit `ce31aad` to restore the original floating card layout. No migrations, no config changes, no data impact.
