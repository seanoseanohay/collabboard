# Progress

## What Works
- PRD finalized (v4.7)
- Memory bank initialized
- Git repo with .gitignore, README
- **Project scaffolding** — Vite + React + TypeScript, tldraw, Firebase SDK, ESLint/Prettier/Husky, Jest + RTL
- Feature-sliced structure: `features/{auth,boards,workspace,ai}`, `shared/{lib/firebase,config}`
- Firebase config stub, `.env.example`, `firebase.json`, `database.rules.json`
- **Authentication** — Firebase Auth (Google + Email), LoginPage, useAuth, BoardListPage placeholder
- **Board list & CRUD** — createBoard, useUserBoards, BoardListPage, WorkspacePage placeholder, RTDB rules
- **Workspace** — tldraw canvas with shapes, sticky notes, text, selection (single + box)

## What's Left to Build

### MVP (Priority Order)
1. ~~**Project scaffolding**~~ ✅
2. ~~**Authentication**~~ ✅
3. ~~**Board list & CRUD**~~ ✅
4. ~~**Workspace**~~ ✅
5. **Sync** — RTDB delta sync, object-level patches, server timestamps
6. **Presence & cursors** — Multiplayer cursors with labels
7. **Locking** — Client-side disable + server-side RTDB transactions
8. **Selection** — Single + box-select
9. **AI Agent** — Cloud Function, Claude, serialized execution
10. **Deployment** — Vercel + Firebase

### Post-MVP
- Rotation (throttled ~50ms)
- Revocable invite links
- Touch-ready pointer handling
- 6+ AI commands with multi-step templates

## Current Status
**Phase:** Workspace complete (local canvas)  
**Next:** Sync (RTDB delta sync)

## Known Issues
None yet — implementation not started.
