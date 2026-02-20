# Frame Phase 2 Improvements — Design

**Date:** 2026-02-20  
**Goal:** Two UX fixes for frames: (1) auto-capture on send-to-back, (2) frame title display at zoom.

---

## 1. Send-to-Back Auto-Capture

### Requirement
When a frame is sent to the back (or sent backward), all objects that are **above** the frame in z-order and **inside** its bounds should automatically be added to the frame's `childIds`. This enables a workflow: place objects on top of a frame, then "send frame to back" to capture them into the frame.

### Current Behavior
- `sendToBack` / `sendBackward` in `fabricCanvasZOrder.ts` only change z-index; no capture.
- `checkAndUpdateFrameMembership` in `boardSync.ts` runs on `object:added` and `object:modified` for non-frames — it adds objects whose center is inside a frame, but does NOT run when a frame's z-order changes.
- Frames get `childIds` only when objects are moved into bounds or when a new frame is drawn over existing objects (`object:added` for frame).

### Proposed Design

**Trigger:** When `sendToBack` or `sendBackward` is invoked and the target includes one or more frames.

**Logic (per frame):** Before changing the frame's z-index:
1. Get the frame's current z-index.
2. Find all canvas objects that:
   - Have `zIndex > frame.zIndex`
   - Are not frames
   - Have center (or bbox centroid) inside frame bounds
   - Are not already in `frame.childIds`
3. Add their IDs to `childIds`, call `emitModify(frame)`.
4. Proceed with the normal z-order change.

**Implementation approach:**
- Fire a custom canvas event `frame:beforeSendToBack` with `{ frame, currentZIndex }` from `fabricCanvasZOrder.ts` before applying the z-order change.
- `boardSync.ts` listens for this event in `setupDocumentSync` and runs the capture logic (reuse `isObjectInsideFrame`, `getFrameChildIds`, `setFrameChildIds`, `emitModify`).

**Files:**
- `src/features/workspace/lib/fabricCanvasZOrder.ts` — fire `frame:beforeSendToBack` for each frame in the target set before modifying z.
- `src/features/workspace/lib/boardSync.ts` — add listener for `frame:beforeSendToBack`, run capture.

### Edge Cases
- **Multi-select including frames:** If user selects a frame + objects and sends to back, the frame is sent to back; objects above and inside the frame get captured. Objects that are part of the selection and inside the frame will be moved with the frame (they become children); their z-index will also change. The capture runs before the z change, so we capture based on pre-change z-order. ✓
- **Nested frames:** If frame A is inside frame B and we send B to back, A's center is inside B → A gets added to B's childIds. Frames can contain other frames semantically (childIds). The existing "moving frame moves children" logic would then move A when B moves. OK for now.

---

## 2. Frame Title Display Fix

### Problem
Frame titles (IText inside the frame Group) appear disproportionately large when zoomed out. User: "I'm seeing names that are gigantic when I'm zoomed out a bit."

### Root Cause (Hypothesis)
- **Option A:** Canvas zoom scales everything uniformly. At low zoom (e.g. 25%), a 14px font appears as ~3.5px — so titles would be *smaller*, not larger. The "gigantic" effect might come from:
  - **Frame resize:** When the user resizes a frame (scale handles), the Group gets `scaleX`/`scaleY`. The title IText scales with the Group. A 3× scaled frame has a ~42px effective title.
  - **Visual proportion:** At overview zoom, many small frames are visible; the 40px header + 14px title may dominate each frame card.
- **Option B:** Some systems enforce minimum font sizes; at low zoom text might not scale below a threshold, making it look oversized relative to the frame.

### Proposed Approaches

**A. Hide title below zoom threshold (simplest)**
- When canvas zoom &lt; 40%, hide the frame title (or show a minimal placeholder like "⋯").
- Pro: Clean overview; no gigantic text.
- Con: Can't read frame names when zoomed out.

**B. Scale title with zoom (zoom-invariant screen size)**
- Set `fontSize = BASE / zoom` so the title stays a fixed pixel size on screen (e.g. always ~12–14px).
- Requires updating the title's fontSize on every viewport change — frame objects would need a `before:render` or we'd need to pass zoom into frame render. More complex.
- Pro: Title always readable, never dominates.
- Con: Per-frame updates on zoom; possible perf cost.

**C. Cap title scale when frame is resized**
- When the frame Group has `scaleX`/`scaleY` > 1 (user resized it), counter-scale the title so effective size stays ≤ ~20px.
- Pro: Fixes "resized frame = huge title" without affecting zoom.
- Con: Doesn't address zoom-based issues if that's the real cause.

**D. Smaller base font + optional hide**
- Reduce base `fontSize` from 14 to 10–12.
- Optionally hide below 30% zoom.
- Pro: Quick fix; less dominant at any zoom.
- Con: May be too small when zoomed in.

### Recommendation
- **Primary:** Implement **A** (hide below threshold, e.g. 40%) — low effort, solves "gigantic when zoomed out."
- **Secondary:** Option **D** — reduce base fontSize to 12 as a hedge.
- **Clarification needed:** Is the issue (a) canvas zoom, (b) frame resize, or (c) both? That affects whether A and/or C is the right fix.

### Implementation Notes

**Hide below zoom:**
- Frame title is an IText child of the frame Group. To hide it, we could:
  - Set `visible: false` on the title when zoom &lt; threshold. Requires viewport/zoom to be available when rendering. Fabric doesn't easily pass zoom to object render. We'd need a different approach: a `before:render` on the canvas that iterates frames and toggles title visibility based on `canvas.getZoom()`.
  - Or: keep the title in the Group but make it `visible: false` when zoom is low. The canvas `before:render` runs every frame; we can read zoom and update. Store a ref to current zoom in WorkspacePage; pass it to FabricCanvas; in `before:render`, iterate objects, for each frame set `titleText.visible = zoom >= THRESHOLD`.
- Simpler: add an `object:modified`-like path — when viewport changes, we'd need to update all frame title visibilities. That could be done in `onViewportChange` callback: FabricCanvas gets zoom from canvas, and we'd need to update each frame's title. FabricCanvas doesn't have a ref to all objects without canvas... Actually the canvas is in FabricCanvas. So in the viewport change handler (or a useEffect on viewportTransform), we could call `canvas.getObjects().filter(isFrame).forEach(f => updateFrameTitleVisibility(f, zoom))`.
- **Cleaner:** Add `updateFrameTitleVisibility(canvas, zoom)` called from `onViewportChange` in FabricCanvas. The function would get `canvas.getZoom()`, iterate frames, for each get the title IText (second child of Group), set `visible: zoom >= HIDE_TITLE_ZOOM_THRESHOLD` (e.g. 0.4).

**Reduce base font:**
- `frameFactory.ts`: change `fontSize: 14` to `fontSize: 12`.

---

## Summary

| Item | Approach | Effort |
|------|----------|--------|
| Send-to-back capture | Fire `frame:beforeSendToBack`, boardSync listener runs capture | ~1–2 hrs |
| Frame title | Hide below 40% zoom + reduce base font to 12 | ~1 hr |

---

## Open Questions

1. **Frame title:** When you say "gigantic when zoomed out," is the issue (a) viewing the board at low zoom (e.g. 25–50%)? (b) Frames that you've resized to be large? (c) Something else?
2. **Hide threshold:** Is 40% zoom a good cutoff for hiding the title, or would you prefer a different value (e.g. 25% or 50%)?
3. **Send-backward:** Should `sendBackward` (one step back) also trigger the same auto-capture, or only `sendToBack` (all the way back)? Recommendation: both, since both decrease the frame's z.
