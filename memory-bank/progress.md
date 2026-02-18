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
- AI agent (Supabase Edge Function, Claude)
- Undo/Redo
- Rotation (throttled ~50ms)
- ~~**Per-object stroke width (border thickness)**~~ ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils + FabricCanvas ref; sync via existing object:modified.
- Revocable invite links, touch handling, 6+ AI commands
- ~~**AI Client API**~~ ✅ — createObject, updateObject, deleteObjects, queryObjects in workspace/api/aiClientApi.ts; documentsApi: getDocument, fetchDocuments(criteria); exported from @/features/workspace. See docs/AI_CLIENT_API.md.

### Planned (sync + UX polish)
- **Multi-selection move sync v2** — During drag: broadcast selection-move delta (objectIds + dx, dy) on Realtime channel; other clients apply delta. On drop: write absolute positions to documents. Ensures correct final positions and low lag. PRD § Sync Strategy.
- **Bring forward / send backward** — One step in z-order (nudge in front of or behind adjacent object). PRD §4 Object Capabilities.

## Current Status
**Phase:** MVP complete. zIndex layering (bring to front / send to back), stroke width, toolbar, sync, locking, presence.
**Next:** Post-MVP (AI agent, Undo/Redo); or polish (revocable invites, etc.).

## Known Issues
- **Legacy Line objects (data only)** — Creation is fixed: all new lines use Polyline in shapeFactory.ts (Fabric Line has transform bugs: bounding box moves, path doesn't). Any board documents that were saved *before* this change may still have `type: 'line'` in the DB; when revived via enlivenObjects they become Fabric Line and can show the movement bug. No migration or revival-time conversion (Line → Polyline) exists yet; consider adding one in boardSync applyRemote if legacy boards are a concern.
- **StrictMode** — Removed from main.tsx (was causing Realtime channel churn in development). In dev, React StrictMode double-invokes effects: the document/lock/presence subscriptions run → cleanup (unsubscribe, removeChannel) → run again. That teardown/re-setup causes "channel churn": you briefly drop the Realtime subscription and re-create it, which can miss position updates from other users or cause reconnection lag when multiple people are moving objects. With StrictMode removed, effects run once in dev so no churn. **Production is unaffected** — StrictMode does not double-invoke in production builds, so re-adding `<React.StrictMode>` for prod is safe and gives StrictMode’s other benefits (e.g. detecting impure render side effects) without any churn.

## Recently Fixed (2026-02-17)
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
