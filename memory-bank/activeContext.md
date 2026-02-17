# Active Context

## Current Focus
**Google Auth setup** — Complete Google OAuth so "Continue with Google" works. See SUPABASE_SETUP.md §5. User must complete in Google Cloud Console + Supabase Dashboard (manual steps). Selection ✅ complete.

## Recent Changes
- **Stack migration** ✅: Firebase → Supabase. Auth (Supabase Auth), DB (Postgres + Realtime), Edge Functions (invite-to-board). RLS replaces RTDB rules.
- **Google Auth prep** ✅: signInWithGoogle passes redirectTo; SUPABASE_SETUP.md §5 has full steps (Google Cloud Console → Supabase Dashboard → URL config).
- **Board sharing** ✅: joinBoard API, RTDB members rule (self-join), React Router /board/:boardId, Share button (copy link), Join Board flow (paste link or ID)
- **Locking:** Dual-layer (client + server). locksApi, acquire on selection, release on deselection, RTDB rules reject writes when lock held by another
- **Line movement fix:** Replaced Fabric Line (deprecated, transform bug) with Polyline (2 points) — line now moves correctly
- Clarified: presence = who else is viewing board (list) + cursor dots with name labels
- RTDB delta sync: documentsApi, boardSync, Fabric↔RTDB bidir
- Zoom: expanded to 0.02–20x for infinite canvas feel (was 0.1–5x)
- Viewport culling: Fabric skipOffscreen enabled
- WorkspaceToolbar: Select, Rect, Circle, Triangle, Line, Text, Sticky tools
- shapeFactory: createShape() for all types, tldraw-like flat styling
- FabricCanvas: selectedTool prop, drag-to-draw, preview, Delete/Backspace
- WorkspacePage: tool state, toolbar above canvas

## Recent Implementations
- **Selection** ✅: Single + box-select (Fabric built-in); pan = middle-click or Space+drag (not left-drag on empty); boardSync locking for multi-select; Delete key removes all selected objects

## Next Steps (Recode Order)

1. ~~**Dependencies**~~ ✅
2. ~~**Fabric canvas wrapper**~~ ✅
3. ~~**Shapes + toolbar**~~ ✅
4. ~~**Viewport culling**~~ ✅ (Fabric skipOffscreen)
5. ~~**RTDB delta sync**~~ ✅
6. ~~**Presence & cursors**~~ ✅ (presenceApi, usePresence, CursorOverlay, RTDB rules)
7. ~~**Locking**~~ ✅ (locksApi, acquire/release, RTDB rules, not-allowed cursor on locked)
8. ~~**Board sharing**~~ ✅ (joinBoard, share link, join-by-ID, RTDB members rule)
9. ~~**Selection**~~ ✅ (single + box-select; pan = middle-click or Space+drag)

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking

## Considerations
- Fabric requires custom sync (vs tldraw's built-in); use delta-only, UUID v4, server timestamps
- Locking: dual-layer (client + server); User A cannot edit what User B edits
- Presence: RTDB `boards/{boardId}/presence/{userId}` or root `presence/{boardId}/{userId}`, 100ms or mousemove debounce
- boardSync: strip `type` before existing.set() to avoid Fabric "Setting type has no effect" warning
