# Progress

## What Changed

- **Stack (v6.0):** Firebase → Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Canvas (v5.0):** tldraw → Fabric.js (BSD license)
- **Rationale:** tldraw v4+ requires trial/hobby/commercial license for deployed apps
- **Trade-off:** More custom sync/presence code; mitigated by viewport culling + delta-only strategy
- **Post-MVP:** AI agent, Undo/Redo (explicitly deferred)
- **PRD polish:** Why Fabric note, culling implementation details, presence schema, Fabric-specific tests

## What Works

- **Project scaffolding** — Vite + React + TypeScript, Supabase SDK, ESLint/Prettier/Husky, Jest + RTL
- Feature-sliced structure: `features/{auth,boards,workspace,ai}`, `shared/{lib/supabase,config}`
- Supabase config, `.env.example`, `supabase/migrations/`
- **Authentication** — Supabase Auth (Google + Email), LoginPage, useAuth, BoardListPage
- **Board list & CRUD** — createBoard, useUserBoards, BoardListPage, WorkspacePage
- **Deployment** — Vercel, vercel.json (COOP header), auth debounce
- **Workspace** — Fabric.js canvas (FabricCanvas) with pan/zoom; zoom range 0.001%–10000% (MVP)
- **Sticky notes** — Start empty (no placeholder). On create, edit mode opens automatically (blinking cursor, ready to type). Text scales with sticky size. Double-click existing sticky to edit.
- **Sync** — Live document sync; real-time position updates (object:moving/scaling/rotating, 80ms throttle)
- **Presence & cursors** — Working in multi-user
- **Locking** — Fully working: acquire on selection, release on deselection; objects locked by others are non-selectable; position updates sync while locking active

## What's Left to Build

### MVP (Priority Order)
1. ~~Project scaffolding~~ ✅
2. ~~Authentication~~ ✅
3. ~~Board list & CRUD~~ ✅
4. ~~Workspace~~ ✅
5. ~~Shapes + toolbar~~ ✅
6. ~~Viewport culling~~ ✅
7. ~~Sync~~ ✅
8. ~~Presence & cursors~~ ✅
9. ~~Locking~~ ✅
10. ~~Board sharing~~ ✅
11. ~~**Google Auth**~~ ✅ — Complete (user can log in with Google)
12. ~~**Presence awareness — "Who's on board"**~~ ✅ — Names in header ("X others viewing — Alice, Bob"); working as wanted.
13. ~~**Multi-selection move sync**~~ ✅ — boardSync syncs each object in selection (getObjectsToSync + pendingMoveIds).
14. ~~Selection~~ ✅
13. ~~AI Agent~~ — Post-MVP
14. ~~Deployment~~ ✅

- ~~**zIndex layering (MVP §4)**~~ ✅ — Bring to front / send to back. boardSync: getObjectZIndex/setObjectZIndex, sortCanvasByZIndex; zIndex in emitAdd/emitModify/applyRemote; FabricCanvas bringToFront/sendToBack; toolbar layer buttons when selection.

### Post-MVP
- ~~**AI agent**~~ ✅ — ai-interpret Edge Function (OpenAI gpt-4o-mini), AiPromptBar, invokeAiInterpret + executeAiCommands. Natural language → createObject/updateObject/deleteObjects via aiClientApi. OPENAI_API_KEY secret. Deploy: `supabase functions deploy ai-interpret`.
- Undo/Redo
- ~~Rotation (Task G)~~ ✅ — object:rotating hooked to emitModifyThrottled in boardSync.ts; rotation syncs live
- ~~**Per-object stroke width (border thickness)**~~ ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils + FabricCanvas ref; sync via existing object:modified.
- Revocable invite links, touch handling, 6+ AI commands
- ~~**AI Client API**~~ ✅ — createObject, updateObject, deleteObjects, queryObjects in workspace/api/aiClientApi.ts; documentsApi: getDocument, fetchDocuments(criteria); exported from @/features/workspace. See docs/AI_CLIENT_API.md.
- ~~**AI Client API docs (Task B)**~~ ✅ — docs/AI_CLIENT_API.md updated: marked "Implemented (client + Edge Function)", import examples, usage examples. Edge Function (supabase/functions/ai-canvas-ops/index.ts) + frontend wrapper (aiCanvasOpsEdgeApi.ts) + barrel export all in place.

### Planned (sync + UX polish)
- ~~**Multi-selection move sync v2**~~ ✅ — Fixed. During drag: broadcast selection-move delta (objectIds + dx, dy) on Realtime channel; other clients apply delta. On drop: write absolute positions to documents. Origin-vs-center bug resolved (see Recently Fixed).
- ~~**Bring forward / send backward (Task F)**~~ ✅ — bringForward/sendBackward implemented in FabricCanvas.tsx + toolbar buttons in WorkspaceToolbar.tsx. One step in z-order working.
- ~~**Boards page cleanup**~~ ✅ — Done. Then redesigned as **grid of cards** (not list): ordered by last_accessed_at; user_boards.last_accessed_at migration (20260218100000); joinBoard upserts it; formatLastAccessed "Opened X ago". Grid: gridAutoRows 130, columnGap 16, rowGap 20. Alignment fixes. Kebab menu: copy link, rename, delete.

## Current Status
**Phase:** MVP complete. zIndex layering (bring to front / send to back), stroke width, toolbar, sync, locking, presence.
**Next:** Post-MVP (AI agent, Undo/Redo); or polish (revocable invites, etc.).

## Known Issues
- ~~**Multi-selection move drift**~~ ✅ FIXED — See Recently Fixed below.
- ~~**StrictMode (Task C)**~~ ✅ FIXED — Re-added conditionally: `import.meta.env.PROD ? <StrictMode>{app}</StrictMode> : app` in main.tsx. Dev skips StrictMode (avoids Realtime channel churn). Prod gets StrictMode safety checks. Previously removed because in dev, React StrictMode double-invokes effects: the document/lock/presence subscriptions run → cleanup (unsubscribe, removeChannel) → run again. That teardown/re-setup causes "channel churn": you briefly drop the Realtime subscription and re-create it, which can miss position updates from other users or cause reconnection lag when multiple people are moving objects. With StrictMode removed, effects run once in dev so no churn. **Production is unaffected** — StrictMode does not double-invoke in production builds, so re-adding `<React.StrictMode>` for prod is safe and gives StrictMode’s other benefits (e.g. detecting impure render side effects) without any churn.

## Recently Fixed (2026-02-17 / 2026-02-18)
- ✅ **Boards grid redesign** — Grid of cards (not list), ordered by last_accessed_at. Migration 20260218100000_user_boards_last_accessed.sql; BoardMeta.lastAccessedAt; joinBoard upserts last_accessed_at; formatLastAccessed "Opened X ago". Grid: gridAutoRows 130, columnGap 16, rowGap 20. Alignment fixes for row spacing.
- ✅ **Lock log cleanup** — Removed verbose [LOCKS], [FABRIC], [APPLYLOCK] logs. Only log CHANNEL_ERROR/TIMED_OUT (skip CLOSED when intentional). locksApi.ts, boardSync.ts, FabricCanvas.tsx.
- ✅ **Multi-selection move drift** — Root cause: all shapes use `originX:'left', originY:'top'`, but `calcTransformMatrix()` returns the object **center** (via `getRelativeCenterPoint`). Using `qrDecompose(calcTransformMatrix()).translateX` as `left` wrote the center into an origin field, shifting objects right by `width/2` and down by `height/2` on every apply. **Three fixes in boardSync.ts:** (1) `payloadWithSceneCoords` now uses Fabric's `addTransformToObject` + save/restore so origin is correctly converted via `setPositionByOrigin`; (2) move-delta receiver uses `obj.left + dx` directly instead of calcTransformMatrix center; (3) `applyRemote` skips objects in the active selection to prevent sender's own postgres_changes echo from corrupting group-relative positions.
- ✅ **Boards page cleanup** — Figma-inspired: header aligned with Workspace, loading skeletons, empty state, card-style rows, kebab menu (Copy share link, Rename inline, Delete with confirm). boardsApi: updateBoardTitle, deleteBoard; RLS boards_delete (owner only). useUserBoards returns { boards, loading }.
- ✅ **Sticky notes UX** — No placeholder; on create, auto-enter edit (50ms delay, tryEnterTextEditing + hiddenTextarea.focus()) so blinking cursor appears. shapeFactory sticky = [bg, mainText] only.
- ✅ **Stroke width** — strokeUtils, StrokeControl, onSelectionChange, setActiveObjectStrokeWidth; toolbar shows Stroke dropdown when selection has stroke.
- ✅ **Toolbar + header aesthetic** — Icon tool groups, dividers, tldraw-like styling; header buttons aligned.
- ✅ **Shape tool vs selection** — With any shape tool active, pointer-down always starts drawing (never selects). FabricCanvas: discardActiveObject + draw start regardless of target.
- ✅ **Hand tool** — New toolbar tool; left-drag always pans (cursor: grab). No selection when hand active.
- ✅ **Zoom shortcuts** — +/= zoom in, − zoom out, 0 = fit to content, 1 = 100%. FabricCanvas handleKeyDown.
- ✅ **Zoom UI** — Toolbar zoom dropdown (25%, 50%, 100%, 200%, 400%, Fit). FabricCanvas ref exposes setZoom/zoomToFit; WorkspacePage wires ref + viewport zoom.
- ✅ **Board loading** — Paginated initial fetch (documentsApi): PAGE_SIZE 50, order by object_id, range(); first batch applied immediately, rest in sequence so UI stays responsive.
- ✅ Zoom (MVP) — Very wide zoom range 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100); FabricCanvas. Figma-like infinite canvas.
- ✅ **Trackpad pan/zoom** — Two-finger scroll = pan (relativePan); pinch = zoom at cursor (handleWheel ctrlKey branch). Pinch sensitivity 0.006 (deltaY multiplier). FabricCanvas.tsx.
- ✅ Multi-selection move sync (scene coords) — Objects in selection were synced with group-relative coords → others saw them disappear during move and in wrong place on drop. Now payloadWithSceneCoords() uses qrDecompose(calcTransformMatrix()) so we sync absolute left/top/angle/scale.
- ✅ Multi-selection move sync — Moving multiple selected objects (circle + triangle) now syncs; boardSync getObjectsToSync + pendingMoveIds
- ✅ Presence awareness — Header shows "X others viewing — Alice, Bob"; working as wanted
- ✅ Locking + document sync — Split FabricCanvas effect so document sync persists when auth loads; lock sync in separate effect
- ✅ Locking enabled — userId/userName in lock sync effect deps; boardSync refactored to setupDocumentSync + setupLockSync
- ✅ Text rotation — objects no longer enter edit mode during transform
- ✅ layoutManager serialization — removed from toObject() calls
- ✅ Ghost click zone — setCoords() + reapply lock state after remote updates
- ✅ Optimistic locking, broadcast for instant propagation
- ✅ INSERT instead of UPSERT — database enforces mutual exclusion
