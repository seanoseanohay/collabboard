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
- **Workspace** — Fabric.js canvas (FabricCanvas) with pan/zoom; zoom range 0.01%–10000% (MVP)
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

### Post-MVP
- AI agent (Supabase Edge Function, Claude)
- Undo/Redo
- Rotation (throttled ~50ms)
- ~~**Per-object stroke width (border thickness)**~~ ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils + FabricCanvas ref; sync via existing object:modified.
- Revocable invite links, touch handling, 6+ AI commands
- **AI Client API** — createObject, updateObject, deleteObjects, queryObjects so all app actions are API-callable (enables AI-driven canvas operations). See docs/AI_CLIENT_API.md.

## Current Status
**Phase:** MVP complete. Stroke width control and tldraw-style toolbar (icon groups, stroke dropdown) are in place.
**Next:** Post-MVP (AI agent, Undo/Redo); or polish (two-finger/touch pan/zoom, revocable invites).

## Known Issues
- **Legacy Line objects** — Old Fabric Line objects have movement bug. New lines use Polyline.
- **StrictMode** — Removed from main.tsx (was causing Realtime channel churn). Re-add for prod if desired.

## Recently Fixed (2026-02-17)
- ✅ **Stroke width** — strokeUtils, StrokeControl, onSelectionChange, setActiveObjectStrokeWidth; toolbar shows Stroke dropdown when selection has stroke.
- ✅ **Toolbar + header aesthetic** — Icon tool groups, dividers, tldraw-like styling; header buttons aligned.
- ✅ **Shape tool vs selection** — With any shape tool active, pointer-down always starts drawing (never selects). FabricCanvas: discardActiveObject + draw start regardless of target.
- ✅ **Hand tool** — New toolbar tool; left-drag always pans (cursor: grab). No selection when hand active.
- ✅ **Zoom shortcuts** — +/= zoom in, − zoom out, 0 = fit to content, 1 = 100%. FabricCanvas handleKeyDown.
- ✅ **Zoom UI** — Toolbar zoom dropdown (25%, 50%, 100%, 200%, 400%, Fit). FabricCanvas ref exposes setZoom/zoomToFit; WorkspacePage wires ref + viewport zoom.
- ✅ **Board loading** — Paginated initial fetch (documentsApi): PAGE_SIZE 50, order by object_id, range(); first batch applied immediately, rest in sequence so UI stays responsive.
- ✅ Zoom (MVP) — Very wide zoom range 0.01%–10000% (MIN_ZOOM 0.0001, MAX_ZOOM 100); FabricCanvas. Figma-like infinite canvas.
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
