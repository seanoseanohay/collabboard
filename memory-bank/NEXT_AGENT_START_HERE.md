# START HERE - Next Agent Context

**Date:** 2026-02-17

## Current State

**MVP is complete.** Stroke width control and tldraw-style toolbar are in place. Zoom range extended to 0.001%–10000% (MIN_ZOOM 0.00001). Locking, sync, presence, Hand tool, zoom shortcuts + zoom UI, shape-tool fix, and paginated document load are done.

### What Was Done (Previous Session)
1. **Shape tool vs selection** — With any shape tool active, pointer-down always starts drawing (discardActiveObject + draw); never selects. FabricCanvas handleMouseDown.
2. **Hand tool** — New tool in WorkspaceToolbar; left-drag pans (cursor grab); FabricCanvas isHandDrag branch.
3. **Zoom shortcuts** — +/= in, − out, 0 fit to content, 1 = 100%. applyZoom/zoomToFit in FabricCanvas; handleKeyDown.
4. **Zoom UI** — Toolbar zoom dropdown (25%–400% + Fit). FabricCanvas ref (FabricCanvasZoomHandle) exposes setZoom/zoomToFit; WorkspacePage passes zoom from viewport and ref to toolbar.
5. **Board loading** — documentsApi fetchInitial paginated: PAGE_SIZE 50, order by object_id, range(); batches applied in sequence so first 50 appear quickly.

### Completed
- Google Auth, presence awareness, multi-selection move sync, very wide zoom ✅
- **Shape tool fix** ✅ — Draw never selects when shape tool active
- **Hand tool** ✅
- **Zoom shortcuts** ✅ — +/-, 0, 1
- **Zoom UI** ✅ — Dropdown in toolbar
- **Paginated document load** ✅
- **Stroke width** ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils, FabricCanvas onSelectionChange + setActiveObjectStrokeWidth
- **Sticky notes** ✅ — No placeholder text; on create, edit mode opens automatically (blinking cursor). shapeFactory: [bg, mainText]; handleMouseUp → setTimeout(50) → tryEnterTextEditing(mainText); hiddenTextarea?.focus().
- **Toolbar aesthetic** ✅ — Icon-based tool groups (tldraw-like), header aligned
- **Zoom range** ✅ — 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100); stroke in design units (automatic)

## Next Items (suggested)

**Done this session:**
- **AI Client API** ✅ — createObject, updateObject, deleteObjects, queryObjects; getDocument/fetchDocuments in documentsApi; exported from @/features/workspace.
- **AI Client API docs (Task B)** ✅ — docs/AI_CLIENT_API.md updated: marked "Implemented (client + Edge Function)", import examples, usage examples. Edge Function (supabase/functions/ai-canvas-ops) + frontend wrapper (aiCanvasOpsEdgeApi.ts) + barrel export all verified.
- **Trackpad pan/zoom** ✅ — Two-finger scroll = pan, pinch = zoom at cursor (FabricCanvas handleWheel: ctrlKey → zoom, else relativePan). Pinch sensitivity 0.006 (deltaY multiplier).

**Post-MVP / polish:**
- AI agent (Edge Function, Claude) — can now use aiClientApi for canvas ops.
- Undo/Redo, rotation (throttled).
- Revocable invite links.

**Fixed this session:**
- ~~**Multi-selection move drift**~~ ✅ — Root cause: originX/originY vs calcTransformMatrix center mismatch. Three fixes in boardSync.ts (payloadWithSceneCoords uses addTransformToObject; move-delta receiver uses obj.left+dx; applyRemote skips active selection echo). See systemPatterns for the pattern doc.

**Planned (documented in PRD + memory bank):**
- ~~**Bring forward / send backward**~~ ✅ — Done. bringForward/sendBackward in FabricCanvas + toolbar buttons.
- ~~**Boards page cleanup**~~ ✅ — Done (Figma-inspired: header, loading, empty, card rows, copy link, delete, rename, sort).
- **Boards grid (last-opened order)** ✅ — Grid of cards, ordered by last_accessed_at (when user opened board). user_boards.last_accessed_at migration; joinBoard updates it. formatLastAccessed: "Opened 2h ago", etc.

### Parallel agent tasks (no merge conflicts)

**Run these in parallel (different files/areas):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| ~~**A**~~ | ~~**Fix multi-selection move drift**~~ | ~~boardSync.ts, FabricCanvas.tsx~~ | ✅ DONE. Origin-vs-center fix. |
| ~~**B**~~ | ~~**AI Client API docs**~~ | ~~docs/AI_CLIENT_API.md~~ | ✅ DONE. Docs updated, usage examples, Edge Function + client imports verified. |
| ~~**C**~~ | ~~**StrictMode for production only**~~ | ~~main.tsx~~ | ✅ DONE. StrictMode wraps app only when import.meta.env.PROD. |
| **D** | **AI agent (Edge Function)** | supabase/functions/, new invoke from frontend if needed | Post-MVP. Uses aiClientApi. |
| **E** | **Revocable invite links** | supabase/migrations, invite API, ShareModal/BoardListPage | Post-MVP. Low priority — do last. |

**Run one at a time (all touch workspace canvas/sync — same area):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| ~~**F**~~ | ~~**Z-order nudge (bring forward / send backward)**~~ | ~~FabricCanvas.tsx, WorkspaceToolbar, boardSync.ts~~ | ✅ DONE. bringForward/sendBackward implemented + toolbar buttons. |
| ~~**G**~~ | ~~**Rotation throttle + sync**~~ | ~~boardSync.ts~~ | ✅ DONE. object:rotating hooked to emitModifyThrottled. |
| **H** | **Touch handling (mobile)** | FabricCanvas.tsx | Touch/pointer for pan, zoom, draw. |
| **I** | **Undo/Redo** | New feature module, FabricCanvas, boardSync | Post-MVP. History stack + integrate. |

**Rule:** Agents **A–E** can run in parallel with each other. Agents **F–I** each touch `boardSync` and/or `FabricCanvas` — run only one of F–I at a time (or after A is done, to avoid conflicts).

## Quick Reference
- **Zoom range:** 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100). FabricCanvas.tsx.
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **FabricCanvas:** forwardRef with FabricCanvasZoomHandle (setZoom, zoomToFit, getActiveObject, setActiveObjectStrokeWidth). onSelectionChange(strokeInfo). Hand tool: isHandDrag → pan. Shape tool: always draw. Stroke in design units (scales with zoom automatically). **Trackpad:** two-finger scroll = pan (relativePan), pinch = zoom at cursor (ctrlKey branch; sensitivity 0.006).
- **strokeUtils.ts:** getStrokeWidthFromObject, setStrokeWidthOnObject, MIN/MAX_STROKE_WEIGHT (1–100), clampStrokeWeight(); StrokeControl uses number input.
- **WorkspaceToolbar:** Icon groups (Select|Hand | shapes | Text|Sticky), StrokeControl when selectionStroke set, zoom dropdown.
- **Sticky notes:** No placeholder. Create → box completes → edit mode opens (blinking cursor). shapeFactory sticky = [bg, mainText]; FabricCanvas handleMouseUp auto-enters edit after 50ms.
- **documentsApi:** subscribeToDocuments fetchInitial uses .range(offset, offset + PAGE_SIZE - 1) in a loop.
- **Lines:** shapeFactory creates lines as Polyline (not Fabric Line). No legacy Line boards to support.
