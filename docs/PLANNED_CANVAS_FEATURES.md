# Planned Canvas Features

> Post-MVP canvas enhancements. Status: Spec only — implementation pending.
> **Last updated:** 2026-02-18

---

## 1. Object Grouping (Containing Objects)

### Goal
Select multiple objects and group them into a persistent unit. Moving one object moves all. Like Figma/tldraw grouping.

### Behavior
- **Group:** Select 2+ objects (box-select, shift-click, or lasso) → click "Group" → they become one Fabric Group
- **Ungroup:** Select a group → click "Ungroup" → children become standalone objects again
- **Sync:** Group = 1 document row (serialized with `toObject(['data','objects'])`); children embedded, not separate rows
- **Locking:** Lock the group, not individual children

### Implementation Notes
- Fabric.js `ActiveSelection.toGroup()` or manual `new Group(selectedObjects)`
- boardSync already handles groups (sticky notes); extend with subtype `sticky` vs `container` to distinguish
- On Group: delete N child document rows, write 1 group row
- On Ungroup: delete group row, write N child rows with new UUIDs
- Effort: ~2–4 hours with AI assist

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
