# Planned Canvas Features

> Post-MVP canvas enhancements.
> **Last updated:** 2026-02-19

---

## 0. Viewport Persistence — ✅ IMPLEMENTED

### Goal
On reload or navigating back to a board, the user should return to the same zoom level and pan position where they left off — not always (0,0) at 100%.

### Implementation (2026-02-19)
- **Storage:** `localStorage` keyed by `meboard:viewport:{boardId}`
- **Save:** Debounced 400ms on pan/zoom changes; `viewportPersistence.ts`
- **Restore:** On FabricCanvas mount, `loadViewport(boardId)` applied before first render
- **Reset control:** "Reset view" in zoom dropdown (WorkspaceToolbar)
- **Files:** `src/features/workspace/lib/viewportPersistence.ts`, FabricCanvas.tsx, WorkspacePage.tsx

---

## 1. Object Grouping (Containing Objects) & Organize Content Areas

**Status:** Fully implemented. Group ✅. Ungroup ✅ (bug fixed 2026-02-19).

### Goal
Select multiple objects and group them into a persistent unit. Moving one object moves all. Like Figma/tldraw grouping. Supports organizing content areas on the board.

### Behavior
- **Group:** Select 2+ objects (box-select, shift-click, or lasso) → click "Group" → they become one Fabric Group ✅
- **Ungroup:** Select a group → click "Ungroup" → children become standalone objects again ⚠️ *Bug: objects move and become unselectable*
- **Sync:** Group = 1 document row (serialized with `toObject(['data','objects'])`); children embedded, not separate rows ✅
- **Locking:** Lock the group, not individual children ✅

### Fix (2026-02-19)
Root cause was Fabric.js v7's dual reference system:
- `parent` — permanent group membership (only cleared by `group.remove(child)`)
- `group` — transient ActiveSelection membership

`canvas.remove(group)` leaves both set. Two bugs resulted:
1. **Position jump** — `child.group` set → `payloadWithSceneCoords` in boardSync applied the group transform a second time → wrong DB write → `applyRemote` snapped objects to wrong positions.
2. **Unselectable after deselect** — `child.parent` set → Fabric v7's `ActiveSelection.exitGroup` calls `object.parent._enterGroup(object)` on deselect → child re-entered the removed Group, coordinates scrambled back to group-relative, objects unselectable.

**Fix:** Clear `childRaw.group = undefined` and `childRaw.parent = undefined` before `addTransformToObject` + `canvas.add` in `ungroupSelected()` and the Cmd+Shift+G keyboard handler in `FabricCanvas.tsx`.

### Implementation Notes
- Fabric.js manual `new Group(selectedObjects)` (not `toGroup()` — need control over ID/subtype and event sequencing)
- boardSync: subtype `container` vs sticky (no subtype) distinguishes container groups
- On Group: remove N children from canvas (emitRemove), create Group with subtype, add (emitAdd), compound history
- On Ungroup: remove group, apply `util.addTransformToObject(child, groupMatrix)`, set selectable/evented, add each child with new UUID, compound history — *bug above*
- Effort to fix ungroup: TBD

---

## 2. Free Draw / Pencil Tool — ✅ IMPLEMENTED (2026-02-19)

### Goal
tldraw-style freehand drawing — not straight lines, but pen/pencil strokes.

### Behavior
- Add "Draw" or "Pen" tool to toolbar
- When active: Fabric `isDrawingMode = true`
- Each stroke → `fabric.Path` (selectable, movable, synced)
- Brush options: color, width (reuse strokeUtils)

### Implementation (2026-02-19)
- **Tool:** "Draw" in toolbar Insert menu → Shapes section
- **Canvas:** `isDrawingMode` toggled when selectedTool === 'draw'
- **Brush:** #1e293b, 2px; `handleObjectAdded` assigns id + zIndex to Path for sync
- **Files:** FabricCanvas.tsx (isDrawingMode effect, handleObjectAdded), WorkspaceToolbar.tsx, tools.ts

---

## 3. Lasso Selection — ✅ IMPLEMENTED (2026-02-19)

### Goal
Draw a freeform path to select objects inside/intersecting the path. Alternative to box-select for irregular selections.

### Implementation (2026-02-19)
- **Tool:** "Lasso" in toolbar (next to Hand)
- **Canvas:** mousedown with lasso tool → discard selection, add transient Polyline preview; mousemove → append points to path; mouseup → remove preview, run point-in-polygon via Fabric `Intersection.isPointInPolygon`, set ActiveSelection. DOM capture (like marquee) so lasso works when starting on objects.
- **Point-in-polygon:** Object center (bbox centroid from `getCoords()`) tested against closed polygon. Requires 3+ points for selection.
- **Escape:** Cancels in-progress lasso (removes preview, clears listeners)
- **Files:** FabricCanvas.tsx (lassoState, onLassoMouseMove/Up, onCaptureMouseDown), tools.ts, WorkspaceToolbar.tsx

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

## 7. Duplicate — ✅ IMPLEMENTED (2026-02-19)

### Goal
Duplicate selected object(s) with one action. Creates a copy offset from the original.

### Implementation
- Cmd/Ctrl+D + toolbar Duplicate button in contextual row. Fabric `clone()` per object; new UUIDs; +20,+20 offset. Connectors floated via `floatConnectorBothEndpoints`. History compound add.

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

## 8. Copy & Paste — ✅ IMPLEMENTED (2026-02-19)

### Goal
Copy selected object(s) to clipboard; paste creates copies at cursor or center.

### Implementation
- Cmd/Ctrl+C copies to in-memory clipboard (clipboardStore.ts). Cmd/Ctrl+V pastes at cursor or viewport center. Connectors floated on paste. History compound add.

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

## 9. Marquee Mode (Box-select over objects) — ✅ IMPLEMENTED (2026-02-19)

### Goal
Fix: when user starts a drag on top of a large object, the selection marquee (grab box) does not appear — Fabric treats it as object selection/move instead. User wants to draw the marquee even when starting on an object.

### Implementation (2026-02-19)
- **Option A:** Alt held during drag (Select tool) → always start marquee, even over objects.
- **Behavior:** mouse:down with Alt+Select → discard selection, draw transient rect; mouse:move updates rect; mouse:up finds objects via `intersectsWithRect(tl, br)`, sets ActiveSelection.
- **Files:** FabricCanvas.tsx (handleMouseDown, handleMouseMove, handleMouseUp)
