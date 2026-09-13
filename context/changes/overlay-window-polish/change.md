---
change_id: overlay-window-polish
title: Full-bleed overlay panel with no rounded corners
status: implementing
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

The overlay window should render as a full-bleed, edge-to-edge solid panel with no rounded corners and no scroll; its width accommodates all content without horizontal overflow. Backend: adjust inner_size in TauriOverlaySpawner::spawn_overlay to a comfortable fixed width (~400px) and height that fits tallest state without scrolling. Frontend: replace the current OverlayCard wrapper (centered Card with radius="xl" inside transparent 100vh container) with a full-bleed layout filling the entire viewport edge-to-edge.
