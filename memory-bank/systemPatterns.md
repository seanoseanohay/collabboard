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

**Three-tier resolution (fastest first):**
1. **Local shape** (`detectSimpleShape`) — regex parses "draw/add/create/make a [color] [shape] [at X,Y]". Returns `source:'local'` instantly, zero network. Covers 13 color names + circle/rect/square/triangle/line/text/sticky and variants.
2. **Local template** (`detectTemplateLocally`) — regex matches pros-cons / swot / user-journey / retrospective / login-form / signup-form / contact-form. Returns `source:'template'` instantly, zero network.
3. **Edge Function + OpenAI** — all other prompts. `source:'api'`, returns `usage: { prompt_tokens, completion_tokens, total_tokens }`.

**Edge Function (ai-interpret):**
- Auth: `supabase.auth.getUser(token)` inside the function (gateway JWT verify disabled via `verify_jwt=false` in config.toml + `--no-verify-jwt` deploy flag — the function checks auth itself).
- Checks: signed-in user → board exists → user is board member (all before OpenAI call).
- System prompt: `SYSTEM_PROMPT_CORE` (~750 tokens) + `FORM_ADDENDUM` (~350 tokens, appended only when `isFormRequest(prompt)` is true — detects "form/field/input/checkout/wizard").
- `max_tokens: 300` (simple commands ~20-60 tokens; forms ~150-250 tokens).
- Logs `[ai-interpret] request` and `[ai-interpret] usage` to Supabase Edge Function logs.
- Returns `{ commands, usage }`.

**Observability:** LangSmith (`wrapOpenAI`) traces all OpenAI calls. Required Supabase secrets: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING_BACKGROUND=false` (critical — ensures flush before Edge Function exits), `LANGSMITH_PROJECT=meboard`.

## Presence / Cursors
- **Cursor positions: Supabase Broadcast** — same low-latency WebSocket path as object move-deltas. `channel.send({ type: 'broadcast', event: 'cursor', payload: { userId, x, y, name, color, lastActive } })`. Fire-and-forget, no server-side state reconciliation.
- **Online presence (join/leave): Supabase Presence** — `channel.track({ userId, name, color })` on same channel. Presence `leave` fires automatically on disconnect → removes peer from `others`. Presence `sync`/`join` populates a stub entry (`x:0, y:0, lastActive:0`) so the header shows all online users even before they move their mouse.
- **Channel:** single `cursor:${boardId}` channel with both Broadcast + Presence listeners. Same pattern as `move_deltas:${boardId}`.
- **Throttle:** 33ms (~30fps) with immediate first send — not debounce. Cursor updates stream during movement.
- **Stale cleanup — IMPORTANT:** 1s interval in `usePresence.ts` checks `lastActive < Date.now() - 3000`. On stale: **resets `lastActive → 0`** (does NOT remove the entry). This hides the canvas cursor (`CursorOverlay` skips `lastActive === 0`) without removing the user from the header presence list. Presence `leave` is the only thing that removes an entry from `others`. This means: idle users keep their header icon; crash/network loss users linger as `lastActive:0` stubs until Supabase Presence fires `leave` (~30–60s).
- **CursorOverlay rendering:** Uses `transform: translate(x, y)` (GPU compositing, no layout reflow) + `transition: transform 80ms linear` for interpolation. Skips entries with `lastActive === 0`.
- **Header presence avatars:** `WorkspacePage` shows up to 4 circular emoji icon buttons from `others`. Icon = `getPirateIcon(userId)` (exported from `CursorOverlay.tsx`, deterministic hash of userId → one of 5 pirate emoji). Hover = `title` tooltip with name. Click = `canvasZoomRef.current?.panToScene(o.x, o.y)` (centers viewport on that user's last cursor position). "+N" badge for overflow > 4. Count label ("X others") shown only on cluster hover via `presenceHovered` state. `panToScene(sceneX, sceneY)` on `FabricCanvasZoomHandle`: `vpt[4] = width/2 - sceneX*zoom`, `vpt[5] = height/2 - sceneY*zoom`.
- `presenceApi.ts` / `usePresence.ts` — single file pair owns cursor channel lifecycle.

## Public Boards
- `boards.is_public BOOLEAN NOT NULL DEFAULT false` controls visibility.
- **RLS rules:**
  - Any authenticated user can SELECT public boards (no board_members row required).
  - Any authenticated user can INSERT/UPDATE/DELETE documents on public boards.
  - `board_members` INSERT allowed for self-join to public boards.
  - `boards_select` policy: `board_members` OR `auth.uid() = owner_id` OR `is_public = true` — the owner clause is required so `INSERT ... RETURNING id` works before the board_members row is created.
- **Visibility toggle:** `update_board_visibility(board_id, new_value)` RPC checks `owner_id = auth.uid()` before updating. Frontend calls this RPC (not direct table update). UI restricts toggle to owner in both kebab menu and Share modal.

## Board Thumbnails
- **Storage:** Supabase Storage bucket `board-thumbnails` (public, no signed URLs needed).
- **Capture:** `FabricCanvasZoomHandle.captureDataUrl()` — saves/restores viewport, calls `zoomToFit`, returns `canvas.toDataURL('image/jpeg', 0.7)`. Scales down by 0.5 first for performance.
- **Timing:** Capture in `WorkspacePage.handleBack` (canvas still mounted) and `window.beforeunload`. Do NOT capture in `useEffect` cleanup — child canvas is disposed before parent cleanup runs.
- **Resize:** `thumbnailApi.resizeDataUrl(dataUrl, 400, 280)` — draws onto offscreen HTMLCanvasElement, returns Blob (JPEG 0.8).
- **Upload:** `saveBoardThumbnail(boardId, blob)` — uploads to `board-thumbnails/${boardId}.jpg`, then updates `boards.thumbnail_url` with public URL.

## Member Management
- `profiles(user_id PK, display_name, email, created_at)` — populated via `handle_new_user` trigger on `auth.users` INSERT. Backfill migration applies for existing users.
- `get_board_members(board_id UUID)` RPC — joins board_members + profiles, returns `user_id, display_name, email, is_owner, joined_at`. Owner-only accessible.
- `remove_board_member(board_id UUID, target_user_id UUID)` RPC — owner_id check, deletes from board_members and user_boards.

## Drawing Tool Interaction Pattern
**Universal rule** for all shape-creating tools (rect, circle, triangle, line, sticker, text, sticky note):
- `_currentTransform?.corner` is set → user is on a resize/rotate handle of the active object → pass through to Fabric (allow transform).
- Otherwise (body of any object, non-active object, empty space) → `discardActiveObject()` + begin creating new object.

Detection: `(fabricCanvas as { _currentTransform?: { corner?: string } })._currentTransform?.corner`

This replaces the old `if (target) return` guard which completely blocked drawing on top of existing objects.

## Code Structure
- Feature-sliced folder structure
- Single Responsibility Principle (SRP)
- No cross-feature imports except via interfaces
- File size target <400 LOC (hard max 1000 LOC)
- **FabricCanvas modules (2026-02-18):** Z-order, zoom/pan, history handlers, and grid drawing extracted from FabricCanvas.tsx into lib/fabricCanvasZOrder.ts, fabricCanvasZoom.ts, fabricCanvasHistoryHandlers.ts, drawCanvasGrid.ts. FabricCanvas composes these; keeps event orchestration and imperative handle.
