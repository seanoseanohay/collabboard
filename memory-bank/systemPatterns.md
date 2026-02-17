# System Patterns

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React +       │     │   Firebase      │     │   Firebase      │
│   Fabric.js     │────►│   RTDB          │◄────│   Cloud Fns     │
│   (canvas)      │     │   (sync +       │     │   (AI post-MVP) │
└────────┬────────┘     │    presence)    │     └─────────────────┘
         │              └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         └─────────────►│   Firebase Auth  │
                        └─────────────────┘
```

## Sync Strategy (Critical)
- **Object-level deltas only** — never write full board state
- Fabric.js event listeners emit deltas (`object:modified`, `object:added`, `object:removed`)
- RTDB `.update()` multi-path writes for atomic updates
- Server timestamps via `.sv: "timestamp"` for ordering
- Client-side UUID v4 for object IDs (`crypto.randomUUID()`)
- zIndex: transactional increment / block reservation via transaction on `metadata.nextZIndex`

## Locking (High Risk)
- **Client:** Disable interaction on locked objects; show lock badge/overlay
- **Server:** RTDB transactions enforce lock ownership; writes rejected if lock held
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
- RTDB path: `presence/{boardId}/{userId}` or `boards/{boardId}/presence/{userId}`: `{ x, y, name, color, lastActive }`
- Update 100ms or mousemove (debounced)
- **Who's on board:** Subscribe to presence node → show list of names in header or sidebar
- **Cursors:** Overlay canvas or absolute divs for cursor dots + name labels
- `onDisconnect()` cleanup

## Code Structure
- Feature-sliced folder structure
- Single Responsibility Principle (SRP)
- No cross-feature imports except via interfaces
- File size target <400 LOC (hard max 1000 LOC)
