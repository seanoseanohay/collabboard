# Progress

## What Changed (PRD v5.0)

- **Canvas:** tldraw → Fabric.js (BSD license, no production key required)
- **Rationale:** tldraw v4+ requires trial/hobby/commercial license for deployed apps
- **Trade-off:** More custom sync/presence code; mitigated by viewport culling + delta-only strategy
- **Post-MVP:** AI agent, Undo/Redo (explicitly deferred)
- **PRD polish:** Why Fabric note, culling implementation details, presence schema, Fabric-specific tests

## What Works

- **Project scaffolding** — Vite + React + TypeScript, Firebase SDK, ESLint/Prettier/Husky, Jest + RTL
- Feature-sliced structure: `features/{auth,boards,workspace,ai}`, `shared/{lib/firebase,config}`
- Firebase config, `.env.example`, `firebase.json`, `database.rules.json`
- **Authentication** — Firebase Auth, LoginPage, useAuth, BoardListPage
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
7. ~~**Sync**~~ ✅ RTDB delta sync, object-level patches, server timestamps
8. ~~**Presence & cursors**~~ ✅ presenceApi, usePresence, CursorOverlay, "N others viewing"
9. ~~**Locking**~~ ✅ locksApi, acquire on select, release on deselect, server rejects writes
10. **Selection** — Single + box-select (Fabric built-in)
11. ~~**AI Agent**~~ — Post-MVP
12. ~~**Deployment**~~ ✅ (Vercel live)

### Post-MVP
- AI agent (Cloud Function, Claude)
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

### 5. Delta Sync (RTDB) ✅
- Path: `boards/{boardId}/documents/{objectId}`
- documentsApi: writeDocument, deleteDocument, subscribeToDocuments
- boardSync: Fabric events → RTDB, RTDB child_* → Fabric (enlivenObjects)
- Object IDs via data.id (UUID v4), server timestamps
- Fix: strip `type` from serialized obj before existing.set() to avoid Fabric warning

### 6. Presence & Cursors ✅
- presenceApi: writePresence, subscribeToPresence, setupPresenceDisconnect
- usePresence: debounced (100ms) updates, filters self from others
- CursorOverlay: scene→screen transform, cursor dots + name labels
- FabricCanvas: onPointerMove, onViewportChange callbacks
- RTDB rules: presence path, member read, own-write only

### 7. Locking ✅
- locksApi: acquireLock, releaseLock, subscribeToLocks, setupLockDisconnect
- boardSync: acquire on selection:created, release on selection:cleared
- Client: selectable=false, hoverCursor=not-allowed on objects locked by others
- Server: documents write rejected unless no lock or lock.userId === auth.uid

### 8. Tests
- Remove tldraw mocks from `src/test/setup.ts`
- Add Fabric canvas mock or use jsdom + minimal Fabric stub
- Fabric-specific: 500-object stress test, presence latency under throttle

### 9. Database Rules
- ~~Add rules for `boards/{boardId}/documents`~~ ✅ (member read/write)
- ~~Add rules for `presence/{boardId}/{userId}`~~ ✅ (member read, own write)
- ~~Add rules for locks path~~ ✅ (boards/$boardId/locks/$objectId)

## Current Status
**Phase:** Locking complete — dual-layer (client + server)  
**Next:** Selection polish, tests, or deploy rules (firebase deploy --only database)

## Known Issues
- **boardSync:** Fabric warns "Setting type has no effect" when applying remote updates — strip `type` from serialized object before `existing.set()` (type is read-only)
- **Legacy Line objects:** Boards created before the fix may have old Fabric Line objects; those still have the movement bug. New lines use Polyline.
