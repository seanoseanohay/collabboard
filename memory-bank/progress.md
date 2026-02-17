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
- Revocable invite links, touch handling, 6+ AI commands

## Current Status
**Phase:** MVP near complete. Very wide zoom (0.01%–10000%) in place for MVP. Locking and document sync working.
**Next:** Hand tool / two-finger pan / shortcuts (zoom/pan); shape-tool vs selection; or board loading performance.

## Known Issues
- **Shape tool vs selection** — When a shape tool is active (circle, rect, triangle, etc.), drawing inside an existing object (e.g. after zooming in) selects that object instead of creating a new shape. Selection should only occur when the select tool is active; with any shape tool, pointer down/drag should create the new shape, not select. Fix in FabricCanvas: when `selectedTool !== 'select'`, prevent selection (e.g. discard active object on draw start, or make objects non-selectable during shape-tool interaction). Do soon.
- **Board loading performance** — Fetches ALL objects upfront. Slow on boards with 50+ objects. Consider lazy loading or pagination.
- **Legacy Line objects** — Old Fabric Line objects have movement bug. New lines use Polyline.
- **StrictMode** — Removed from main.tsx (was causing Realtime channel churn). Re-add for prod if desired.

## Recently Fixed (2026-02-17)
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
