# CollabBoard PRD

**Version:** 5.0\
**Date:** February 16, 2026\
**Project Context:** Gauntlet AI G4 Week 1 — Real-Time Collaborative
Whiteboard with AI Agent\
**Goal:** Bulletproof multiplayer sync + reliable AI agent in a 7-day
sprint. Project completion required for Austin admission.

**Revision (v5.0):** Replaced tldraw SDK with Fabric.js due to licensing
constraints. tldraw v4+ requires production license; Fabric.js is BSD-licensed.
Visual style targets tldraw-like clean/flat aesthetic where possible.

**Why Fabric:** Chose Fabric.js over tldraw due to production licensing
requirements on tldraw v4+ (trial/hobby/commercial key needed for deployed
apps). Fabric.js (BSD-3) is fully free/open, allowing unrestricted public
deployment for this educational project. Trade-off: more custom sync/presence
code, mitigated by viewport culling and delta-only strategy.

------------------------------------------------------------------------

## 0. Architecture Decisions (Chosen Stack)

**Frontend --- React + Fabric.js**\
- Infinite canvas with viewport culling (only render objects in view)\
- Pan / Zoom\
- Shapes, Sticky Notes, Text\
- Selection (single + box)\
- Transforms (move, resize; rotate post-MVP)\
- Delete\
- Multiplayer cursors + presence\
- Visual style: Clean, flat (tldraw-like)\
- **API-first (Post-MVP):** All canvas and board actions executable via documented client-side API; enables AI assistants to perform same operations as UI. See §0.3 AI Client API.

**Sync / Backend / Persistence --- Firebase Realtime Database (RTDB)**\
- Delta-only object patches\
- Presence & cursors\
- Graceful reconnect\
- Object IDs: Client-side UUID v4 (`crypto.randomUUID()` or `uuid` lib)\
- Deterministic IDs for optimistic creation

**Authentication --- Firebase Auth (Google + Email)**

**AI Integration --- Anthropic Claude (function calling)** — Post-MVP\
- Fallback: OpenAI GPT-4o-mini

**Deployment --- Vercel (frontend) + Firebase (RTDB/auth/rules + Cloud
Functions)**

------------------------------------------------------------------------

## 0.1 Performance: Viewport Culling

- Only render/draw objects whose bounds intersect the visible viewport
- **Implementation:**
  - Use Fabric's `viewportTransform` to compute current visible bounds
  - In render loop or `requestRenderAll` hook: filter objects by
    intersection with viewport rect
  - Set `object.visible = false` for off-screen objects → dramatically
    reduce draw calls
  - Test with 500+ objects generated via script (rapid creation stress)
- Required for 500+ objects without degradation

------------------------------------------------------------------------

## Sync Strategy (Critical)

-   Fabric.js event listeners (`object:modified`, `selection:created`, etc.)
    emit **object-level deltas only**
-   Never write full board state
-   Use RTDB `.update()` multi-path writes for atomic updates
-   Server timestamps via `.sv: "timestamp"` for ordering
-   zIndex management: transactional increment / block reservation via
    transaction on `metadata.nextZIndex`

### Multi-selection / group move sync (planned)

To ensure **all items end up in the right spot** when moving a selection and **minimal lag** for other clients:

- **During drag:** Do not rely on throttled document writes for live updates. Broadcast a **selection-move delta** on a dedicated Realtime channel: `{ objectIds: string[], dx, dy }` (optionally `dAngle`, `dScale`). Other clients apply the same delta to each object locally (e.g. `left += dx`, `top += dy`). No document writes during drag → low latency.
- **On drop (object:modified):** Write **absolute** `left`, `top`, `angle`, `scaleX`, `scaleY` to the documents table for each object (one update per object). This is the persisted source of truth and corrects any drift; late joiners load from documents.

Single-object moves and Fabric Groups (e.g. sticky notes) continue to sync via existing document updates. Bring forward / send backward (one step in z-order) remain post-MVP polish.

------------------------------------------------------------------------

## 0.2 Development Practices & Coding Standards

-   Single Responsibility Principle (SRP)
-   File size target \<400 LOC (hard max 1000 LOC)
-   Feature-sliced folder structure
-   No cross-feature imports except via interfaces
-   Jest + React Testing Library
-   ESLint + Prettier + Husky
-   AI-first development (Cursor + Claude) with human review

------------------------------------------------------------------------

## 0.3 AI Client API (Post-MVP)

All app actions must be API-callable so AI can drive the canvas.

- **createObject(boardId, type, props)** — Create rect, circle, text, sticky, etc.
- **updateObject(boardId, objectId, partialProps)** — Patch fill, stroke, stroke
  weight (border thickness), font, etc.
- **deleteObjects(boardId, objectIds)** — Single or mass delete
- **queryObjects(boardId, criteria?)** — Find objects by properties

UI and AI share this API. Document Fabric payload schema for server-side AI (Edge Function) if needed.

------------------------------------------------------------------------

## 1. Application Flow

1.  Login (Google / Email)
2.  Board List
3.  Create / Select Board / Join Board (share link or board ID) — **required
    before collaboration features can be tested**
4.  Workspace

**Security Model** - Private by default - Multiple boards per user - Board
sharing via invite link in MVP (revocable post-MVP) - RTDB rules deny
read/write if not member - No guest access in MVP

------------------------------------------------------------------------

## 2. MVP Requirements (24-Hour Hard Gate)

-   **Board sharing** — ≥2 users can access the same board (share link or
    join-by-ID). *Implementation prerequisite for all collaboration features.*
-   Infinite canvas with smooth pan/zoom — **Zoom range MVP:** very wide zoom
    (0.001%–10000%+). See §2.1 Zoom & Pan.
-   Real-time sync (≥2 users)
-   Multiplayer cursors with labels
-   Presence awareness
-   Full-object locking
-   Basic selection (single + box-select)
-   Authentication required
-   Public Vercel deployment

### 2.1 Zoom & Pan (Figma-like)

**MVP (implemented):** Very wide zoom range 0.001%–10000%+ for infinite-canvas
feel. Zoom at cursor; smooth and quick. FabricCanvas MIN_ZOOM = 0.00001 (0.001%),
MAX_ZOOM = 100 (10000%).

**Planned (post–MVP or next):**

- **Hand tool** — Toolbar tool; when selected, left-drag always pans (never
  selects or moves objects). Select tool keeps current behavior (move/select,
  Space+drag to pan).
- **Trackpad** — Two-finger drag = pan; pinch / Ctrl+wheel = zoom (Figma-like). Implemented; pinch sensitivity tuned (deltaY × 0.006).
- **Infinite pan** — No hard bounds on viewport pan.
- **Shortcuts** — Space+drag = temporary pan (any tool); +/- = zoom in/out;
  0 = fit to screen; 1 = 100%.
- **Zoom UI** — Zoom dropdown (25%/50%/100%/200%/400%, Fit) + zoom slider
  (25%–400%, log scale). Implemented.
- **Canvas grid** — tldraw-style grid overlay (20px cells). Implemented.
- **Cursor position** — Scene coords readout (x, y) bottom-left. Implemented.

### Implementation Priority

**Board sharing must be implemented first** (or early in the MVP). Without it,
multiple users cannot access the same board, which blocks testing of:

-   Real-time sync (≥2 users)
-   Multiplayer cursors
-   Presence awareness
-   Full-object locking

Locking blocks objects when selected; that behavior cannot be verified until
2+ users can view and interact with the same board.

------------------------------------------------------------------------

## 3. Supported Object Types (MVP)

### Shapes

-   Rectangle / Square
-   Circle
-   Triangle
-   Line (minimal connector)

### Elements

-   Sticky Notes (editable text, color)
-   Standalone Text

Rotation excluded from MVP (post-MVP support).

------------------------------------------------------------------------

## 4. Object Capabilities

-   Create
-   Move
-   Resize
-   Change Color
-   Change stroke width (border thickness) — User can select any object and change
    its border thickness via UI (e.g. dropdown, slider). Stored as nominal
    stroke weight (screen pixels at 100%) for zoom-invariant appearance.
-   Delete
-   zIndex layering (bring to front / send to back)
-   **Bring forward / send backward (planned)** — One step in z-order (nudge in front of or behind adjacent object), in addition to full bring-to-front / send-to-back
-   Inline text editing

### Post-MVP

-   Rotate (throttled delta updates \~50ms)
-   Undo / Redo

------------------------------------------------------------------------

## 5. Real-Time Collaboration Requirements

-   Object sync latency \<100 ms
-   Cursor sync latency \<50 ms
-   Support 5+ concurrent users
-   Refresh persistence
-   Graceful reconnect

### Presence / Cursors Implementation

-   **Presence:** RTDB `/presence/{boardId}/{userId}` node with
    `{ x, y, name, color, lastActive }`
-   Update every 100ms or on mousemove (debounced)
-   Render overlay canvas or absolute-positioned divs for cursor dots +
    name labels
-   Clean up on disconnect via `onDisconnect()` or TTL

### Conflict Resolution

-   Last-write-wins using server timestamps
-   Optimistic UI + reconciliation
-   AI commands serialized per board (when AI is implemented)

### 5.1 Board Sharing (MVP Prerequisite)

Collaboration features (sync, cursors, presence, locking) require ≥2 users on
the same board. MVP must include at least one of:

-   **Shareable link** — URL that adds the visitor as a board member when
    opened (e.g. `/board/{boardId}/invite/{token}` or join flow)
-   **Join by board ID** — authenticated user can enter a board ID and be
    added as member if the board exists and they are invited

**Implementation:** Add invited user to
`boards/{boardId}/members/{userId}` and `user_boards/{userId}/{boardId}`.
RTDB rules already enforce member access.

**Post-MVP:** Revocable links, per-link expiry, owner-only revocation.

------------------------------------------------------------------------

## 6. Locking Behavior (High Risk Area)

### Dual-Layer Enforcement

**Client-Side** - Disable interaction on locked objects - Show lock
badge / overlay

**Server-Side** - RTDB transactions enforce lock ownership - Writes
rejected if lock held

**Rule:** User A cannot move or edit what User B is editing.

### Lock Lifecycle

-   Acquired transactionally on edit start
-   Auto-release after 30s inactivity
-   Heartbeat every 5 seconds during active edit (debounced)
-   `onDisconnect()` clears locks on disconnect
-   Owner override available (transactional)

### AI Interaction (Post-MVP)

-   AI never overrides locks
-   Skips locked objects and reports summary

------------------------------------------------------------------------

## 7. AI Board Agent (Post-MVP)

**Client API prerequisite:** AI commands (create, update, delete, query) route through the AI Client API layer. See §0.3.

### Entry Point

All AI commands routed through Firebase Cloud Function (HTTP/callable)
for server-side serialization.

### Execution Model

1.  Cloud Function receives request
2.  Per-board execution queue (serialized)
3.  Reserve zIndex block via transaction
4.  Plan in memory
5.  Single atomic multi-path `.update()` (objects + metadata + checks)
6.  Return summary

### Guarantees

-   No partial state on failure
-   Entire batch fails on conflict
-   UI loading indicator (\>2s warning at 3s)
-   Never cancel mid-write
-   Client reconciles via RTDB subscription

### Logging & Rate Limiting

-   Log: userId, command, token counts (exact), success/failure, summary
-   **Observability:** LangSmith traces all AI calls (inputs, outputs, tokens, latency, errors) at smith.langchain.com
-   Rate limit: 5 commands per user per minute

### Post-MVP Stretch

-   `rotateObject(objectId, angleInRadians)`

------------------------------------------------------------------------

## 8. Performance Targets

-   60 FPS during pan/zoom/manipulation
-   500+ objects without degradation (viewport culling required)
-   Stable under 50 kbps network throttling
-   5+ concurrent users stable

### Sync Constraint

-   Minimal Fabric.js object updates from remote
-   No full document resync
-   Rotation deltas throttled (\~50ms)

------------------------------------------------------------------------

## 9. Testing Requirements (TDD)

### Core Spec Scenarios

-   2 users editing simultaneously
-   Refresh mid-edit
-   Rapid object creation / movement
-   5 concurrent users
-   Simultaneous AI commands (when AI implemented)

### High-Risk Edge Cases

-   Lock race (two users → one wins)
-   Owner override
-   AI batch failure → no partial state
-   zIndex collision under concurrency
-   Disconnect mid-lock → cleared via `onDisconnect()`
-   Non-member read/write attempt rejected
-   Network drop → reconnect → consistent state
-   AI command during refresh → no double execution
-   Long AI command → loading UI, no partial state
-   Active edit \>30s → heartbeat maintains lock

### Coverage

-   Unit: pure utils/services (aim 100%)
-   Integration: locking, selection, AI batch flows

### Fabric-Specific Tests

-   500-object stress test with viewport culling → maintain 60 FPS
-   Presence lag under throttling → cursors update \<50ms

------------------------------------------------------------------------

## 10. Definition of Done

### MVP Complete When

-   **Board sharing works** — 2+ users can open the same board; unblocks
    testing of all collaboration features
-   Cross-browser real-time sync works
-   Dual-layer locking prevents corruption
-   Selection enables core operations
-   Private access enforced via RTDB rules
-   Public deployment live
-   Code follows SRP + file limits
-   Viewport culling implemented

### Production Complete When

-   AI Client API implemented (createObject, updateObject, deleteObjects, queryObjects)
-   6+ reliable AI commands (including multi-step templates)
-   Performance targets met
-   Object rotation fully supported (UI + programmatic + synced)
-   Undo / Redo implemented
-   AI usage logged with exact token counts (via LangSmith tracing)
-   Touch-ready pointer handling
-   New features addable in \<1 day (modular structure)
