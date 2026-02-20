# Connector Phase 2 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Miro-style connectors with hover glow, double-click-segment waypoint insertion, and right-click context menu (Reset route, Reverse direction).

**Architecture:** All three features extend the existing connector stack: `connectorFactory`, `connectorControls`, `connectorArrows`, and `FabricCanvas`. Glow uses Fabric `object:over`/`object:out`; segment waypoint uses point-to-segment distance hit-testing in `handleDblClick`; context menu uses `contextmenu` DOM event with React overlay or Radix.

**Tech Stack:** Fabric.js (object:over/out, Polyline), React, existing connector libs.

---

## 1. Hover Glow

**Scope:** When the pointer hovers over a connector line, it gets a subtle visual highlight (glow) so users know it's interactive.

**Approach A (recommended):** Use Fabric `object:over` / `object:out` on canvas. When `object:over` target is a connector, set transient props (`shadow`, or stroke color/width). On `object:out`, restore. Store original values in ref or on object.

**Approach B:** Same events, but add a `data.isHovered` flag and have `connectorArrows` or a custom `control`/`render` draw the glow in `after:render`. More complex, separates logic.

**Recommendation:** A — Fabric Polyline supports `shadow` and stroke props directly. Set `shadow: { blur: 8, color: 'rgba(37,99,235,0.4)' }` and `strokeWidth: 3` on hover; restore on out. Sync via `object:modified` must not pick up transient props — only persist on explicit user actions, not hover. Solution: don't call `emitModify` from hover; we're only changing transient visual state. BoardSync emits on `object:modified`; hover changes don't fire that if we avoid firing it. We must not call `canvas.fire('object:modified')` from our hover handler.

**Implementation:**
- FabricCanvas effect: `fabricCanvas.on('object:over', ...)` and `object:out`
- In handler: if `target` is connector, apply `set('shadow', {...})`, `set('strokeWidth', 3)`, `requestRenderAll()`
- On out: `set('shadow', null)`, `set('strokeWidth', 2)`, `requestRenderAll()`
- No boardSync involvement

**Files:** `FabricCanvas.tsx`

---

## 2. Double-Click Segment for Waypoint

**Scope:** Double-clicking on a connector **segment** (the line between two consecutive points) inserts a new waypoint at that position. Currently: double-click near a waypoint **handle** deletes it; segment **midpoint handles** exist but require drag. This adds: double-click anywhere on the segment → insert waypoint at click location.

**Approach A (recommended):** Extend `handleDblClick` in FabricCanvas. When target is connector and click isn't near an existing waypoint, compute distance from click point to each segment (line segment from `points[i]` to `points[i+1]`). Use point-to-segment distance formula. If distance < threshold (e.g. 12px in scene coords, zoom-aware), insert waypoint via `insertWaypoint(connector, canvas, segmentIndex, scenePoint)` and refresh waypoint controls.

**Approach B:** Add invisible wide stroke or hit-area per segment. Fabric doesn't make this trivial; point-to-segment math is simpler.

**Point-to-segment distance:** For segment A→B and point P:
- Vector AP, AB; project AP onto AB: `t = dot(AP, AB) / dot(AB, AB)`
- Clamp t in [0,1]; closest point = A + t*(B-A)
- Distance = |P - closest|

**Implementation:**
- New helper in `connectorFactory.ts` or `connectorUtils`: `findSegmentAtPoint(connector, scenePoint, threshold)` → `{ segmentIndex, nearestPoint } | null`
- Uses polyline points in scene coords (same logic as connectorArrows: pathOffset + calcTransformMatrix)
- In `handleDblClick`: if connector + no waypoint deleted, call `findSegmentAtPoint`; if found, `insertWaypoint(connector, canvas, segmentIndex, scenePoint)` (use `scenePoint` not `nearestPoint` for user intent — click position)
- Apply waypoint controls, fire `object:modified` for sync

**Files:** `connectorFactory.ts` (or new `connectorSegmentUtils.ts`), `FabricCanvas.tsx`

---

## 3. Right-Click Context Menu

**Scope:** Right-click on a connector opens a context menu with:
- **Reset route** — Remove all waypoints (connector becomes straight line between endpoints)
- **Reverse direction** — Swap source↔target (object IDs, ports, float points)

**Approach A (recommended):** Bind `contextmenu` on the canvas container (or upper canvas). Use `e.preventDefault()` to suppress browser menu. Get target via `canvas.findTarget(pointer)`. If connector: show a small React overlay (position: fixed at `e.clientX`, `e.clientY`), with two buttons. On Reset: `resetConnectorRoute(connector, canvas)`; on Reverse: `reverseConnectorDirection(connector, canvas)`. Close overlay on click outside or after action.

**Approach B:** Use Radix `@radix-ui/react-context-menu` — would require wrapping canvas in ContextMenu; more setup. A is simpler.

**New factory functions:**
- `resetConnectorRoute(connector, canvas)` — set `waypoints: []`, call `updateConnectorEndpoints`
- `reverseConnectorDirection(connector, canvas)` — swap `sourceObjectId`↔`targetObjectId`, `sourcePort`↔`targetPort`, `sourceFloatPoint`↔`targetFloatPoint`; call `updateConnectorEndpoints`

**Canvas config:** Add `fireRightClick: true` and `stopContextMenu: true` to Canvas constructor so we fully control right-click. (Fabric 2.7+)

**UI:** Minimal — two-item menu: "Reset route", "Reverse direction". Style to match WorkspaceToolbar (flat, subtle borders).

**Files:** `connectorFactory.ts` (reset/reverse), `FabricCanvas.tsx` (contextmenu handler + overlay), possibly `ConnectorContextMenu.tsx` (new component)

---

## Clarifications Needed

1. **Hover glow:** Interpreting "port hover glow" as connector-line hover (Option A from brainstorm). If you meant port circles glow instead, we can switch to that.
2. **Context menu:** Confirm Reset route = clear waypoints only; Reverse = swap source/target. No additional items.

---

## Summary

| Feature | Main change | Files |
|--------|------------|-------|
| Hover glow | object:over/out, transient shadow/strokeWidth | FabricCanvas.tsx |
| Double-click segment | findSegmentAtPoint + insertWaypoint in handleDblClick | connectorFactory or utils, FabricCanvas.tsx |
| Context menu | contextmenu handler, ConnectorContextMenu, reset/reverse | connectorFactory.ts, FabricCanvas.tsx, ConnectorContextMenu.tsx |

---

## Implementation Plan

### Task 1: Connector Factory — reset and reverse

**Files:**
- Modify: `src/features/workspace/lib/connectorFactory.ts`
- Test: `src/features/workspace/lib/connectorFactory.test.ts` (optional; manual test acceptable)

**Step 1: Add `resetConnectorRoute`**
- Export `resetConnectorRoute(connector: FabricObject, canvas: Canvas): void`
- Set `waypoints: []`, call `updateConnectorEndpoints`, fire `object:modified` so sync picks it up

**Step 2: Add `reverseConnectorDirection`**
- Export `reverseConnectorDirection(connector: FabricObject, canvas: Canvas): void`
- Swap sourceObjectId↔targetObjectId, sourcePort↔targetPort, sourceFloatPoint↔targetFloatPoint
- Call `updateConnectorEndpoints`, fire `object:modified`

**Step 3: Commit**
```bash
git add src/features/workspace/lib/connectorFactory.ts
git commit -m "feat(connector): add resetConnectorRoute and reverseConnectorDirection"
```

---

### Task 2: Segment hit-test utility

**Files:**
- Create: `src/features/workspace/lib/connectorSegmentUtils.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Step 1: Create `findSegmentAtPoint`**
- Export `findSegmentAtPoint(connector: FabricObject, scenePoint: {x,y}, threshold: number): { segmentIndex: number } | null`
- Get polyline points; convert to scene coords (pathOffset + calcTransformMatrix, same as connectorArrows)
- For each segment i (points[i]→points[i+1]): compute point-to-segment distance
- Return segmentIndex of segment with min distance < threshold

**Step 2: Commit**
```bash
git add src/features/workspace/lib/connectorSegmentUtils.ts
git commit -m "feat(connector): add findSegmentAtPoint for double-click waypoint"
```

---

### Task 3: Double-click segment inserts waypoint

**Files:**
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Import: `findSegmentAtPoint` from connectorSegmentUtils, `insertWaypoint` from connectorFactory

**Step 1: Extend handleDblClick**
- In connector branch: after the waypoint-delete loop (when no waypoint was deleted), call `findSegmentAtPoint(connector, clickPt, 12/zoom)`
- If found: `insertWaypoint(connector, fabricCanvas, result.segmentIndex, clickPt)`, `applyConnectorWaypointControls`, `requestRenderAll`, `fabricCanvas.fire('object:modified', { target: connector })`

**Step 2: Commit**
```bash
git add src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat(connector): double-click segment adds waypoint"
```

---

### Task 4: Hover glow

**Files:**
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Canvas: ensure `fireMiddleClick` / object events work (Fabric 6/7 may differ; check `object:over`/`object:out`)

**Step 1: Add object:over and object:out handlers**
- In the main canvas setup effect, add:
  - `fabricCanvas.on('object:over', (e) => { if (isConnector(e.target)) { e.target.set({ shadow: {...}, strokeWidth: 3 }); fabricCanvas.requestRenderAll(); } })`
  - `fabricCanvas.on('object:out', (e) => { if (isConnector(e.target)) { e.target.set({ shadow: null, strokeWidth: 2 }); fabricCanvas.requestRenderAll(); } })`
- Shadow: `{ blur: 8, color: 'rgba(37,99,235,0.4)' }`

**Step 2: Add cleanup in effect return**
- `fabricCanvas.off('object:over', handler)` and `object:out`

**Step 3: Commit**
```bash
git add src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat(connector): hover glow effect"
```

---

### Task 5: Connector context menu component

**Files:**
- Create: `src/features/workspace/components/ConnectorContextMenu.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Step 1: Create ConnectorContextMenu**
- Props: `{ screenX: number; screenY: number; onResetRoute: () => void; onReverseDirection: () => void; onClose: () => void }`
- Renders fixed-position div (screenX, screenY) with two buttons: "Reset route", "Reverse direction"
- Style: flat, borders, matches toolbar (see WorkspaceToolbar styles)
- Click outside to close (useEffect + mousedown listener, or Radix if already in deps)

**Step 2: Commit**
```bash
git add src/features/workspace/components/ConnectorContextMenu.tsx
git commit -m "feat(connector): ConnectorContextMenu component"
```

---

### Task 6: Right-click context menu wiring

**Files:**
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Canvas constructor: add `fireRightClick: true`, `stopContextMenu: true`

**Step 1: Add contextmenu listener**
- Attach to `canvasEl` or container: `onContextMenu` (React) or `addEventListener('contextmenu', ...)`
- Get pointer: `getPointer(ev)` or similar to get viewport coords
- `findTarget` with that pointer; if connector, set state: `connectorContextMenu: { screenX, screenY, connector } }`
- `ev.preventDefault()` to block browser menu

**Step 2: Render ConnectorContextMenu**
- When `connectorContextMenu` state set, render `<ConnectorContextMenu ... onResetRoute={...} onReverseDirection={...} onClose={() => setConnectorContextMenu(null)} />`
- Call `resetConnectorRoute` / `reverseConnectorDirection` from connectorFactory
- Fire `object:modified` (factory functions should do this)

**Step 3: Commit**
```bash
git add src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat(connector): right-click context menu (Reset route, Reverse direction)"
```

---

### Task 7: Integration test and docs update

**Files:**
- Modify: `memory-bank/activeContext.md`, `memory-bank/progress.md`, `docs/PLANNED_CANVAS_FEATURES.md`

**Step 1: Manual verification**
- Hover connector → glow appears
- Double-click connector segment → waypoint inserted
- Right-click connector → menu; Reset route clears waypoints; Reverse swaps arrows

**Step 2: Update memory bank**
- activeContext: mark Connector Phase 2 complete
- progress: update finished-product connectors bullet

**Step 3: Commit**
```bash
git add memory-bank docs/
git commit -m "docs: Connector Phase 2 complete"
```
