# START HERE - Next Agent Context

**Date:** 2026-02-17

## Current State

**Locking, document sync, Google Auth, presence awareness, multi-selection move sync, and very wide zoom (MVP) are working.** ✅

### What Was Done (Previous Session)
1. **Zoom (MVP)** — Very wide zoom range: MIN_ZOOM = 0.0001 (0.01%), MAX_ZOOM = 100 (10000%). FabricCanvas.tsx. PRD §2.1 and memory bank updated.
2. **Multi-selection move sync** — boardSync getObjectsToSync + pendingMoveIds + payloadWithSceneCoords for scene coordinates.

### Completed
- Google Auth ✅
- Presence awareness ✅ — Names in header
- Multi-selection move sync ✅
- **Very wide zoom (MVP)** ✅ — 0.01%–10000%+

## Next Items (suggested)

**Zoom/pan (Figma-like) — planned, not yet implemented:**
- Hand tool — toolbar; left-drag always pans, never moves object.
- Two-finger drag = pan, pinch / Ctrl+wheel = zoom.
- Infinite pan (no hard bounds).
- Shortcuts: Space+drag, +/-, 0 (fit), 1 (100%).
- Zoom UI (dropdown/slider) — production list only.

**Other:**
- **Shape tool vs selection** — With shape tool active, drawing inside existing object should create shape not select. Fix: FabricCanvas when `selectedTool !== 'select'` prevent selection.
- **Board loading performance** — Lazy load for 50+ objects.

## Quick Reference
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **Fabric:** ActiveSelection has getObjects() but no data.id; we sync each child.
