# Overlay Window Polish -- Plan Brief

> Full plan: `context/changes/overlay-window-polish/plan.md`

## What & Why

The overlay window currently renders as a floating card (rounded corners, shadow, border) centered on a transparent backdrop inside a 420px Tauri window. This creates a card-on-background effect that looks unfinished for a desktop notification panel. We are converting it to a solid, full-bleed panel that fills edge-to-edge with no visual chrome, making it feel like a polished native overlay.

## Starting Point

The overlay is built from two layers: a Rust-side `TauriOverlaySpawner` that creates a 420x380 decorationless window (`src-tauri/src/scheduler.rs:37-64`), and a React `OverlayCard` wrapper (`src/components/overlay/OverlayPanel.tsx:193-220`) that centers a Mantine `<Card radius="xl" shadow="xl" withBorder maxWidth={360}>` inside a transparent 100vh flex container. A separate `DebugView` spawner sets `transparent: true`, creating a visual mismatch with production.

## Desired End State

The overlay is a solid 400px-wide panel with the app's warm off-white background (#F7F5F0), filling the window edge-to-edge. No rounded corners, no shadow, no border. Content is vertically centered. Both production and debug overlays look identical. No scrolling in any state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Window width | 400px (down from 420px) | Matches roadmap suggestion; content no longer needs the extra 20px since there's no card inset |
| Content alignment | Vertically centered | Maintains the current balanced feel across all overlay states |
| Background color | Warm off-white #F7F5F0 | Consistent with the app's visual identity (already the body background) |
| DebugView alignment | Fix to match production | Removes `transparent: true` and adjusts width so debug overlays look identical |

## Scope

**In scope:**
- Reduce Rust overlay window width from 420 to 400px
- Replace `OverlayCard` two-layer card wrapper with a single full-bleed container
- Remove `transparent: true` from DebugView overlay spawner
- Update DebugView width to 400px

**Out of scope:**
- Overlay content, buttons, or behavior changes
- Dark mode support
- Button border-radius changes (stays `xl` per design language)
- `OverlaySpawner` trait interface changes

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Full-bleed overlay panel | Solid edge-to-edge panel in all 3 files | Minimal: CSS + one Rust constant |

**Prerequisites:** None (S-02 is done)
**Estimated effort:** ~1 session, single phase

## Open Risks & Assumptions

- Window height (380px) is assumed sufficient for the tallest overlay state (auto_failed with icon + two text lines). If a very long habit description causes overflow, `overflow: hidden` will clip it rather than scroll.

## Success Criteria (Summary)

- Overlay renders as a solid 400px-wide panel with no card chrome (no rounded corners, no shadow, no border)
- All four overlay states display correctly without scrolling
- Debug overlay is visually identical to production overlay
