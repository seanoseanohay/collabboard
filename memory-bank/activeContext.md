# Active Context

## Current Focus (for next agent)
**Sticky notes (Groups) mostly working** ✅ — Major fixes completed (2026-02-17):
1. Text editing works (double-click, type full sentences, exits cleanly)
2. Movement works (entire Group moves together - background + text)
3. Position and text persist correctly after reload
4. Rotation and transforms persist

**Remaining minor sticky note issues for next session:**
- Selection behavior needs minor refinement
- Deletion may need verification
- (User will detail specific issues)

**Next:** Address remaining sticky note issues, then verify locking system in multi-user scenarios.

## Recent Changes (2026-02-17)
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
- **Locking:** Implemented but NOT verified — dual-layer design (locksApi, acquire/release, RLS)
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
- **Locking**: dual-layer design; needs verification in multi-user scenario
