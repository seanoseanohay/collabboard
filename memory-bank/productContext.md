# Product Context

## Why This Exists
CollabBoard is a real-time collaborative whiteboard that enables multiple users to work on an infinite canvas together, with an AI agent that can assist with board operations. It's designed for Gauntlet AI G4 Week 1 as a 7-day sprint deliverable.

**Planned rebrand: MeBoard** — Pirate-themed branding with treasure map canvas, nautical visuals, and pirate stickers. See docs/MeBoard_BRANDING_SPEC.md.

## Problems It Solves
- Real-time whiteboard collaboration with low latency
- Conflict-free concurrent editing via locking and server timestamps
- AI-assisted board manipulation (server-serialized, non-corrupting)
- Private, per-user board management with authentication

## How It Should Work

### User Journey
1. **Authenticate** — Google or Email login via Supabase Auth
2. **Board List** — See owned/accessible boards
3. **Create/Select Board** — Start new or open existing
4. **Workspace** — Infinite canvas with:
   - Pan, zoom (very wide range 0.001%–10000%+, Figma-like); trackpad: two-finger scroll = pan, pinch = zoom (tuned sensitivity); create shapes (rect, circle, triangle, line)
   - Sticky notes and standalone text
   - Move, resize, change color, delete
   - See other users' cursors, presence, and edits in real time
   - Lock objects when editing (others cannot edit locked objects)
   - AI commands via natural language (post-MVP; e.g., "add a red circle")

### Collaboration Behavior
- Object sync latency <100ms, cursor sync <50ms
- 5+ concurrent users supported
- Last-write-wins with server timestamps
- Optimistic UI + reconciliation
- Graceful reconnect and refresh persistence
- **Planned:** Multi-selection moves — during drag broadcast deltas (objectIds + dx, dy) for low lag; on drop write absolute positions to documents so all items end up in the right spot (PRD § Sync Strategy).

### AI Agent Behavior (Post-MVP)
- All commands through Supabase Edge Function (serialized per board)
- Never overrides user locks; skips locked objects
- Atomic writes (no partial state)
- Loading indicator (>2s warning at 3s)

## User Experience Goals
- 60 FPS during pan/zoom/manipulation
- 500+ objects without degradation
- Stable under 50 kbps network throttling
- Intuitive: shapes, sticky notes, text feel natural. Sticky notes open for typing as soon as you finish drawing (blinking cursor, no placeholder text).
