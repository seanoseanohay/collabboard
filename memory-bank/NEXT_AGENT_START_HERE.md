# START HERE - Next Agent Context

**Date:** 2026-02-17

## Current State

**Locking, document sync, Google Auth, presence awareness, and multi-selection move sync are working.** ✅

### What Was Done (Previous Session)
1. **Memory bank** — Presence awareness marked done; multi-selection move bug documented.
2. **Multi-selection move sync** — Fixed in boardSync: `getObjectsToSync(target)` returns single object or each object in ActiveSelection; throttle uses `pendingMoveIds` (Set); `object:modified` syncs each object in selection. Moving circle + triangle together now syncs to other devices.

### Completed
- Google Auth ✅
- Presence awareness ✅ — Names in header
- Multi-selection move sync ✅

## Next Item (suggested — do soon)

- **Shape tool vs selection** — With a shape tool active (circle, rect, triangle), drawing inside an existing object selects it instead of creating a new shape. Selection should only happen when the select tool is on. Fix: FabricCanvas — when `selectedTool !== 'select'`, prevent selection so pointer down starts the draw (e.g. discard active object or avoid hit-test selection when using a shape tool).

Other:
- **Board loading performance** — Fetches ALL objects upfront; slow on 50+ objects. Consider lazy loading or pagination.
- Or other polish / known issues from progress.md.

## Quick Reference
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **Fabric:** ActiveSelection has getObjects() but no data.id; we sync each child.
