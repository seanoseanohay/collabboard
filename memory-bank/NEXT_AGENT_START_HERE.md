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

## Next Item (suggested)

- **Board loading performance** — Fetches ALL objects upfront; slow on 50+ objects. Consider lazy loading or pagination.
- Or other polish / known issues from progress.md.

## Quick Reference
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **Fabric:** ActiveSelection has getObjects() but no data.id; we sync each child.
