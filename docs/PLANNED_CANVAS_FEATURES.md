# Planned Canvas Features

> Post-MVP canvas enhancements. Status: Spec only — implementation pending.
> **Last updated:** 2026-02-19

---

## 0. Viewport Persistence

### Goal
On reload or navigating back to a board, the user should return to the same zoom level and pan position where they left off — not always (0,0) at 100%.

### Current Behavior
- Fabric canvas starts with default `viewportTransform` `[1,0,0,1,0,0]` = 100% zoom, origin at top-left
- Viewport state is never persisted; it's lost on every page load

### Desired Behavior
- **Default:** Persist viewport (zoom + pan) per board (and optionally per user) so returning users see where they left off
- **Optional:** "Reset view" or "Center canvas" control for when user wants to explicitly reset to (0,0) at 100% or zoom-to-fit

### Implementation Notes
- **Storage:** `localStorage` keyed by `collabboard:viewport:{boardId}` (add `:${userId}` if per-user). Simple, no backend changes.
- **Save:** Debounce (300–500ms) on pan/zoom changes; store `viewportTransform` array `[scaleX, skewY, skewX, scaleY, translateX, translateY]`
- **Restore:** On canvas mount, read from storage; if valid, apply to Fabric canvas (`canvas.viewportTransform = vpt`) before/right after setup
- **Reset control:** Add toolbar button or zoom-menu item; handler sets `[1,0,0,1,0,0]` or calls `zoomToFit()`
- Effort: ~1–2 hours

---

## 1. Object Grouping (Containing Objects)

**Status:** Implemented with known bug. Group works correctly. Ungroup partially broken.

### Goal
Select multiple objects and group them into a persistent unit. Moving one object moves all. Like Figma/tldraw grouping.

### Behavior
- **Group:** Select 2+ objects (box-select, shift-click, or lasso) → click "Group" → they become one Fabric Group ✅
- **Ungroup:** Select a group → click "Ungroup" → children become standalone objects again ⚠️ *Bug: objects move and become unselectable*
- **Sync:** Group = 1 document row (serialized with `toObject(['data','objects'])`); children embedded, not separate rows ✅
- **Locking:** Lock the group, not individual children ✅

### Known Bug: Ungroup
When ungrouping a container group:
1. **Objects move** — Children end up in wrong positions (coordinate conversion from group-relative to scene-space incorrect or overwritten).
2. **Objects become unselectable** — After adding back to canvas, children remain `selectable: false`, `evented: false` (inherited from group-child state) despite explicit `child.set({ selectable: true, evented: true })` before `canvas.add()`.

**Mitigations tried:**
- `calcTransformMatrix()` instead of `calcOwnMatrix()` for group→canvas coordinate conversion
- Explicit `child.set({ selectable: true, evented: true })` before adding each child to canvas
- Issue persists; root cause under investigation (Fabric.js v6 Group internals, `applyLockStateCallback` timing, or postgres_changes echo overwriting state).

**Code locations:** `FabricCanvas.tsx` — `ungroupSelected()`, Cmd+Shift+G keyboard handler.

### Implementation Notes
- Fabric.js manual `new Group(selectedObjects)` (not `toGroup()` — need control over ID/subtype and event sequencing)
- boardSync: subtype `container` vs sticky (no subtype) distinguishes container groups
- On Group: remove N children from canvas (emitRemove), create Group with subtype, add (emitAdd), compound history
- On Ungroup: remove group, apply `util.addTransformToObject(child, groupMatrix)`, set selectable/evented, add each child with new UUID, compound history — *bug above*
- Effort to fix ungroup: TBD

---

## 2. Free Draw / Pencil Tool

### Goal
tldraw-style freehand drawing — not straight lines, but pen/pencil strokes.

### Behavior
- Add "Draw" or "Pen" tool to toolbar
- When active: Fabric `isDrawingMode = true`
- Each stroke → `fabric.Path` (selectable, movable, synced)
- Brush options: color, width (reuse strokeUtils)

### Implementation Notes
- Fabric.js built-in: `canvas.isDrawingMode`, `canvas.freeDrawingBrush`
- Same sync flow as shapes: object:added, object:modified
- Effort: ~1–2 hours

---

## 3. Lasso Selection (Optional)

### Goal
Draw a freeform path to select objects inside/intersecting the path. Alternative to box-select for irregular selections.

### Behavior
- Add "Lasso" tool
- Pointer down → draw path as user moves
- Pointer up → find objects inside path (point-in-polygon) → set as active selection
- Works with Group button: lasso → Group

### Implementation Notes
- Fabric does NOT have built-in lasso; custom implementation required
- Draw Path during drag; on mouseup: hit-test objects, `setActiveObject(new ActiveSelection(selected))`
- Effort: ~3–6 hours with AI assist

---

## 4. Multi-Scale Map Vision (Pirate Map)

### Goal
Canvas inside a treasure map border. Zoom out → see "continents"/islands. Zoom in → see city blocks, detail. Free draw for coastlines, roads. Single infinite canvas, objects at different scales.

### Elements
| Element | Implementation |
|--------|----------------|
| Map border | MeBoard spec §3 — parchment frame around canvas |
| Zoom in/out | Already have 0.001%–10000% |
| "Continents" | Large shapes/polygons or free-drawn regions |
| "City blocks" | Smaller rects at higher zoom |
| Free draw | §2 above — coastlines, paths |
| Multi-scale | One coordinate space; zoom level = what you see |

### Notes
- All in one Fabric canvas; zoom only changes viewport
- No layer switching — objects at different sizes/positions
- Complements MeBoard branding (docs/MeBoard_BRANDING_SPEC.md)
