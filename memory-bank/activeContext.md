# Active Context

## Current Focus (for next agent)
**Verify real-time sync & fix locking** — User was walked through enabling Realtime: Database Management → **Publications** (not Replication) → supabase_realtime → add documents, locks, presence. After enabling, user should refresh browser tabs and test with 2 users on same board.

- If sync still doesn't work: debug documentsApi subscribeToDocuments, boardSync, Realtime subscription
- If sync works: fix locking (acquire/release on selection, lock UI feedback)
- No Vercel redeploy needed for Realtime changes

## Recent Changes
- **Stack migration** ✅: Firebase → Supabase. Auth (Supabase Auth), DB (Postgres + Realtime), Edge Functions (invite-to-board). RLS replaces RTDB rules.
- **Google Auth prep** ✅: signInWithGoogle passes redirectTo; SUPABASE_SETUP.md §5 has full steps (Google Cloud Console → Supabase Dashboard → URL config).
- **Board sharing** ✅: joinBoard API, RTDB members rule (self-join), React Router /board/:boardId, Share button (copy link), Join Board flow (paste link or ID)
- **Locking:** Implemented but NOT working in production — dual-layer design (locksApi, acquire/release, RLS)
- **Line movement fix:** Replaced Fabric Line (deprecated, transform bug) with Polyline (2 points) — line now moves correctly
- Clarified: presence = who else is viewing board (list) + cursor dots with name labels
- Supabase delta sync: documentsApi, boardSync, Fabric↔Postgres Realtime — NOT live in multi-user tests
- Zoom: expanded to 0.02–20x for infinite canvas feel (was 0.1–5x)
- Viewport culling: Fabric skipOffscreen enabled
- WorkspaceToolbar: Select, Rect, Circle, Triangle, Line, Text, Sticky tools
- shapeFactory: createShape() for all types, tldraw-like flat styling
- FabricCanvas: selectedTool prop, drag-to-draw, preview, Delete/Backspace
- WorkspacePage: tool state, toolbar above canvas

## Recent Implementations
- **Selection** ✅: Single + box-select; pan = middle-click or Space+drag; Delete removes all selected
- **Drawing fix** ✅: Preview shapes use assignId: false so they don't sync as duplicates
- **Vercel SPA rewrite** ✅: Direct /board/:id links work (vercel.json rewrites)
- **Resend** ✅: RESEND_FROM_EMAIL for verified domain (contact.meboard.dev)

## Next Steps (Recode Order)

1. ~~**Dependencies**~~ ✅
2. ~~**Fabric canvas wrapper**~~ ✅
3. ~~**Shapes + toolbar**~~ ✅
4. ~~**Viewport culling**~~ ✅ (Fabric skipOffscreen)
5. ~~**Delta sync**~~ ⚠️ implemented, NOT live (multi-user)
6. ~~**Presence & cursors**~~ ⚠️ implemented, not verified
7. **Locking** — ⚠️ implemented, NOT working
8. ~~**Board sharing**~~ ✅ (joinBoard, share link, join-by-ID, RTDB members rule)
9. ~~**Selection**~~ ✅ (single + box-select; pan = middle-click or Space+drag)

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking

## Considerations
- **Realtime**: Tables (documents, locks, presence) in supabase_realtime. Path: Database Management → **Publications** (not Replication). SQL fallback: `ALTER PUBLICATION supabase_realtime ADD TABLE documents;` etc.
- boardSync: strip `type` before existing.set() to avoid Fabric warning
- Locking: dual-layer design; needs debugging in multi-user scenario
