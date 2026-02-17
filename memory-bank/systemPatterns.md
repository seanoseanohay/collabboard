# System Patterns

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React +       │     │   Supabase      │     │   Supabase       │
│   Fabric.js     │────►│   Postgres +    │◄────│   Edge Fns      │
│   (canvas)      │     │   Realtime      │     │   (invite, AI)   │
└────────┬────────┘     │   (sync +       │     └─────────────────┘
         │              │    presence)    │
         │              └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         └─────────────►│   Supabase Auth  │
                        └─────────────────┘
```

## Sync Strategy (Critical)
- **Object-level deltas only** — never write full board state
- Fabric.js events: `object:added`, `object:removed`, `object:modified` (final) + `object:moving`, `object:scaling`, `object:rotating` (throttled 80ms for live drag) + `text:editing:exited` (text changes)
- documentsApi: single `event: '*'` postgres_changes subscription (avoid 3 separate INSERT/UPDATE/DELETE)
- FabricCanvas effect deps: `[width, height, boardId]` only—use refs for callbacks/lockOpts to prevent channel churn
- Supabase upsert/insert for atomic updates
- Server timestamps for ordering
- Client-side UUID v4 for object IDs (`crypto.randomUUID()`)
- **Groups (sticky notes):** Serialize with `toObject(['data', 'objects'])` to include children; update by setting properties separately (not remove/replace)
- zIndex: transactional increment / block reservation (post-MVP)

## Locking (High Risk)
- **Client:** Disable interaction on locked objects; show lock badge/overlay
- **Server:** RLS + row-level checks; writes rejected if lock held by another
- **Lifecycle:** Acquire on edit start; auto-release after 30s inactivity; heartbeat every 5s; `onDisconnect()` clears locks
- **AI:** Never overrides locks; skips locked objects and reports summary

## Conflict Resolution
- Last-write-wins using server timestamps
- Optimistic UI + reconciliation
- AI commands serialized per board

## AI Agent Execution Model
1. Cloud Function receives request
2. Per-board execution queue (serialized)
3. Reserve zIndex block via transaction
4. Plan in memory
5. Single atomic multi-path `.update()` (objects + metadata + checks)
6. Return summary

## Presence
- Supabase table `presence`: `{ board_id, user_id, x, y, name, color, last_active }`
- Update 50ms debounce; use payload directly on postgres_changes (no refetch)
- **Who's on board:** Subscribe to presence node → show list of names in header or sidebar
- **Cursors:** Overlay canvas or absolute divs for cursor dots + name labels
- `onDisconnect()` cleanup

## Code Structure
- Feature-sliced folder structure
- Single Responsibility Principle (SRP)
- No cross-feature imports except via interfaces
- File size target <400 LOC (hard max 1000 LOC)
