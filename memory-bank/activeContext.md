# Active Context

## Current Focus (for next agent)
**Multi-selection move sync is fixed.** ✅ Next: board loading performance (lazy load for 50+ objects) or other polish.

### What Was Fixed (2026-02-17)
1. **Locking never enabled** — Effect ran before auth loaded; `userId`/`userName` were empty. Added `userId`/`userName` to effect deps so sync re-ran when auth ready.
2. **Document sync torn down on auth change** — Adding auth to deps caused full effect teardown (canvas + documents + locks) whenever auth changed. Document subscription was removed, so position updates stopped.
3. **Fix: Split sync into two effects:**
   - **Effect 1** `[width, height, boardId]` — Canvas + document sync only. Never torn down when auth changes. Keeps receiving position updates.
   - **Effect 2** `[boardId, userId, userName]` — Lock sync only. Tear down/recreate only when auth changes. Document sync persists.

### Code Changes
- **boardSync.ts:** Extracted `setupDocumentSync()` and `setupLockSync()`. `applyLockStateCallbackRef` lets document sync re-apply lock state after remote position updates. `setupBoardSync()` composes both.
- **FabricCanvas.tsx:** Two effects — document sync (deps: width, height, boardId); lock sync (deps: boardId, userId, userName).

## Next Steps

1. **Board loading performance** — Fetches ALL objects upfront. Slow on boards with 50+ objects. Consider lazy loading or pagination.

## Recent Changes (2026-02-17)

**Multi-selection move sync:**
- ✅ boardSync: getObjectsToSync(target) returns [target] if id, else getObjects() for ActiveSelection; emitModifyThrottled uses pendingMoveIds (Set); object:modified syncs each object in selection. Moving circle + triangle together now syncs to other devices.

**Presence awareness:**
- ✅ Header shows names list: "X others viewing — Alice, Bob" (WorkspacePage); tooltip with full list; ellipsis for long lists. Working as wanted (not perfect).

**Locking + Document Sync Fix:**
- ✅ Split FabricCanvas effect: document sync vs lock sync
- ✅ Document sync deps `[width, height, boardId]` — never tears down on auth
- ✅ Lock sync deps `[boardId, userId, userName]` — adds locking when auth ready
- ✅ boardSync: setupDocumentSync, setupLockSync, applyLockStateCallbackRef
- ✅ Locking works: User1 selects → User2 cannot grab; position updates sync live

**Earlier 2026-02-17 — Locking fixes:**
- ✅ evented: false on locked objects
- ✅ Optimistic locking, broadcast for instant propagation
- ✅ Reapply lock state after remote position updates
- ✅ setCoords() after position updates (ghost click zone)

## Next Steps (Recode Order)

1. ~~Dependencies~~ ✅
2. ~~Fabric canvas wrapper~~ ✅
3. ~~Shapes + toolbar~~ ✅
4. ~~Viewport culling~~ ✅
5. ~~Delta sync~~ ✅
6. ~~Presence & cursors~~ ✅
7. **Locking** ✅ — Fully working (split effect, document sync persists)
8. ~~Board sharing~~ ✅
9. ~~Selection~~ ✅
10. ~~Tests~~ ✅
11. ~~**Google Auth**~~ ✅ — Complete (user can log in with Google)
12. ~~**Presence awareness — "Who's on board"**~~ ✅ — Names list in header ("X others viewing — Alice, Bob"); working as wanted (not perfect).
13. ~~**Multi-selection move sync**~~ ✅ — boardSync getObjectsToSync + pendingMoveIds; object:modified syncs each in selection.
14. **Board loading performance** — Lazy load for 50+ objects (Known Issue)

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking ✅

## Considerations
- **FabricCanvas effect split:** Document sync in Effect 1 (deps: width, height, boardId). Lock sync in Effect 2 (deps: boardId, userId, userName). Prevents document subscription teardown when auth loads.
- **boardSync:** setupDocumentSync + setupLockSync; applyLockStateCallbackRef for re-applying locks after remote updates.
