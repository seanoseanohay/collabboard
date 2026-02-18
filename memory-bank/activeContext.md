# Active Context

## Current Focus (for next agent)
**Priority to fix:** Multi-selection move drift — When one user moves a group of objects, other clients see the objects continuously move down and to the right (regardless of drag direction). Move-delta broadcast is in place (boardSync: move_deltas channel, getTargetSceneCenter for sender, scene-coords apply on receiver); bug still reproduces. Treat as high priority until resolved.

**Sticky notes UX:** No placeholder text; on create, box completes and edit mode opens automatically (blinking cursor, ready to type). shapeFactory sticky = [bg, mainText] only; FabricCanvas handleMouseUp auto-enters edit after 50ms + hiddenTextarea.focus(). Next: Post-MVP (AI agent, Undo).

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

1. **Zoom/pan** — Hand tool ✅, shortcuts (+/-, 0 fit, 1 100%) ✅, zoom UI dropdown ✅, trackpad two-finger pan + pinch zoom ✅ (FabricCanvas handleWheel; pinch sensitivity 0.006).
2. ~~**Shape tool vs selection**~~ ✅ — With shape tool active, pointer-down always starts drawing (discardActiveObject + draw); never selects.
3. ~~**Board loading performance**~~ ✅ — Paginated fetch in documentsApi (50 per batch, order by object_id).
4. ~~**Stroke width (border thickness)**~~ ✅ — PRD §4. strokeUtils (getStrokeWidthFromObject, setStrokeWidthOnObject), StrokeControl in toolbar when selection has stroke (1/2/4/8px). Sync uses Fabric strokeWidth in payload. FabricCanvas: onSelectionChange, setActiveObjectStrokeWidth on ref.

## Recent Changes (2026-02-17)

**Trackpad pan/zoom:**
- ✅ **Two-finger scroll = pan, pinch = zoom** — FabricCanvas handleWheel: plain wheel → relativePan(-deltaX, -deltaY); ctrlKey (pinch) → zoom at cursor. Pinch sensitivity 0.006 (deltaY multiplier). Works on trackpad; mouse wheel still zooms, Hand/Space+drag unchanged.

**Sticky notes:**
- ✅ **No placeholder text** — Sticky is [bg, mainText] only; mainText starts empty. Removed "Double-click to edit" and placeholder IText.
- ✅ **Auto-enter edit on create** — When user finishes drawing a sticky (mouse up), edit mode opens after 50ms so blinking cursor appears and user can type immediately. tryEnterTextEditing(mainText) with hiddenTextarea?.focus().

**Stroke width + toolbar aesthetic:**
- ✅ **Stroke width** — Select any stroke-bearing object; "Stroke" dropdown appears in toolbar (1/2/4/8px). strokeUtils.ts (getStrokeWidthFromObject, setStrokeWidthOnObject), StrokeControl.tsx, FabricCanvas onSelectionChange + setActiveObjectStrokeWidth; sync via object:modified.
- ✅ **Toolbar redesign** — Icon-based tool groups (Select|Hand | Rect|Circle|Triangle|Line | Text|Sticky), dividers, zoom dropdown right; tldraw-like flat style (32px icon buttons, subtle active state).
- ✅ **Header** — WorkspacePage header aligned: same border/shadow, 32px buttons, #e5e7eb borders, #374151 text.

## Earlier Recent Changes (2026-02-17)

**Zoom (MVP):**
- ✅ Very wide zoom range: MIN_ZOOM = 0.00001 (0.001%), MAX_ZOOM = 100 (10000%). Figma-like infinite-canvas zoom. FabricCanvas.tsx.

**Multi-selection move sync (coordinates fix):**
- ✅ Objects in ActiveSelection have relative left/top/angle/scale; we were syncing those so other clients saw wrong position (disappear during move, wrong place on drop). boardSync now uses payloadWithSceneCoords(obj, payload): when obj.group exists, override payload with util.qrDecompose(obj.calcTransformMatrix()) so left/top/angle/scaleX/scaleY/skew are scene (absolute) coordinates. Used in emitAdd and emitModify.

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
14. **Zoom/pan** — Very wide zoom ✅, Hand tool ✅, shortcuts (+/-, 0, 1) ✅, zoom UI ✅, trackpad two-finger pan + pinch zoom ✅ (handleWheel: ctrlKey = zoom, else pan; pinch 0.006).
15. ~~**Shape tool: no selection when drawing**~~ ✅ — FabricCanvas: shape tool always draws, discardActiveObject on pointer down.
16. ~~**Board loading performance**~~ ✅ — documentsApi fetchInitial paginated (PAGE_SIZE 50).

## Multi-selection move sync v2 — implemented but buggy (priority fix)

**Goal:** All items end up in the right spot when moving a selection; other clients see moves with minimal lag.

**Current state:** Implemented (boardSync: move_deltas channel, broadcast during drag, absolute write on drop, getTargetSceneCenter for sender, scene-coords apply on receiver). **Bug:** Other clients still see objects continuously drift down and to the right regardless of drag direction. Tried fixing by using target scene center instead of children average; still reproducing. **Priority to fix.**

**Design (documented in PRD § Sync Strategy):** During drag broadcast `{ objectIds, dx, dy }`; on drop write absolute to documents. Single-object and Fabric Group (sticky) moves unchanged.

## Planned: Z-order nudge (bring forward / send backward)

**Goal:** One step in z-order (in front of or behind adjacent object), not only full bring-to-front / send-to-back. PRD §4 Object Capabilities.

## Planned: AI Client API (Post-MVP)

**Goal:** All app actions (create objects, update props, delete, query) should be doable via a client-side API so AI (Cursor, Claude, in-app agent) can perform the same operations as the UI.

**Scope:** createObject, updateObject, deleteObjects, queryObjects. UI and AI share this API. See docs/AI_CLIENT_API.md.

**Effort estimate:** ~1–2 days (client-only); ~2–3 days with server Edge Function + query.

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking ✅

## Considerations
- **FabricCanvas effect split:** Document sync in Effect 1 (deps: width, height, boardId). Lock sync in Effect 2 (deps: boardId, userId, userName). Prevents document subscription teardown when auth loads.
- **boardSync:** setupDocumentSync + setupLockSync; applyLockStateCallbackRef for re-applying locks after remote updates.
- **Multi-selection move:** Implemented (broadcast deltas during drag, absolute on drop; getTargetSceneCenter for sender). Bug: other clients see continuous drift down and right. Priority to fix; see progress.md Known Issues.
- **Z-order:** bringToFront/sendToBack implemented; bringForward/sendBackward (one step) planned per PRD §4.
- **Boards page cleanup:** BoardListPage (list of user’s boards). Figma-inspired scope in memory-bank/boards-page-cleanup.md (layout, Workspace consistency, loading/empty, copy link, delete, rename, sort).
