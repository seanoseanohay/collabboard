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
- **FabricCanvas effect split:** Document sync in Effect 1 (deps: `[width, height, boardId]`). Lock sync in Effect 2 (deps: `[boardId, userId, userName]`). Prevents document subscription teardown when auth loads.
- Supabase upsert/insert for atomic updates
- Server timestamps for ordering
- Client-side UUID v4 for object IDs (`crypto.randomUUID()`)
- **Lines:** Created as Fabric Polyline (not Line); shapeFactory comment: Line has transform bugs (bounding box moves, path doesn't). No legacy Line boards; no migration needed.
- **Groups (sticky notes):** Structure `[bg, mainText]` (no placeholder text). Serialize with `toObject(['data', 'objects'])` to include children; update by setting properties separately (not remove/replace). On create, FabricCanvas auto-enters edit mode after 50ms so blinking cursor appears (tryEnterTextEditing + hiddenTextarea.focus()). Text scales with sticky size (updateStickyTextFontSize).
- zIndex: transactional increment / block reservation (post-MVP)
- **Multi-selection move sync v2 (working):** During drag broadcast selection-move delta on Realtime channel (`objectIds`, `dx`, `dy`); receivers apply delta locally (`obj.left + dx`). On drop (`object:modified`) write absolute left/top/angle/scale to documents per object via `payloadWithSceneCoords`. `applyRemote` skips objects in the active selection to prevent sender echo corruption. Goal: correct positions + low lag.
- **CRITICAL PATTERN — Origin vs Center in Fabric.js:** All shapes use `originX:'left', originY:'top'` (shapeFactory), meaning `left`/`top` are the left-edge/top-edge. But `calcTransformMatrix()` always returns a matrix whose translation is the object's **center** (via `getRelativeCenterPoint`). **Never write `qrDecompose(calcTransformMatrix()).translateX` directly as `left`** — this writes the center into an origin field, shifting objects by `width/2, height/2`. Instead: (a) for absolute position writes use `util.addTransformToObject` which calls `setPositionByOrigin(center, 'center', 'center')` to correctly convert; (b) for deltas, use `obj.left + dx` directly (delta is the same for center vs origin since the offset is constant during translation).
- **Z-order:** bringToFront/sendToBack + bringForward/sendBackward (one step) done. PRD §4.

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
