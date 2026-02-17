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
- **Authentication** — Supabase Auth, LoginPage, useAuth, BoardListPage
- **Board list & CRUD** — createBoard, useUserBoards, BoardListPage, WorkspacePage
- **Deployment** — Vercel, vercel.json (COOP header), auth debounce
- **Workspace** — Fabric.js canvas (FabricCanvas) with pan/zoom, replaces tldraw

## What's Left to Build

### MVP (Priority Order)
1. ~~**Project scaffolding**~~ ✅
2. ~~**Authentication**~~ ✅
3. ~~**Board list & CRUD**~~ ✅
4. ~~**Workspace** — Fabric.js canvas + pan/zoom~~ ✅
5. ~~**Shapes + toolbar**~~ ✅ (rect, circle, triangle, line, text, sticky; Delete key)
6. ~~**Viewport culling**~~ ✅ (Fabric skipOffscreen)
7. ~~**Sync**~~ ⚠️ implemented, NOT live with multiple users
8. ~~**Presence & cursors**~~ ⚠️ implemented, not verified in multi-user
9. **Locking** — ⚠️ implemented, NOT working
10. ~~**Board sharing**~~ ✅ joinBoard, share link, join-by-ID, RTDB members rule
11. **Google Auth** — Complete OAuth setup (SUPABASE_SETUP.md §5) — user manual steps
12. ~~**Selection**~~ ✅ — Single + box-select; pan = middle-click or Space+drag
13. ~~**AI Agent**~~ — Post-MVP
14. ~~**Deployment**~~ ✅ (Vercel live)

### Post-MVP
- AI agent (Supabase Edge Function, Claude)
- Undo/Redo
- Rotation (throttled ~50ms)
- Revocable invite links, touch handling, 6+ AI commands

## Recode Required

### 1. Dependencies ✅
- **Remove:** `tldraw`, `@tldraw/editor` — done
- **Add:** `fabric` (Fabric.js v7.1.0) — done
- **Update:** package.json, remove tldraw CSS import — done

### 2. Workspace — Fabric Canvas ✅
- Replace `WorkspacePage` Tldraw with Fabric.Canvas — done
- Implement **pan/zoom** (mouse wheel, drag-to-pan) — done
- Fabric wrapper: `FabricCanvas` in `features/workspace/components/` — done

### 3. Viewport Culling ✅
- Fabric.js built-in `skipOffscreen: true` (default) — uses vptCoords + isOnScreen()
- Explicitly set in FabricCanvas for 500+ object perf target

### 4. Shapes + Elements ✅
- Fabric primitives: Rect, Circle, Triangle, Polyline (line tool), Text — done
- Line: uses Polyline (2 points) not deprecated Line — Fabric Line has transform bug (box moves, path doesn't)
- Sticky notes: Fabric Text in colored Rect group — done
- Toolbar for create (rect, circle, triangle, line, text, sticky) — done
- Clean/flat styling, Delete key support — done

### 5. Delta Sync (Supabase) ✅
- Table: `documents(board_id, object_id, data)`
- documentsApi: writeDocument, deleteDocument, subscribeToDocuments
- boardSync: Fabric events → Supabase, Realtime postgres_changes → Fabric (enlivenObjects)
- Object IDs via data.id (UUID v4), server timestamps
- Fix: strip `type` from serialized obj before existing.set() to avoid Fabric warning

### 6. Presence & Cursors ✅
- presenceApi: writePresence, subscribeToPresence, setupPresenceDisconnect
- usePresence: debounced (100ms) updates, filters self from others
- CursorOverlay: scene→screen transform, cursor dots + name labels
- FabricCanvas: onPointerMove, onViewportChange callbacks
- RLS: presence table, member read, own-write only

### 7. Locking ✅
- locksApi: acquireLock, releaseLock, subscribeToLocks, setupLockDisconnect
- boardSync: acquire on selection:created, release on selection:cleared
- Client: selectable=false, hoverCursor=not-allowed on objects locked by others
- Server: RLS + locks table; write rejected unless no lock or lock matches auth.uid

### 8. Tests
- Remove tldraw mocks from `src/test/setup.ts`
- Add Fabric canvas mock or use jsdom + minimal Fabric stub
- Fabric-specific: 500-object stress test, presence latency under throttle

### 9. Security (RLS)
- ~~RLS for boards, board_members, user_boards~~ ✅
- ~~RLS for documents, locks, presence~~ ✅

## Current Status
**Phase:** User enabled Realtime (Publications → supabase_realtime → documents, locks, presence).  
**Next agent:** Test with 2 users—if sync works, fix locking. If not, debug subscribeToDocuments / Realtime.

## Known Issues
- **Real-time sync** — Was not working; user just enabled Publications. Test after browser refresh.
- **Locking not working** — No edit protection when two users select same object.
- **boardSync:** Fabric warns "Setting type has no effect" — strip `type` before `existing.set()`.
- **Legacy Line objects:** Old Fabric Line objects have movement bug. New lines use Polyline.
