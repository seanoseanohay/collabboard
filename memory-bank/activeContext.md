# Active Context

## Current Focus (for next agent)
**Multi-selection move drift: FIXED (2026-02-18).** Root cause was originX/originY vs calcTransformMatrix center mismatch — see systemPatterns for the pattern doc. All three fixes in boardSync.ts. No remaining high-priority bugs.

**Current state:** All planned MVP + post-MVP features complete. Touch handling ✅, Undo/Redo ✅, AI agent ✅. Revocable invite links removed from scope.

**Remaining work:** MeBoard branding (docs/MeBoard_BRANDING_SPEC.md) and planned canvas features (docs/PLANNED_CANVAS_FEATURES.md) — both optional polish/stretch. **Viewport persistence** — TODO: persist zoom/pan per board so returning users see where they left off; optional "Reset view" / "Center canvas" control.

**Inline board rename in workspace** ✅ — Click the board title (e.g. "Untitled Board") in the workspace header to edit inline. Blur or Enter saves; Escape cancels. Uses updateBoardTitle; BoardPage passes onBoardTitleChange to keep local state in sync.

**MeBoard branding** ✅ — Phase 1 + Phase 2 done. Login, nav, footer, index.html, App loading, pirate cursor icons, map border overlay + toggle, Pirate Plunder stickers (emoji fabric.Text, 96×96, non-editable). Spec: docs/MeBoard_BRANDING_SPEC.md. §9 Pirate Plunder implemented with emoji (not SVG/Path).

**Planned canvas features** — See docs/PLANNED_CANVAS_FEATURES.md: Object grouping (Group/Ungroup), Free draw (pencil), Lasso selection, Multi-scale map vision (with MeBoard border).

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

1. **Zoom/pan** — Hand tool ✅, shortcuts (+/-, 0 fit, 1 100%) ✅, zoom UI dropdown ✅, **zoom slider** ✅ (log scale 25%–400%), trackpad two-finger pan + pinch zoom ✅ (FabricCanvas handleWheel; pinch sensitivity 0.006).
2. **Canvas grid** — tldraw-style grid overlay ✅ (20px cells, transforms with viewport). GridOverlay.tsx; FabricCanvas transparent background; GridOverlay behind canvas.
3. **Cursor position readout** — tldraw-style ✅ (bottom-left, x/y scene coords). CursorPositionReadout.tsx; onPointerMove always fired for readout (and presence when user).
4. ~~**Shape tool vs selection**~~ ✅ — With shape tool active, pointer-down always starts drawing (discardActiveObject + draw); never selects.
5. ~~**Board loading performance**~~ ✅ — Paginated fetch in documentsApi (50 per batch, order by object_id).
6. ~~**Stroke width (border thickness)**~~ ✅ — PRD §4. strokeUtils (getStrokeWidthFromObject, setStrokeWidthOnObject), StrokeControl in toolbar when selection has stroke (1/2/4/8px). Sync uses Fabric strokeWidth in payload. FabricCanvas: onSelectionChange, setActiveObjectStrokeWidth on ref.

## Recent Changes (2026-02-19)

**LangSmith AI observability:**
- ✅ **ai-interpret** Edge Function uses OpenAI SDK + `wrapOpenAI` for tracing. All LLM calls (inputs, outputs, tokens, latency, errors) visible at smith.langchain.com.
- Secrets: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`. Documented in SUPABASE_SETUP.md, AI_CLIENT_API.md.

**Cursor lag fix — Broadcast + CSS interpolation:**
- ✅ **Root cause 1:** Cursor positions were going through postgres_changes → Presence API → now through Supabase **Broadcast** (same zero-DB path as object move-deltas). Channel `cursor:${boardId}` uses `channel.send({ type:'broadcast', event:'cursor' })` for positions and `channel.track({ userId, name, color })` (Presence) for join/leave only.
- ✅ **Root cause 2:** Debounce only sent after user stopped moving. Switched to **33ms throttle** so positions stream continuously during movement.
- ✅ **Root cause 3:** Cursor divs used `left/top` style props (layout reflow per update). Switched to `transform: translate(x,y)` (GPU compositing) + `transition: transform 80ms linear` (interpolation bridges the network gap visually — cursor glides rather than jumps).
- ✅ **Stale cleanup:** `usePresence` 1s interval purges cursors not seen in 3s. Handles disconnect without Presence `leave`.
- Files changed: `presenceApi.ts`, `usePresence.ts`, `CursorOverlay.tsx`, `usePresence.test.ts`.

## Recent Changes (2026-02-18)

**FabricCanvas refactor (successful):**
- FabricCanvas.tsx was 1013 LOC (over hard max 1000). Extracted four modules to restore compliance with project rules:
  - `lib/fabricCanvasZOrder.ts` (102 LOC) — bringToFront, sendToBack, bringForward, sendBackward
  - `lib/fabricCanvasZoom.ts` (93 LOC) — createZoomHandlers (applyZoom, zoomToFit, handleWheel); MIN_ZOOM, MAX_ZOOM, ZOOM_STEP
  - `lib/fabricCanvasHistoryHandlers.ts` (88 LOC) — createHistoryEventHandlers factory
  - `lib/drawCanvasGrid.ts` (40 LOC) — tldraw-style 20px grid
- FabricCanvas.tsx now 777 LOC (under 1000 hard max). All 29 tests pass.
- App.test.tsx fixed: heading matcher updated to `/meboard/i` with `level: 1` (MeBoard rebrand; "Why MeBoard?" h2 also matched before).

**Canvas UX polish:**
- ✅ **Grid overlay** — tldraw-style grid (20px cells). GridOverlay.tsx behind FabricCanvas. Canvas background transparent; grid provides #fafafa + SVG pattern. Transform syncs with viewport.
- ✅ **Cursor position readout** — Bottom-left x/y in scene coords. CursorPositionReadout.tsx. onPointerMove fires always (not just when logged in); used for readout + presence.
- ✅ **Zoom slider** — Range input 25%–400%, log scale (zoomToSliderValue, sliderValueToZoom). WorkspaceToolbar. In addition to dropdown.

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

## Multi-selection move sync v2 — FIXED (2026-02-18)

**Goal:** All items end up in the right spot when moving a selection; other clients see moves with minimal lag.

**Status: Working.** Root cause was originX/originY vs calcTransformMatrix center mismatch. All shapes use `originX:'left', originY:'top'` but `calcTransformMatrix()` returns the object center. Writing center coords as left/top shifted objects by width/2 and height/2 on every apply. **Three fixes in boardSync.ts:** (1) `payloadWithSceneCoords` uses `util.addTransformToObject` + save/restore for correct origin conversion; (2) move-delta receiver uses `obj.left + dx` directly; (3) `applyRemote` skips objects in active selection to prevent sender echo corruption.

**Design (documented in PRD § Sync Strategy):** During drag broadcast `{ objectIds, dx, dy }`; on drop write absolute to documents. Single-object and Fabric Group (sticky) moves unchanged.

## Z-order nudge — DONE

**bringForward/sendBackward** — One step in z-order implemented in FabricCanvas + toolbar buttons. PRD §4 Object Capabilities.

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
- **Multi-selection move:** ✅ Fixed. Broadcast deltas during drag, absolute on drop. Origin-vs-center bug resolved (payloadWithSceneCoords uses addTransformToObject; move-delta receiver uses obj.left+dx; applyRemote skips active selection echo).
- **Z-order:** bringToFront/sendToBack implemented; bringForward/sendBackward (one step) done. PRD §4.
- **Boards page:** Grid of cards, last_accessed_at order. user_boards.last_accessed_at; joinBoard upserts it. Grid: gridAutoRows 130, columnGap 16, rowGap 20. Migration 20260218100000_user_boards_last_accessed.sql. Kebab menu: copy link, rename, delete. Replaces prior list layout (BoardListPage (list of user’s boards). Figma-inspired scope in memory-bank/boards-page-cleanup.md (layout, Workspace consistency, loading/empty, copy link, delete, rename, sort).
