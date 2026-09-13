# Overlay Window Polish Implementation Plan

## Overview

Convert the overlay window from a floating card centered on a transparent backdrop into a full-bleed, edge-to-edge solid panel with no rounded corners and no scroll. The window width shrinks from 420px to 400px, the `OverlayCard` wrapper drops its centering/card/shadow layer, and the DebugView spawner is aligned with production config.

## Current State Analysis

The overlay is a 420x380 Tauri window (`decorations(false)`, `always_on_top(true)`, centered) containing a React `OverlayPanel` component. Inside, an `OverlayCard` wrapper creates a transparent full-viewport flex container that centers a Mantine `<Card>` with `radius="xl"`, `shadow="xl"`, `maxWidth: 360`, `withBorder`, and `padding="xl"`. The card floats visually inside the window with 16px of padding around it, creating a card-on-background effect.

### Key Discoveries:

- `OverlayCard` is defined as a standalone function at `src/components/overlay/OverlayPanel.tsx:193-220`, used by all four overlay states (loading, ready, auto_failed, error)
- `TauriOverlaySpawner::spawn_overlay` at `src-tauri/src/scheduler.rs:37-64` sets `inner_size(420.0, 380.0)` with no `transparent` flag
- `DebugView` at `src/components/debug/DebugView.tsx:123` sets `transparent: true` when spawning test overlays, creating a visual mismatch with production
- Global CSS (`src/styles/global.css`) sets `body { background-color: #f7f5f0; }` and `#root { height: 100vh; }`, so the warm off-white already covers the window background

## Desired End State

The overlay window is a solid 400x380 panel that fills edge-to-edge with the warm off-white background (`#F7F5F0`). No rounded corners, no shadow, no border, no gap between content and window edges. Content is vertically centered within the panel. Both production (Rust) and debug (DebugView JS) spawners produce identical-looking overlays. No horizontal or vertical scrolling occurs in any state.

## What We're NOT Doing

- Changing overlay content or behavior (buttons, text, auto-snooze timer, close logic)
- Changing the overlay route or URL structure
- Adding dark mode support (parked per roadmap)
- Changing button styling (they keep `radius="xl"` per the app's playful design language)
- Modifying the `OverlaySpawner` trait interface

## Implementation Approach

Single-pass change across three files: reduce the Rust window width, simplify the React `OverlayCard` wrapper from a card-in-a-card layout to a direct full-bleed container, and drop `transparent: true` from DebugView.

## Phase 1: Full-bleed overlay panel

### Overview

Replace the floating card layout with a full-bleed panel and adjust the Rust window size to 400px wide.

### Changes Required:

#### 1. Rust overlay window size

**File**: `src-tauri/src/scheduler.rs`

**Intent**: Reduce the overlay window width from 420px to 400px. Height stays at 380px (already fits all content states without scrolling).

**Contract**: Change the `inner_size` call from `(420.0, 380.0)` to `(400.0, 380.0)`.

#### 2. React OverlayCard wrapper

**File**: `src/components/overlay/OverlayPanel.tsx`

**Intent**: Replace the current two-layer layout (transparent centering div + bordered Card) with a single full-bleed container. The container fills the viewport edge-to-edge with the warm off-white background, centers content vertically, and uses direct padding instead of a nested Card.

**Contract**: The `OverlayCard` function (currently lines 193-220) replaces the outer `<div>` + inner `<Card>` with a single `<div>` that:
- Fills `100vh` / `100%` width (edge-to-edge)
- Uses `background: "#F7F5F0"` (the app's warm off-white)
- Centers children vertically via flexbox
- Applies horizontal padding (roughly `xl` equivalent, ~24-32px) for content breathing room
- Has `overflow: hidden` to prevent any scroll
- No `border-radius`, no `box-shadow`, no `border`

The `Card` import from `@mantine/core` can be removed since no other code in this file uses it.

#### 3. DebugView overlay spawner alignment

**File**: `src/components/debug/DebugView.tsx`

**Intent**: Remove `transparent: true` from the debug overlay window creation and update its width to 400px to match the production Rust spawner.

**Contract**: In the `WebviewWindow` constructor options (around line 115-124), remove the `transparent: true` property and change `width` from `420` to `400`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `tsc --noEmit`
- Lint passes: `pnpm lint`
- Rust check passes: `cd src-tauri && cargo check`
- Rust tests pass: `cd src-tauri && cargo test`
- Frontend tests pass: `pnpm test`

#### Manual Verification:

- Overlay renders as a solid 400px-wide panel with no rounded corners, no shadow, no border
- Content is vertically centered within the panel
- All four overlay states (loading, ready, auto_failed, error) display correctly without scrolling
- The "ready" state with a long habit description does not overflow or scroll
- Debug overlay (triggered from DebugView) looks identical to production overlay

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Existing Rust tests in `scheduler.rs` (if any) continue to pass with the width change
- Existing frontend tests for `OverlayPanel` continue to pass with the wrapper change

### Manual Testing Steps:

1. Trigger a habit overlay via the scheduler (or DebugView) and verify the full-bleed layout
2. Check the loading state (briefly visible on overlay open) renders centered without card chrome
3. Trigger the auto_failed state (snooze 3 times) and verify it displays correctly within the panel
4. Verify no horizontal or vertical scrollbar appears in any state
5. Open a debug overlay from DebugView and confirm it matches the production appearance

## References

- Roadmap entry: `context/foundation/roadmap.md` S-12
- Overlay Rust implementation: `src-tauri/src/scheduler.rs:37-64`
- Overlay React component: `src/components/overlay/OverlayPanel.tsx`
- DebugView overlay: `src/components/debug/DebugView.tsx:115-124`
- Global CSS: `src/styles/global.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Full-bleed overlay panel

#### Automated

- [x] 1.1 Type checking passes — ce31aad
- [x] 1.2 Lint passes — ce31aad
- [x] 1.3 Rust check passes — ce31aad
- [x] 1.4 Rust tests pass — ce31aad
- [x] 1.5 Frontend tests pass — ce31aad

#### Manual

- [ ] 1.6 Overlay renders as solid full-bleed panel without card chrome
- [ ] 1.7 All four states display correctly without scrolling
- [ ] 1.8 Debug overlay matches production overlay
