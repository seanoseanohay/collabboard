# START HERE - Next Agent Context

**Date:** 2026-02-17

## Current State

**MVP is complete.** Stroke width control and tldraw-style toolbar are in place. Locking, sync, presence, Hand tool, zoom shortcuts + zoom UI, shape-tool fix, and paginated document load are done.

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
- **Toolbar aesthetic** ✅ — Icon-based tool groups (tldraw-like), header aligned

## Next Items (suggested)

**Post-MVP / polish:**
- Two-finger drag = pan, pinch = zoom (touch).
- AI agent (Edge Function, Claude).
- Undo/Redo, rotation (throttled).
- Revocable invite links.

## Quick Reference
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **FabricCanvas:** forwardRef with FabricCanvasZoomHandle (setZoom, zoomToFit, getActiveObject, setActiveObjectStrokeWidth). onSelectionChange(strokeInfo). Hand tool: isHandDrag → pan. Shape tool: always draw.
- **strokeUtils.ts:** getStrokeWidthFromObject, setStrokeWidthOnObject, STROKE_WEIGHT_OPTIONS [1,2,4,8].
- **WorkspaceToolbar:** Icon groups (Select|Hand | shapes | Text|Sticky), StrokeControl when selectionStroke set, zoom dropdown.
- **documentsApi:** subscribeToDocuments fetchInitial uses .range(offset, offset + PAGE_SIZE - 1) in a loop.
