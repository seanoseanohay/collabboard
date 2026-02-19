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

**Observability:** LangSmith traces all ai-interpret LLM calls (inputs, outputs, tokens, latency, errors). Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` in Supabase Edge Function secrets.

## Presence / Cursors
- **Cursor positions: Supabase Broadcast** — same low-latency WebSocket path as object move-deltas. `channel.send({ type: 'broadcast', event: 'cursor', payload: { userId, x, y, name, color, lastActive } })`. Fire-and-forget, no server-side state reconciliation.
- **Online presence (join/leave): Supabase Presence** — `channel.track({ userId, name, color })` on same channel. Presence `leave` fires automatically on disconnect → removes peer from `others`. Presence `sync`/`join` populates a stub entry (`x:0, y:0, lastActive:0`) so the header shows all online users even before they move their mouse.
- **Channel:** single `cursor:${boardId}` channel with both Broadcast + Presence listeners. Same pattern as `move_deltas:${boardId}`.
- **Throttle:** 33ms (~30fps) with immediate first send — not debounce. Cursor updates stream during movement.
- **Stale cleanup — IMPORTANT:** 1s interval in `usePresence.ts` checks `lastActive < Date.now() - 3000`. On stale: **resets `lastActive → 0`** (does NOT remove the entry). This hides the canvas cursor (`CursorOverlay` skips `lastActive === 0`) without removing the user from the header presence list. Presence `leave` is the only thing that removes an entry from `others`. This means: idle users keep their header icon; crash/network loss users linger as `lastActive:0` stubs until Supabase Presence fires `leave` (~30–60s).
- **CursorOverlay rendering:** Uses `transform: translate(x, y)` (GPU compositing, no layout reflow) + `transition: transform 80ms linear` for interpolation. Skips entries with `lastActive === 0`.
- **Header presence avatars:** `WorkspacePage` shows up to 4 circular emoji icon buttons from `others`. Icon = `getPirateIcon(userId)` (exported from `CursorOverlay.tsx`, deterministic hash of userId → one of 5 pirate emoji). Hover = `title` tooltip with name. Click = `canvasZoomRef.current?.panToScene(o.x, o.y)` (centers viewport on that user's last cursor position). "+N" badge for overflow > 4. Count label ("X others") shown only on cluster hover via `presenceHovered` state. `panToScene(sceneX, sceneY)` on `FabricCanvasZoomHandle`: `vpt[4] = width/2 - sceneX*zoom`, `vpt[5] = height/2 - sceneY*zoom`.
- `presenceApi.ts` / `usePresence.ts` — single file pair owns cursor channel lifecycle.

## Code Structure
- Feature-sliced folder structure
- Single Responsibility Principle (SRP)
- No cross-feature imports except via interfaces
- File size target <400 LOC (hard max 1000 LOC)
- **FabricCanvas modules (2026-02-18):** Z-order, zoom/pan, history handlers, and grid drawing extracted from FabricCanvas.tsx into lib/fabricCanvasZOrder.ts, fabricCanvasZoom.ts, fabricCanvasHistoryHandlers.ts, drawCanvasGrid.ts. FabricCanvas composes these; keeps event orchestration and imperative handle.
