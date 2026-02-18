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
- **Trackpad pan/zoom** ✅ — Two-finger scroll = pan, pinch = zoom at cursor (FabricCanvas handleWheel: ctrlKey → zoom, else relativePan). Pinch sensitivity 0.006 (deltaY multiplier).

**Post-MVP / polish:**
- AI agent (Edge Function, Claude) — can now use aiClientApi for canvas ops.
- Undo/Redo, rotation (throttled).
- Revocable invite links.

**Priority to fix:**
- **Multi-selection move drift** — When moving a group, other clients see objects continuously move down and to the right (regardless of drag direction). Move-delta broadcast + getTargetSceneCenter in place; bug still reproduces. See progress.md Known Issues, activeContext.

**Planned (documented in PRD + memory bank):**
- **Multi-selection move sync v2** — Implemented but buggy (drift down/right); priority fix. Design: during drag broadcast (`objectIds`, `dx`, `dy`); on drop write absolute. See PRD § Sync Strategy, activeContext, systemPatterns.
- **Bring forward / send backward** — One step in z-order (not only full front/back). PRD §4.
- ~~**Boards page cleanup**~~ ✅ — Done (Figma-inspired: header, loading, empty, card rows, copy link, delete, rename, sort).

### Parallel agent tasks (no merge conflicts)

**Run these in parallel (different files/areas):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| **A** | **Fix multi-selection move drift** | boardSync.ts, FabricCanvas.tsx | High priority. Move-deltas apply logic. |
| **B** | **AI Client API docs** | docs/AI_CLIENT_API.md only | Mark Implemented, add usage examples. |
| **C** | **StrictMode for production only** | main.tsx only | Wrap app in React.StrictMode when import.meta.env.PROD. |
| **D** | **AI agent (Edge Function)** | supabase/functions/, new invoke from frontend if needed | Post-MVP. Uses aiClientApi. |
| **E** | **Revocable invite links** | supabase/migrations, invite API, ShareModal/BoardListPage | Post-MVP. Schema + RLS + UI to revoke. |

**Run one at a time (all touch workspace canvas/sync — same area):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| **F** | **Z-order nudge (bring forward / send backward)** | FabricCanvas.tsx, WorkspaceToolbar, boardSync.ts | PRD §4. One step in z-order. |
| **G** | **Rotation throttle + sync** | boardSync.ts | object:rotating ~50ms throttle, sync like moving. Post-MVP. |
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
