# Planned Canvas Features

> Post-MVP canvas enhancements. Status: Spec only — implementation pending.
> **Last updated:** 2026-02-18

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

## 1. Object Grouping (Containing Objects) & Organize Content Areas

**Status:** Implemented with known bug. Group works correctly. Ungroup partially broken.

### Goal
Select multiple objects and group them into a persistent unit. Moving one object moves all. Like Figma/tldraw grouping. Supports organizing content areas on the board.

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

---

## 5. Connectors (Miro-style) — **Required for finished product** ✅ IMPLEMENTED

### Goal
When an object is selected, mid-point handles become connector points. User can drag from a connector to create arrows/lines that connect to other objects. Miro-style behavior.

### Behavior
- **Selection:** Mid-point handles (top, right, bottom, left) show as connector points (blue circles).
- **Connector drawing:** Click/drag from connector handle → line preview follows cursor; release on another object to finalize connection.
- **Connector types:** Straight lines; target port auto-selected (nearest to drop point).
- **Persistence:** Connectors store sourceObjectId, sourcePort (ml/mr/mt/mb), targetObjectId, targetPort. When objects move, connector endpoints update.

### Implementation
- **connectorPortUtils.ts** — getPortScenePoint, getNearestPort
- **connectorFactory.ts** — createConnector, updateConnectorEndpoints, isConnector
- **connectorControls.ts** — Custom ml/mr/mt/mb controls with mouseDownHandler firing `connector:draw:start`
- **FabricCanvas** — connector-draw mode: preview line, finalize on mouse:up over target
- **boardSync** — connector subtype serialize/deserialize; updateConnectorEndpoints on object:moving and move-delta broadcast

---

## 6. Frames

### Goal
Frames are container elements that organize content areas. Like Figma frames or Miro frames — labeled rectangular regions that group and structure board content.

### Behavior
- Create frame via toolbar or shortcut
- Frame = bordered rect (optionally with title/label) that can contain other objects
- Objects can be moved into/out of frames; frame resizes or objects clip (design TBD)
- Frames help structure large boards (sections, columns, workflows)

### Implementation Notes
- May extend Group with subtype `frame`; or new Fabric object type
- Sync: same as groups; frame is one document with children embedded or referenced
- Effort: ~4–8 hours (depends on frame semantics: container vs clip region)

---

## 7. Duplicate

### Goal
Duplicate selected object(s) with one action. Creates a copy offset from the original.

### Behavior
- **Shortcut:** Cmd+D (or Ctrl+D)
- **Toolbar:** Duplicate button when selection exists
- Duplicated object(s) get new UUIDs; positioned offset (e.g. +20, +20) from original
- Sync: emitAdd for each new object; history records compound add

### Implementation Notes
- Fabric `clone()` on selection; assign new IDs via setObjectId; add to canvas; emitAdd
- FabricCanvas: handleKeyDown Cmd+D; WorkspaceToolbar: Duplicate button
- Effort: ~1–2 hours

---

## 8. Copy & Paste

### Goal
Copy selected object(s) to clipboard; paste creates copies at cursor or center.

### Behavior
- **Copy:** Cmd+C (or Ctrl+C) — serialize selection to clipboard (JSON or internal format)
- **Paste:** Cmd+V (or Ctrl+V) — create copies at paste position (e.g. scene center or cursor)
- Works with multi-selection; pasted objects get new UUIDs
- Optional: cross-session clipboard (localStorage) vs session-only (in-memory)

### Implementation Notes
- Clipboard: JSON serialization via `toObject(['data','objects'])`; deserialize and `util.addTransformToObject` for position offset
- FabricCanvas: handleKeyDown Cmd+C / Cmd+V; guard against text-editing (don't intercept when IText focused)
- Effort: ~2–3 hours

---

## 9. Marquee Mode (Box-select over objects)

### Goal
Fix: when user starts a drag on top of a large object, the selection marquee (grab box) does not appear — Fabric treats it as object selection/move instead. User wants to draw the marquee even when starting on an object.

### Current Behavior
- Fabric starts `_groupSelector` (marquee) only when pointer-down is on **empty** canvas.
- Click on object + drag → selects/moves that object; no marquee.

### Desired Behavior: Marquee Mode
- **Option A:** Modifier key (e.g. Alt) held during drag → always start marquee, even over objects.
- **Option B:** "Marquee select" mode — when Select tool is active and user holds a key or toggle, drag always draws marquee.
- **Option C:** Toolbar toggle "Marquee mode" — when on, drag from anywhere (including on objects) draws selection box first; release completes selection of objects in box.

### Implementation Notes
- Fabric's `selectionKey` controls when marquee appears; may need to intercept mouse:down and force `_groupSelector` start when modifier held or mode active, bypassing normal target selection.
- Custom handling in FabricCanvas handleMouseDown: if (marqueeMode || modifierKey) and pointer-down, discard target and initiate selection rect manually.
- Effort: ~2–4 hours
