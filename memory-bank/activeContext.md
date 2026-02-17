# Active Context

## Current Focus (for next agent)
**CRITICAL: Locking latency issue** ⚠️ — Lock propagation via postgres_changes is too slow (200-500ms), allowing race conditions where User 2 can click locked objects before lock propagates.

**Two critical performance issues identified:**
1. **Lock latency (HIGH PRIORITY):** 200-500ms delay between lock acquisition and visibility to other users
   - Current: Uses `postgres_changes` Realtime (slow)
   - Fix: Use Supabase **Broadcast** for instant lock messages (<100ms)
   - Keep postgres_changes as backup for persistence

2. **Board loading (MEDIUM PRIORITY):** Slow initial load on boards with many objects
   - Current: Fetches ALL objects upfront in single query
   - Fix options: Lazy loading, pagination, or add DB indexes

**Next:** Implement broadcast-based locking, then optimize board loading.

## Recent Changes (2026-02-17)

**Locking fixes (multiple iterations):**
- ✅ Fixed `evented: true` bug - locked objects now have `evented: false` 
- ✅ Optimistic locking - locks apply instantly before DB roundtrip
- ✅ Removed `subTargetCheck` from Groups - prevents clicking child elements
- ✅ Reapply lock state after Realtime updates - fixes "ghost click zone"
- ❌ **REMAINING:** Lock propagation still too slow (200-500ms via postgres_changes)

**Text rotation fix:**
- ✅ Track `objectWasTransformed` flag to prevent edit mode during rotation
- ✅ Text objects can now be rotated without losing selection box

**layoutManager serialization fix:**
- ✅ Remove `layoutManager` from `toObject()` calls - fixes crash when moving Groups

## Recent Changes (Earlier 2026-02-17)
- **Sticky notes (Groups) — comprehensive fixes:**
  - `text:editing:exited` instead of `text:changed` — syncs only when editing completes, not every keystroke
  - Group serialization: `toObject(['data', 'objects'])` to include children in sync
  - Group update logic: updates position/transform properties + text content separately without destroying structure
  - `ensureGroupChildrenNotSelectable()` — children marked `selectable: false, evented: false` after sync to force Group-level selection
  - `selection:created` handler redirects child selection to parent Group
  - Consistent `originX/originY: 'left'/'top'` throughout Group and children
  - Text editing: `setActiveObject()` + `setTimeout(0)` before `enterEditing()`

- **Real-time sync** ✅: Documents Realtime subscription stable; objects sync live during drag. Fixes: single `event: '*'` subscription, FabricCanvas effect deps stabilized (refs for callbacks/lockOpts, deps `[width, height, boardId]` only), Realtime timeout 20s. StrictMode removed (was causing channel churn).
- **Live drag sync** ✅: object:moving, object:scaling, object:rotating with 80ms throttle so other users see objects move in real-time during drag (not just at release).
- **Presence** ✅: Use payload directly instead of refetch; debounce 50ms. Cursors move smoothly.
- **board_members RLS** ✅: Migration 00002 (board_exists SECURITY DEFINER, board_members_update for upsert). Migration 00003 adds documents/locks/presence to Realtime publication.
- **Stack migration** ✅: Firebase → Supabase. Auth (Supabase Auth), DB (Postgres + Realtime), Edge Functions (invite-to-board). RLS replaces RTDB rules.
- **Board sharing** ✅: joinBoard API, self-join via board_members, React Router /board/:boardId, Share button, Join Board flow
- **Locking:** Partially working — optimistic locking implemented but postgres_changes is too slow (200-500ms latency). Needs broadcast for instant propagation.
- **Line movement fix:** Polyline (2 points) replaces deprecated Fabric Line
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
5. ~~**Delta sync**~~ ✅ live; object:moving/scaling/rotating (80ms throttle) for real-time drag
6. ~~**Presence & cursors**~~ ✅ working (payload-based, 50ms debounce)
7. **Locking** — ⚠️ implemented, NOT verified (deferred)
8. ~~**Board sharing**~~ ✅ (joinBoard, share link, join-by-ID)
9. ~~**Selection**~~ ✅ (single + box-select; pan = middle-click or Space+drag)
10. ~~**Tests**~~ ✅ usePresence debounce, shapeFactory, boardSync, 500-object stress
11. **Inline text editing** ✅ — Fixed! IText and sticky notes now editable via double-click or click-when-selected.

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking

## Considerations
- **Realtime**: Tables (documents, locks, presence) in supabase_realtime. Path: Database Management → **Publications** (not Replication). Migration 00003 adds all three.
- **FabricCanvas effect stability**: Effect deps must be `[width, height, boardId]` only; use refs for callbacks and lockOpts to avoid channel churn (CLOSED/TIMED_OUT).
- **boardSync**: strip `type` before existing.set() ✅; emit during drag via object:moving/scaling/rotating (throttled 80ms); `text:editing:exited` for text changes (not every keystroke)
- **Group (sticky note) sync**: Include 'objects' in toObject(['data', 'objects']) for full Group serialization. Update existing Groups by setting position/transform properties + updating child text content separately (don't remove/replace). ensureGroupChildrenNotSelectable() marks children as non-selectable after sync.
- **Sticky note selection**: selection:created handler redirects child selections to parent Group; children have selectable: false, evented: false
- **Text editing**: IText must be set as active object before enterEditing(); setTimeout(0) ensures initialization; works for both standalone text and Groups (sticky notes)
- **Locking**: Optimistic locking working locally, but Realtime propagation via postgres_changes has 200-500ms latency. Need to implement Supabase Broadcast for instant lock messages (<100ms). Keep postgres_changes as backup for persistence.
