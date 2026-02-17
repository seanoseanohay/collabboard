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
8. **Presence & cursors** — RTDB `/presence/{boardId}/{userId}`, overlay rendering
9. **Locking** — Client + server (object-level)
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
- Fabric primitives: Rect, Circle, Triangle, Line, Text — done
- Sticky notes: Fabric Text in colored Rect group — done
- Toolbar for create (rect, circle, triangle, line, text, sticky) — done
- Clean/flat styling, Delete key support — done

### 5. Delta Sync (RTDB) ✅
- Path: `boards/{boardId}/documents/{objectId}`
- documentsApi: writeDocument, deleteDocument, subscribeToDocuments
- boardSync: Fabric events → RTDB, RTDB child_* → Fabric (enlivenObjects)
- Object IDs via data.id (UUID v4), server timestamps

### 6. Presence & Cursors
- RTDB path: `/presence/{boardId}/{userId}` → `{ x, y, name, color, lastActive }`
- Update on mousemove (debounced) or every 100ms
- Overlay canvas or absolute divs for cursor dots + labels
- `onDisconnect()` cleanup

### 7. Locking
- RTDB path for locks (e.g. `boards/{boardId}/locks/{objectId}`)
- Client: disable Fabric interaction on locked objects, show lock overlay
- Server: RTDB rules reject writes if lock held by another user

### 8. Tests
- Remove tldraw mocks from `src/test/setup.ts`
- Add Fabric canvas mock or use jsdom + minimal Fabric stub
- Fabric-specific: 500-object stress test, presence latency under throttle

### 9. Database Rules
- Add rules for `presence/{boardId}/{userId}` (member write own presence)
- Add rules for `boards/{boardId}/documents` (member read/write)
- Add rules for locks path

## Current Status
**Phase:** RTDB delta sync complete — real-time object sync  
**Next:** Presence & cursors

## Known Issues
- None
