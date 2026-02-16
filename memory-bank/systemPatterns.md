# System Patterns

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React +       │     │   Firebase      │     │   Firebase      │
│   tldraw SDK    │────►│   RTDB          │◄────│   Cloud Fns     │
│   v4.3.2        │     │   (sync +       │     │   (AI agent)    │
└────────┬────────┘     │    presence)    │     └─────────────────┘
         │              └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         └─────────────►│   Firebase Auth  │
                        └─────────────────┘
```

## Sync Strategy (Critical)
- **Object-level deltas only** — never write full board state
- tldraw store interceptors / `onChange` emit deltas
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

## Code Structure
- Feature-sliced folder structure
- Single Responsibility Principle (SRP)
- No cross-feature imports except via interfaces
- File size target <400 LOC (hard max 1000 LOC)
