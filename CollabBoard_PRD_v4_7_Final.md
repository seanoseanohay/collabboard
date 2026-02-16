# CollabBoard PRD

**Version:** 4.7\
**Date:** February 16, 2026\
**Project Context:** Gauntlet AI G4 Week 1 -- Real-Time Collaborative
Whiteboard with AI Agent\
**Goal:** Bulletproof multiplayer sync + reliable AI agent in a 7-day
sprint. Project completion required for Austin admission.

------------------------------------------------------------------------

## 0. Architecture Decisions (Chosen Stack)

**Frontend --- React + tldraw SDK v4.3.2 (latest stable)**\
- Infinite canvas\
- Pan / Zoom\
- Shapes, Sticky Notes, Text\
- Selection (single + box)\
- Transforms (move, resize; rotate post-MVP)\
- Delete\
- Multiplayer cursors + presence

**Sync / Backend / Persistence --- Firebase Realtime Database (RTDB)**\
- Delta-only object patches\
- Presence & cursors\
- Graceful reconnect\
- Object IDs: Client-side UUID v4 (`crypto.randomUUID()` or `uuid` lib)\
- Deterministic IDs for optimistic creation

**Authentication --- Firebase Auth (Google + Email)**

**AI Integration --- Anthropic Claude (function calling)**\
- Fallback: OpenAI GPT-4o-mini

**Deployment --- Vercel (frontend) + Firebase (RTDB/auth/rules + Cloud
Functions)**

------------------------------------------------------------------------

## Sync Strategy (Critical)

-   tldraw store interceptors / `onChange` emit **object-level deltas
    only**
-   Never write full board state
-   Use RTDB `.update()` multi-path writes for atomic updates
-   Server timestamps via `.sv: "timestamp"` for ordering
-   zIndex management: transactional increment / block reservation via
    transaction on `metadata.nextZIndex`

------------------------------------------------------------------------

## 0.1 Development Practices & Coding Standards

-   Single Responsibility Principle (SRP)
-   File size target \<400 LOC (hard max 1000 LOC)
-   Feature-sliced folder structure
-   No cross-feature imports except via interfaces
-   Jest + React Testing Library
-   ESLint + Prettier + Husky
-   AI-first development (Cursor + Claude) with human review

------------------------------------------------------------------------

## 1. Application Flow

1.  Login (Google / Email)
2.  Board List
3.  Create / Select Board
4.  Workspace

**Security Model** - Private by default - Multiple boards per user -
Permanent invite links (revocable post-MVP) - RTDB rules deny read/write
if not member - No guest access in MVP

------------------------------------------------------------------------

## 2. MVP Requirements (24-Hour Hard Gate)

-   Infinite canvas with smooth pan/zoom
-   Real-time sync (≥2 users)
-   Multiplayer cursors with labels
-   Presence awareness
-   Full-object locking
-   Basic selection (single + box-select)
-   Authentication required
-   Public Vercel deployment

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
-   Delete
-   zIndex layering
-   Inline text editing

### Post-MVP

-   Rotate (throttled delta updates \~50ms)

------------------------------------------------------------------------

## 5. Real-Time Collaboration Requirements

-   Object sync latency \<100 ms
-   Cursor sync latency \<50 ms
-   Support 5+ concurrent users
-   Refresh persistence
-   Graceful reconnect

### Conflict Resolution

-   Last-write-wins using server timestamps
-   Optimistic UI + reconciliation
-   AI commands serialized per board

------------------------------------------------------------------------

## 6. Locking Behavior (High Risk Area)

### Dual-Layer Enforcement

**Client-Side** - Disable interaction on locked objects - Show lock
badge / overlay

**Server-Side** - RTDB transactions enforce lock ownership - Writes
rejected if lock held

### Lock Lifecycle

-   Acquired transactionally on edit start
-   Auto-release after 30s inactivity
-   Heartbeat every 5 seconds during active edit (debounced)
-   `onDisconnect()` clears locks on disconnect
-   Owner override available (transactional)

### AI Interaction

-   AI never overrides locks
-   Skips locked objects and reports summary

------------------------------------------------------------------------

## 7. AI Board Agent

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
-   Rate limit: 5 commands per user per minute

### Post-MVP Stretch

-   `rotateObject(objectId, angleInRadians)`

------------------------------------------------------------------------

## 8. Performance Targets

-   60 FPS during pan/zoom/manipulation
-   500+ objects without degradation
-   Stable under 50 kbps network throttling
-   5+ concurrent users stable

### Sync Constraint

-   Minimal `tldraw.update()` calls
-   No full document resync
-   Rotation deltas throttled (\~50ms)

------------------------------------------------------------------------

## 9. Testing Requirements (TDD)

### Core Spec Scenarios

-   2 users editing simultaneously
-   Refresh mid-edit
-   Rapid object creation / movement
-   5 concurrent users
-   Simultaneous AI commands

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

------------------------------------------------------------------------

## 10. Definition of Done

### MVP Complete When

-   Cross-browser real-time sync works
-   Dual-layer locking prevents corruption
-   Selection enables core operations
-   Private access enforced via RTDB rules
-   Public deployment live
-   Code follows SRP + file limits

### Production Complete When

-   6+ reliable AI commands (including multi-step templates)
-   Performance targets met
-   Object rotation fully supported (UI + programmatic + synced)
-   AI usage logged with exact token counts
-   Touch-ready pointer handling
-   New features addable in \<1 day (modular structure)
