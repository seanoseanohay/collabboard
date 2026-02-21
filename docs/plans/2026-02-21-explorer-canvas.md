# Explorer Canvas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new "Expedition" board mode with enhanced drawing tools, new shapes, zoom-dependent visibility (Level of Detail), procedural + AI-generated pirate map seeding, Ports of Call bookmarks, mini-map navigator, optional Fog of War, hex grid, grid snap, and collaboration extras (laser pointer, follow mode). Standard boards also benefit from upgraded brushes and new shapes.

**Architecture:** A `board_mode` column on `boards` (`'standard' | 'explorer'`) gates explorer-exclusive features. Standard boards get all new tools/shapes. Explorer boards additionally get LOD visibility, scale band HUD, Ports of Call, mini-map, hex grid default, fog of war toggle, and auto-generated map content on creation. The procedural map generator creates ~40–80 canvas objects instantly; an optional AI call enriches names/descriptions in the background.

**Tech Stack:** React, TypeScript, Fabric.js v7 (`Polygon`, `Ellipse`, `CircleBrush`, `SprayBrush`, `PatternBrush`), Supabase PostgreSQL + Realtime + Edge Functions, OpenAI gpt-4o-mini.

---

## Reference Files

Read these before starting each task — they contain the patterns everything else follows:

- `src/features/workspace/lib/shapeFactory.ts` — createShape, all shape tool cases, ToolType switch
- `src/features/workspace/types/tools.ts` — ToolType union, SHAPE_TOOLS array, isShapeTool
- `src/features/workspace/components/DrawBrushControl.tsx` — current brush UI (select dropdown, 4 sizes)
- `src/features/workspace/components/FabricCanvas.tsx` — imperative handles, drawing mode, brush setup, notifyViewport, handleObjectAdded
- `src/features/workspace/components/WorkspaceToolbar.tsx` — TOOLS, INSERT_TOOLS, ToolIcons, toolbar layout
- `src/features/workspace/components/WorkspacePage.tsx` — board prop, viewportTransform state, handleViewportChange
- `src/features/workspace/lib/fabricCanvasZoom.ts` — MIN_ZOOM, MAX_ZOOM, createZoomHandlers
- `src/features/workspace/lib/drawCanvasGrid.ts` — 20px square grid in before:render hook
- `src/features/workspace/lib/templateRegistry.ts` — TemplateSpec, TemplateObjectSpec
- `src/features/workspace/lib/executeAiCommands.ts` — executeAiCommands, ExecuteAiOptions, applyTemplate handler
- `src/features/workspace/api/aiInterpretApi.ts` — AiCommand union, invokeAiInterpret, detectTemplateLocally
- `src/features/boards/api/boardsApi.ts` — BoardMeta, createBoard, joinBoard
- `src/features/boards/components/BoardListPage.tsx` — handleCreate, board cards, creation button
- `src/features/boards/components/BoardPage.tsx` — loads BoardMeta, renders WorkspacePage
- `src/features/workspace/components/MapBorderOverlay.tsx` — parchment border, zoom-aware opacity
- `src/features/workspace/lib/boardSync.ts` — emitAdd, emitModify, applyRemote, object data serialization
- `src/features/workspace/lib/viewportPersistence.ts` — save/load viewport per board

---

## Parallel Execution Guide

Tasks are organized into parallel groups. Tasks within a group can run simultaneously (different files/areas). Tasks across groups must run in sequence.

| Group | Tasks | Notes |
|-------|-------|-------|
| **A** (infrastructure) | 1 | ✅ DB migration + BoardMeta + createBoard + creation UI. Foundation for everything. |
| **B** (all-boards tools) | 2, 3, 4 | ✅ Brush slider, new shapes, freeform polygon. Independent files. Run in parallel. |
| **C** (explorer-exclusive) | 5, 6, 7 | ✅ LOD visibility, scale band HUD, Ports of Call. Depend on board_mode from Group A. Run in parallel with each other. |
| **D** (explorer-exclusive) | 8, 9 | ✅ Mini-map, hex grid + snap. Depend on Group A. Run in parallel with each other. |
| **E** (map generation) | 10 | ✅ Procedural + AI map seeding. Depends on Groups A + B (needs new shapes) + C (needs LOD). |
| **F** (optional/collab) | 11, 12, 13 | ✅ 2026-02-21 — Fog of War, laser pointer, follow mode. Independent of each other. Run in parallel. |
| **G** (polish) | 14 | Pending — Animated zoom transitions, advanced shapes (arrow, bezier). Run last. |

---

## Task 1: Board Mode Infrastructure

**Files:**
- New migration: `supabase/migrations/20260221000000_board_mode.sql`
- Modify: `src/features/boards/api/boardsApi.ts`
- Modify: `src/features/boards/components/BoardListPage.tsx`
- Modify: `src/features/boards/components/BoardPage.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Goal:** Add `board_mode` column to `boards`, thread it through the full component tree, and add a creation picker UI.

**Step 1: Migration**

```sql
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_mode TEXT NOT NULL DEFAULT 'standard';
```

**Step 2: Update `boardsApi.ts`**

Add `boardMode` to `BoardMeta`:

```ts
export interface BoardMeta {
  id: string
  title: string
  createdAt: number
  lastAccessedAt: number
  isPublic?: boolean
  ownerId?: string
  objectCount?: number
  thumbnailUrl?: string
  boardMode?: 'standard' | 'explorer'
}
```

Update `createBoard` to accept `boardMode`:

```ts
export async function createBoard(
  userId: string,
  title: string = 'Untitled Board',
  boardMode: 'standard' | 'explorer' = 'standard'
): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .insert({ title, owner_id: userId, board_mode: boardMode })
    .select('id')
    .single()
  // ... rest unchanged
}
```

Update all places that read board data (`joinBoard`, `subscribeToUserBoards`, `fetchPublicBoards`) to include `board_mode` in selects and map to `boardMode` in `BoardMeta`.

Also update `get_user_boards_with_counts` RPC if needed (migration may need to update the function return type).

**Step 3: Update `BoardListPage.tsx` — Creation Picker**

Replace the single "New Board" button with a dropdown that opens on click:

```tsx
const [createMenuOpen, setCreateMenuOpen] = useState(false)

const handleCreate = async (mode: 'standard' | 'explorer') => {
  setCreating(true)
  setCreateMenuOpen(false)
  try {
    const title = mode === 'explorer' ? 'Untitled Expedition' : 'Untitled Board'
    const boardId = await createBoard(userId, title, mode)
    navigate(`/board/${boardId}`)
  } finally {
    setCreating(false)
  }
}
```

Dropdown UI (positioned below the button):
- **"⚓ New Board"** — calls `handleCreate('standard')`
- **"🗺️ New Expedition"** — calls `handleCreate('explorer')`

Style the dropdown consistent with the existing insert menu pattern in `WorkspaceToolbar.tsx` (absolute positioned, border, shadow, z-index).

Add a `🗺️` badge on board cards where `board.boardMode === 'explorer'` (next to the existing `🌐` public badge).

**Step 4: Thread `boardMode` through components**

`BoardPage.tsx` already passes `board` to `WorkspacePage`. No change needed — `boardMode` is part of `BoardMeta`.

`WorkspacePage.tsx`:
- Derive `const isExplorer = board.boardMode === 'explorer'`
- Default `showMapBorder` to `isExplorer` instead of `true`
- Pass `boardMode={board.boardMode}` to `WorkspaceToolbar` and `FabricCanvas`

`WorkspaceToolbar.tsx`:
- Add `boardMode?: 'standard' | 'explorer'` to props
- (Used in later tasks to conditionally show explorer-only controls)

`FabricCanvas.tsx`:
- Add `boardMode?: 'standard' | 'explorer'` to `FabricCanvasProps`
- Store in a ref: `const boardModeRef = useRef(boardMode)`
- (Used in later tasks for LOD visibility)

**Acceptance criteria:**
- [ ] New board created with `board_mode = 'standard'` by default
- [ ] "New Expedition" creates board with `board_mode = 'explorer'`
- [ ] Explorer boards show `🗺️` badge on board list cards
- [ ] `boardMode` available as prop in WorkspacePage, Toolbar, and FabricCanvas
- [ ] Explorer boards default map border ON; standard boards default OFF

---

## Task 2: Brush Size Slider + Brush Types + Opacity + Eraser

**Files:**
- Rewrite: `src/features/workspace/components/DrawBrushControl.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`

**Goal:** Replace the 4-option brush dropdown with a full drawing toolkit: log-scale size slider (1–512px), brush type selector (pencil/circle/spray/pattern), opacity slider, eraser mode, and a live cursor size preview.

**Step 1: Rewrite `DrawBrushControl.tsx`**

Replace the `<select>` with:

1. **Brush type row** — 4 icon buttons: Pencil (current), Dots (`CircleBrush`), Spray (`SprayBrush`), Pattern (`PatternBrush`). Active button highlighted. Plus an Eraser toggle button.

2. **Size slider** — `<input type="range" min={0} max={1} step={0.001}>` with logarithmic mapping:

```ts
const BRUSH_MIN = 1
const BRUSH_MAX = 512

function brushToSlider(w: number): number {
  return (Math.log(Math.max(BRUSH_MIN, w)) - Math.log(BRUSH_MIN)) /
         (Math.log(BRUSH_MAX) - Math.log(BRUSH_MIN))
}

function sliderToBrush(v: number): number {
  return Math.round(
    Math.exp(Math.log(BRUSH_MIN) + v * (Math.log(BRUSH_MAX) - Math.log(BRUSH_MIN)))
  )
}
```

3. **Numeric readout** — `{brushWidth}px` label next to the slider.

4. **Opacity slider** — `<input type="range" min={0} max={100}>`, default 100%. Label shows `{opacity}%`.

5. **Color picker** — Keep existing `<input type="color">`.

State: `brushType`, `brushWidth`, `brushColor`, `brushOpacity`, `eraserActive`.

Expose all values via callbacks to parent, or call `canvasRef.current?.setDrawBrush*(...)` directly (current pattern).

**Step 2: Update `FabricCanvas.tsx` — brush switching**

Add new imperative handles:

```ts
setDrawBrushType: (type: 'pencil' | 'circle' | 'spray' | 'pattern') => void
setDrawBrushOpacity: (opacity: number) => void  // 0–1
setDrawEraserMode: (active: boolean) => void
```

Implementation:

```ts
setDrawBrushType: (type) => {
  const canvas = canvasRef.current
  if (!canvas) return
  const color = canvas.freeDrawingBrush?.color ?? '#1e293b'
  const width = canvas.freeDrawingBrush?.width ?? 2
  switch (type) {
    case 'pencil':  canvas.freeDrawingBrush = new PencilBrush(canvas); break
    case 'circle':  canvas.freeDrawingBrush = new CircleBrush(canvas); break
    case 'spray':   canvas.freeDrawingBrush = new SprayBrush(canvas); break
    case 'pattern': canvas.freeDrawingBrush = new PatternBrush(canvas); break
  }
  canvas.freeDrawingBrush.color = color
  canvas.freeDrawingBrush.width = width
},
```

Update imports to include `CircleBrush, SprayBrush, PatternBrush` from `'fabric'`.

For eraser mode: In `handleObjectAdded`, when `eraserActive` is true and `obj.type === 'path'`, set `obj.globalCompositeOperation = 'destination-out'` and `obj.stroke = 'rgba(0,0,0,1)'`. Store eraser state in a ref (`eraserActiveRef`).

For opacity: In `handleObjectAdded`, when a new path is created, set `obj.opacity = brushOpacityRef.current`. The opacity is per-object (applied after creation), not per-brush-stroke.

**Step 3: Cursor size preview**

In `WorkspacePage.tsx`, when `selectedTool === 'draw'`, render a cursor preview div:

```tsx
{selectedTool === 'draw' && cursorPosition && viewportTransform && (
  <div style={{
    position: 'absolute',
    left: cursorPosition.x * zoom + panX - (brushWidth * zoom) / 2,
    top: cursorPosition.y * zoom + panY - (brushWidth * zoom) / 2,
    width: brushWidth * zoom,
    height: brushWidth * zoom,
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.3)',
    pointerEvents: 'none',
    zIndex: 10,
  }} />
)}
```

This requires lifting `brushWidth` state from `DrawBrushControl` to `WorkspacePage` (or using a ref). The `cursorPosition` and `viewportTransform` are already in `WorkspacePage` state.

**Acceptance criteria:**
- [ ] Brush size slider with log scale, range 1–512px, numeric readout
- [ ] Four brush types switchable (pencil, circle dots, spray, pattern)
- [ ] Opacity slider (0–100%), applied to created paths
- [ ] Eraser mode creates paths with `globalCompositeOperation: 'destination-out'`
- [ ] Live circular cursor preview follows mouse when draw tool active, sized to brush width * zoom
- [ ] All created paths sync via existing boardSync (no sync changes needed)
- [ ] Default brush: pencil, 2px, 100% opacity, #1e293b

---

## Task 3: New Shape Tools — Ellipse, Polygon, Star

**Files:**
- Modify: `src/features/workspace/types/tools.ts`
- Modify: `src/features/workspace/lib/shapeFactory.ts`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/lib/shapeFactory.test.ts`

**Goal:** Add ellipse, regular polygon (3–12 sides), and star shapes. All modes.

**Step 1: Update `tools.ts`**

Add to `ToolType` union: `'ellipse'`, `'polygon'`.

Add `'ellipse'` and `'polygon'` to `SHAPE_TOOLS` array.

**Step 2: Update `shapeFactory.ts`**

Import `Ellipse` and `Polygon` from `'fabric'`.

Add `createShape` cases:

```ts
case 'ellipse': {
  const rx = width / 2
  const ry = height / 2
  return withId(new Ellipse({
    ...baseOpts,
    left,
    top,
    rx,
    ry,
    fill: FILL,
  }))
}

case 'polygon': {
  // Default 6 sides (hexagon). Sides configurable via options.polygonSides.
  const sides = options?.polygonSides ?? 6
  const isStarMode = options?.starMode ?? false
  const cx = left + width / 2
  const cy = top + height / 2
  const outerR = Math.min(width, height) / 2
  const innerR = outerR * 0.4  // star inner radius ratio

  const points: Array<{ x: number; y: number }> = []
  const totalPoints = isStarMode ? sides * 2 : sides
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * 2 * Math.PI) / totalPoints - Math.PI / 2
    const r = isStarMode ? (i % 2 === 0 ? outerR : innerR) : outerR
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }
  return withId(new Polygon(points, {
    ...baseOpts,
    fill: FILL,
  }))
}
```

Update the `options` parameter type:

```ts
options?: { assignId?: boolean; zoom?: number; polygonSides?: number; starMode?: boolean }
```

**Step 3: Update `WorkspaceToolbar.tsx`**

Add `ToolIcons` for `ellipse` and `polygon`:

```tsx
ellipse: (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="10" ry="6" />
  </svg>
),
polygon: (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <polygon points="12,2 22,8.5 19,20 5,20 2,8.5" />
  </svg>
),
```

Add entries to `TOOLS` array and `INSERT_TOOLS`.

When polygon tool is selected, show a **sides selector** in the contextual toolbar row:
- Number input (3–12), default 6
- Star toggle checkbox
- Store in `WorkspacePage` state: `polygonSides`, `starMode`
- Pass to `FabricCanvas` as props, forwarded to `createShape` options

**Step 4: Update `FabricCanvas.tsx`**

Add `polygonSides` and `starMode` to `FabricCanvasProps`. Store in refs. Pass to `createShape(tool, x1, y1, x2, y2, { polygonSides, starMode })` in the mouseUp shape creation path.

**Step 5: Update tests**

Add `'ellipse'` and `'polygon'` to the `SHAPE_TOOLS` array in `shapeFactory.test.ts`. Add specific tests:
- Ellipse has `rx` and `ry`
- Polygon default 6 sides has 6 points
- Star mode has `sides * 2` points

**Acceptance criteria:**
- [ ] Ellipse tool: drag to draw, `rx`/`ry` from bounding box
- [ ] Polygon tool: drag to draw, configurable 3–12 sides, default hexagon
- [ ] Star mode: toggle produces star shapes with alternating radii
- [ ] Both shapes have icons in toolbar, appear in Insert menu
- [ ] Shapes sync via existing boardSync (no changes needed — they're standard Fabric objects)
- [ ] Tests pass

---

## Task 4: Freeform Polygon Tool

**Files:**
- Modify: `src/features/workspace/types/tools.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`

**Goal:** Click-to-place vertices, double-click to close. Creates a filled `Polygon`. Essential for drawing territories, coastlines, regions.

**Step 1: Add `'polygon-draw'` to `ToolType`**

**Step 2: Implement in `FabricCanvas.tsx`**

State: `polygonDrawPoints: Array<{x: number, y: number}>`, `polygonDrawPreview: Polyline | null`.

On mouseDown with `polygon-draw` tool:
- Convert click to scene coordinates
- Append point to `polygonDrawPoints`
- If first point: create a transient `Polyline` preview (stroke `#6366f1`, strokeDashArray `[4,4]`, no fill, `selectable: false, evented: false`)
- If subsequent: update the Polyline points to include new point + cursor position

On mouseMove (when polygon-draw active and points.length > 0):
- Update last point of the preview Polyline to cursor position (rubber-band effect)

On doubleClick (or when clicking within 10px of the first point):
- Close the polygon: create a `Polygon` from the accumulated points
- Assign ID, set fill (`#fff`), stroke, z-index
- Add to canvas, emit via boardSync
- Remove the preview Polyline
- Clear state
- Switch back to select tool

On Escape:
- Remove preview, clear points, switch to select

**Step 3: Add icon and toolbar entry**

```tsx
'polygon-draw': (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 17L9 3l8 6 4 12H3z" strokeDasharray="2 2" />
    <circle cx="3" cy="17" r="2" fill="currentColor" />
    <circle cx="9" cy="3" r="2" fill="currentColor" />
    <circle cx="17" cy="9" r="2" fill="currentColor" />
    <circle cx="21" cy="21" r="2" fill="currentColor" />
  </svg>
),
```

Add to `TOOLS`, `INSERT_TOOLS`.

**Acceptance criteria:**
- [ ] Click places vertices with visual preview (dashed polyline)
- [ ] Double-click (or click near start) closes polygon
- [ ] Created polygon has fill, stroke, ID, syncs via boardSync
- [ ] Escape cancels in-progress polygon draw
- [ ] Minimum 3 points required to create polygon
- [ ] Tool returns to select after creation

---

## Task 5: Zoom-Dependent Visibility (Level of Detail)

**Files:**
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/lib/boardSync.ts`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`
- New: `src/features/workspace/lib/scaleBands.ts`

**Goal:** Objects can have a visibility zoom range (`minZoom`, `maxZoom`). Outside that range, they are hidden. Explorer mode only.

**Step 1: Create `scaleBands.ts`**

```ts
export interface ScaleBand {
  id: string
  name: string
  emoji: string
  minZoom: number
  maxZoom: number
}

export const SCALE_BANDS: ScaleBand[] = [
  { id: 'ocean',    name: 'Ocean',    emoji: '🌊', minZoom: 0,    maxZoom: 0.05 },
  { id: 'voyage',   name: 'Voyage',   emoji: '⛵', minZoom: 0.05, maxZoom: 0.25 },
  { id: 'harbor',   name: 'Harbor',   emoji: '⚓', minZoom: 0.25, maxZoom: 1.0  },
  { id: 'deck',     name: 'Deck',     emoji: '🏴‍☠️', minZoom: 1.0,  maxZoom: 4.0  },
  { id: 'spyglass', name: 'Spyglass', emoji: '🔭', minZoom: 4.0,  maxZoom: Infinity },
]

export const ALL_SCALES_ID = 'all'

export function getScaleBandForZoom(zoom: number): ScaleBand {
  return SCALE_BANDS.find(b => zoom >= b.minZoom && zoom < b.maxZoom) ?? SCALE_BANDS[2]
}

export function isVisibleAtZoom(
  obj: { data?: { minZoom?: number; maxZoom?: number } },
  zoom: number
): boolean {
  const min = obj.data?.minZoom
  const max = obj.data?.maxZoom
  if (min == null && max == null) return true  // "all scales" default
  if (min != null && zoom < min) return false
  if (max != null && max !== Infinity && zoom >= max) return false
  return true
}
```

**Step 2: Update `FabricCanvas.tsx` — visibility updates in `notifyViewport`**

In the `notifyViewport` callback (which fires on every pan/zoom), add:

```ts
if (boardModeRef.current === 'explorer') {
  const zoom = fabricCanvas.getZoom()
  for (const obj of fabricCanvas.getObjects()) {
    const data = obj.get('data') as { minZoom?: number; maxZoom?: number } | undefined
    if (data?.minZoom != null || data?.maxZoom != null) {
      const shouldShow = isVisibleAtZoom({ data }, zoom)
      if (obj.visible !== shouldShow) {
        obj.visible = shouldShow
        obj.evented = shouldShow
      }
    }
  }
}
```

Performance note: This iterates all objects on every zoom change. For boards with <500 objects (our target), this is <1ms. If needed later, maintain a `Set` of objects that have scale bands to avoid iterating non-banded objects.

**Step 3: Update `boardSync.ts` — serialize `minZoom`/`maxZoom`**

In `emitAdd` and `buildPayload`: if `data.minZoom` or `data.maxZoom` exists, include in payload.

In `applyRemote`: restore `minZoom`/`maxZoom` from payload into object `data`.

These fields already live in the object's `data` property, which is serialized generically. Verify that the existing `data` serialization path captures arbitrary keys. If it does (likely — `data` is spread into the payload), no change needed. If not, explicitly include `minZoom` and `maxZoom`.

**Step 4: Update `WorkspaceToolbar.tsx` — scale band assignment**

When `boardMode === 'explorer'` and an object is selected, show a "Visibility" dropdown:

```tsx
{boardMode === 'explorer' && selectionStroke && (
  <select onChange={(e) => canvasRef.current?.setActiveObjectScaleBand?.(e.target.value)}>
    <option value="all">All Scales</option>
    {SCALE_BANDS.map(b => (
      <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
    ))}
  </select>
)}
```

Add `setActiveObjectScaleBand` to `FabricCanvasZoomHandle`:

```ts
setActiveObjectScaleBand: (bandId: string) => {
  const canvas = canvasRef.current
  const active = canvas?.getActiveObject()
  if (!active) return
  const band = SCALE_BANDS.find(b => b.id === bandId)
  const data = (active.get('data') as Record<string, unknown>) ?? {}
  if (band) {
    active.set('data', { ...data, minZoom: band.minZoom, maxZoom: band.maxZoom })
  } else {
    const { minZoom, maxZoom, ...rest } = data as Record<string, unknown>
    active.set('data', rest)
  }
  canvas?.fire('object:modified', { target: active })
}
```

**Acceptance criteria:**
- [ ] Objects with `minZoom`/`maxZoom` in data are hidden/shown based on current zoom
- [ ] Only active in explorer mode (standard boards: all objects always visible)
- [ ] Default objects have no scale band (visible at all zoom levels)
- [ ] Scale band can be assigned via toolbar dropdown when object is selected
- [ ] Scale band persists to Supabase and restores on reload
- [ ] No visible performance impact with <500 objects

---

## Task 6: Scale Band Indicator HUD

**Files:**
- New: `src/features/workspace/components/ScaleBandIndicator.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`

**Goal:** A small HUD element showing the current scale band name. Explorer mode only.

**Implementation:**

```tsx
import { getScaleBandForZoom } from '../lib/scaleBands'

interface ScaleBandIndicatorProps {
  zoom: number
}

export function ScaleBandIndicator({ zoom }: ScaleBandIndicatorProps) {
  const band = getScaleBandForZoom(zoom)
  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      right: 16,
      padding: '4px 10px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid #e5e7eb',
      fontSize: 12,
      color: '#374151',
      pointerEvents: 'none',
      zIndex: 6,
      backdropFilter: 'blur(4px)',
    }}>
      {band.emoji} {band.name} View
    </div>
  )
}
```

In `WorkspacePage.tsx`, render conditionally:

```tsx
{isExplorer && viewportTransform && (
  <ScaleBandIndicator zoom={viewportTransform[0]} />
)}
```

**Acceptance criteria:**
- [ ] Shows current scale band name with emoji (e.g. "⚓ Harbor View")
- [ ] Updates in real-time as user zooms
- [ ] Only visible in explorer mode
- [ ] Positioned bottom-right, non-interactive, visually subtle

---

## Task 7: Ports of Call (Bookmarks)

**Files:**
- New: `src/features/workspace/lib/portsOfCall.ts`
- New: `src/features/workspace/components/PortsOfCallPanel.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`

**Goal:** Save and recall named zoom positions. Explorer mode only.

**Step 1: Create `portsOfCall.ts`**

```ts
export interface PortOfCall {
  id: string
  name: string
  x: number
  y: number
  zoom: number
  icon?: string
}

const STORAGE_KEY = (boardId: string) => `meboard:ports:${boardId}`

export function loadPorts(boardId: string): PortOfCall[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(boardId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function savePorts(boardId: string, ports: PortOfCall[]): void {
  localStorage.setItem(STORAGE_KEY(boardId), JSON.stringify(ports))
}

export function addPort(boardId: string, port: PortOfCall): void {
  const ports = loadPorts(boardId)
  ports.push(port)
  savePorts(boardId, ports)
}

export function removePort(boardId: string, portId: string): void {
  const ports = loadPorts(boardId).filter(p => p.id !== portId)
  savePorts(boardId, ports)
}
```

**Step 2: Create `PortsOfCallPanel.tsx`**

A collapsible panel toggled from the toolbar. Shows:
- List of saved ports (name, icon, zoom level label)
- Click to navigate (animate pan — see Task 14)
- Delete button per port
- "Save current view" button at the bottom (prompts for name via `prompt()`)

Position: Absolute, anchored to toolbar button, z-index above canvas.

**Step 3: Wire in `WorkspacePage.tsx`**

State: `portsOpen: boolean`. Toggle via toolbar button.

Navigation callback:

```ts
const handlePortNavigate = (port: PortOfCall) => {
  canvasZoomRef.current?.panToScene(port.x, port.y)
  canvasZoomRef.current?.setZoom(port.zoom)
}
```

**Step 4: Toolbar button**

In `WorkspaceToolbar.tsx`, when `boardMode === 'explorer'`:

```tsx
<button onClick={onPortsToggle} title="Ports of Call">
  🧭
</button>
```

**Acceptance criteria:**
- [ ] Can save current viewport as a named port
- [ ] Ports list shows all saved ports for this board
- [ ] Clicking a port navigates to that position and zoom
- [ ] Can delete individual ports
- [ ] Persists to localStorage per board
- [ ] Only available in explorer mode
- [ ] Panel is closable

---

## Task 8: Mini-Map Navigator

**Files:**
- New: `src/features/workspace/components/MiniMapNavigator.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Goal:** A small overview rectangle in the corner showing the full canvas and current viewport position. Explorer mode only.

**Step 1: Create `MiniMapNavigator.tsx`**

Props: `canvasRef`, `viewportTransform`, `canvasWidth`, `canvasHeight`.

Implementation:
- A 200x140px `<canvas>` element in bottom-left corner
- Every 2 seconds (via `setInterval`), or on object add/remove, call `canvasRef.current?.getMiniMapData()` which returns:
  - `imageDataUrl`: a low-res capture of all objects
  - `contentBounds`: `{minX, minY, maxX, maxY}` of all objects
- Draw the image data on the mini canvas
- Overlay a semi-transparent blue rectangle representing the current viewport bounds (computed from `viewportTransform` and canvas dimensions)
- Click on the mini-map: compute the scene coordinate from click position, call `canvasRef.current?.panToScene(x, y)`

**Step 2: Add `getMiniMapData` to `FabricCanvasZoomHandle`**

```ts
getMiniMapData: () => {
  const canvas = canvasRef.current
  if (!canvas) return null
  const objs = canvas.getObjects()
  if (objs.length === 0) return null

  // Compute content bounds
  const bounds = objs.reduce((acc, obj) => {
    const b = obj.getBoundingRect(true)
    return {
      minX: Math.min(acc.minX, b.left),
      minY: Math.min(acc.minY, b.top),
      maxX: Math.max(acc.maxX, b.left + b.width),
      maxY: Math.max(acc.maxY, b.top + b.height),
    }
  }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })

  // Save current viewport, zoom to fit, capture, restore
  const savedVpt = [...canvas.viewportTransform!]
  const padding = 50
  const cw = bounds.maxX - bounds.minX + padding * 2
  const ch = bounds.maxY - bounds.minY + padding * 2
  const fitZoom = Math.min(200 / cw, 140 / ch)
  canvas.viewportTransform![0] = fitZoom
  canvas.viewportTransform![3] = fitZoom
  canvas.viewportTransform![4] = -(bounds.minX - padding) * fitZoom
  canvas.viewportTransform![5] = -(bounds.minY - padding) * fitZoom
  canvas.requestRenderAll()
  const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.3, width: 200, height: 140 })

  // Restore viewport
  for (let i = 0; i < 6; i++) canvas.viewportTransform![i] = savedVpt[i]
  canvas.requestRenderAll()

  return { imageDataUrl: dataUrl, contentBounds: bounds }
}
```

**Style:** Sepia-tinted border (matches parchment theme), slight shadow, 0.85 opacity. Title: "Chart" in small text above.

**Acceptance criteria:**
- [ ] Mini-map visible in bottom-left corner (explorer mode only)
- [ ] Shows overview of all canvas objects
- [ ] Blue rectangle shows current viewport position
- [ ] Clicking mini-map pans the canvas to that location
- [ ] Updates periodically (every 2s) and on object count changes
- [ ] Non-intrusive, semi-transparent, parchment-styled border

---

## Task 9: Hex Grid + Grid Snap

**Files:**
- Modify: `src/features/workspace/lib/drawCanvasGrid.ts`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/lib/boardSync.ts`

**Goal:** Hex grid rendering option (default in explorer), snap-to-grid toggle.

**Step 1: Add hex grid rendering to `drawCanvasGrid.ts`**

Add a second export function `drawHexGrid(canvas: Canvas)`:

```ts
const HEX_SIZE = 20 // same as GRID_SIZE for consistency

export function drawHexGrid(canvas: Canvas): void {
  const ctx = canvas.getContext()
  const vpt = canvas.viewportTransform
  if (!ctx || !vpt) return
  const zoom = vpt[0]
  const panX = vpt[4]
  const panY = vpt[5]
  const hexW = HEX_SIZE * 1.5 * zoom
  const hexH = HEX_SIZE * Math.sqrt(3) * zoom
  if (hexH < 4) return  // too small to render

  const w = canvas.width ?? 0
  const h = canvas.height ?? 0

  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 0.5

  // Calculate visible hex range
  const cols = Math.ceil(w / hexW) + 2
  const rows = Math.ceil(h / hexH) + 2
  const startCol = Math.floor(-panX / hexW) - 1
  const startRow = Math.floor(-panY / hexH) - 1

  for (let row = startRow; row < startRow + rows; row++) {
    for (let col = startCol; col < startCol + cols; col++) {
      const cx = col * hexW * zoom + panX + (row % 2 ? hexW / 2 : 0)
      const cy = row * hexH * zoom + panY
      drawHexagon(ctx, cx, cy, HEX_SIZE * zoom)
    }
  }

  ctx.restore()
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}
```

**Step 2: Grid type toggle**

Add `gridType: 'square' | 'hex' | 'none'` state to `WorkspacePage`. Default: `'hex'` for explorer, `'square'` for standard.

Pass to `FabricCanvas` as prop. In the `before:render` listener, call `drawCanvasGrid` or `drawHexGrid` based on the prop.

Toolbar: A grid toggle button group (3 states: square, hex, off). Only show hex option when `boardMode === 'explorer'` (or always — hex grid is cool for anyone).

**Step 3: Grid snap**

Add `snapToGrid: boolean` state to `WorkspacePage`. Default `false`. Toggle via 🧲 button in toolbar.

Pass to `FabricCanvas`. In `object:modified` handler, when `snapToGrid` is true:

```ts
if (snapToGridRef.current) {
  const gridSize = GRID_SIZE  // 20
  obj.set('left', Math.round(obj.left! / gridSize) * gridSize)
  obj.set('top', Math.round(obj.top! / gridSize) * gridSize)
  obj.setCoords()
  canvas.requestRenderAll()
}
```

(For hex grid snap, snap to nearest hex center — more complex geometry but same principle.)

**Acceptance criteria:**
- [ ] Hex grid renders correctly, transforms with viewport
- [ ] Grid type toggleable: square / hex / off
- [ ] Explorer boards default to hex grid
- [ ] Snap-to-grid toggle (🧲) snaps objects to nearest grid point on drop
- [ ] Grid disappears at very low zoom (same as square grid behavior)

---

## Task 10: Procedural + AI Expedition Map Generator

**Files:**
- New: `src/features/workspace/lib/expeditionMapGenerator.ts`
- New: `src/features/workspace/lib/expeditionThemes.ts`
- Modify: `src/features/workspace/lib/executeAiCommands.ts`
- Modify: `src/features/workspace/api/aiInterpretApi.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`

**Goal:** When an expedition board is created, auto-generate a multi-scale pirate map using procedural generation + optional AI enrichment.

**Step 1: Create `expeditionThemes.ts`**

```ts
export interface ExpeditionTheme {
  id: string
  name: string
  emoji: string
  landFills: string[]      // earth-tone fills for continents
  waterFill: string        // ocean background color concept
  accentColor: string
  continentNames: string[]
  islandNames: string[]
  townNames: string[]
  oceanNames: string[]
  landmarks: string[]
}

export const EXPEDITION_THEMES: ExpeditionTheme[] = [
  {
    id: 'pirate-seas',
    name: 'Pirate Seas',
    emoji: '🏴‍☠️',
    landFills: ['#8fbc8f', '#deb887', '#c2b280', '#9acd32', '#d2b48c'],
    waterFill: '#b3d9ff',
    accentColor: '#8b6914',
    continentNames: ['Emerald Atoll', 'The Shattered Isles', 'Windward Reach', 'Kraken\'s Maw', 'Serpent\'s Spine'],
    islandNames: ['Skull Rock', 'Pelican Point', 'Coral Cay', 'Driftwood Isle', 'Anchor Bay', 'Parrot Perch', 'Barnacle Reef', 'Tidecrest'],
    townNames: ['Port Raven', 'Rusty Anchor', 'The Crow\'s Nest', 'Blackwater Harbor', 'Smuggler\'s Den', 'Quartermaster\'s Rest'],
    oceanNames: ['The Sargasso Deep', 'Calm Waters', 'Northern Passage', 'The Devil\'s Strait', 'Whispering Tides'],
    landmarks: ['Here Be Dragons', 'The Maelstrom', 'Treasure of the Ancients', 'The Sunken Cathedral', 'Ghost Ship Graveyard'],
  },
  // Add more themes: frozen-north, volcanic-chain, jungle-depths, desert-crossing
]
```

Include at least 3 themes with 5+ entries per name bank.

**Step 2: Create `expeditionMapGenerator.ts`**

```ts
import type { ExpeditionTheme } from './expeditionThemes'
import { SCALE_BANDS } from './scaleBands'

interface MapObject {
  type: 'rect' | 'circle' | 'ellipse' | 'text' | 'sticky' | 'polygon'
  left: number
  top: number
  width: number
  height: number
  fill?: string
  stroke?: string
  text?: string
  fontSize?: number
  minZoom?: number    // scale band visibility
  maxZoom?: number
  polygonSides?: number
}

interface GeneratedMap {
  objects: MapObject[]
  viewportCenter: { x: number; y: number }
  initialZoom: number
}

export function generateExpeditionMap(theme: ExpeditionTheme, seed?: number): GeneratedMap {
  const rng = seededRandom(seed ?? Date.now())

  const MAP_WIDTH = 20000
  const MAP_HEIGHT = 15000
  const objects: MapObject[] = []

  // --- Ocean scale: large continents ---
  const continentCount = 3 + Math.floor(rng() * 3)  // 3–5
  const continents: Array<{ x: number; y: number; w: number; h: number; name: string }> = []

  for (let i = 0; i < continentCount; i++) {
    const w = 2000 + rng() * 3000
    const h = 1500 + rng() * 2500
    const x = rng() * (MAP_WIDTH - w)
    const y = rng() * (MAP_HEIGHT - h)
    const name = theme.continentNames[i % theme.continentNames.length]
    const fill = theme.landFills[i % theme.landFills.length]

    continents.push({ x, y, w, h, name })

    // Continent shape (visible at ocean + voyage scale)
    objects.push({
      type: 'ellipse', left: x, top: y, width: w, height: h,
      fill, stroke: '#8b7355',
      minZoom: 0, maxZoom: 0.25,
    })

    // Continent label (ocean scale only)
    objects.push({
      type: 'text', left: x + w / 2 - 200, top: y + h / 2 - 50,
      width: 400, height: 60,
      text: name, fontSize: 80,
      minZoom: 0, maxZoom: 0.08,
    })
  }

  // --- Ocean labels ---
  for (let i = 0; i < 3; i++) {
    objects.push({
      type: 'text',
      left: rng() * MAP_WIDTH * 0.8, top: rng() * MAP_HEIGHT * 0.8,
      width: 500, height: 40,
      text: theme.oceanNames[i % theme.oceanNames.length],
      fontSize: 48, fill: '#4a86b8',
      minZoom: 0, maxZoom: 0.1,
    })
  }

  // --- Voyage scale: islands within/near continents ---
  for (const continent of continents) {
    const islandCount = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < islandCount; i++) {
      const iw = 300 + rng() * 600
      const ih = 200 + rng() * 400
      const ix = continent.x + rng() * continent.w
      const iy = continent.y + rng() * continent.h
      const name = theme.islandNames[Math.floor(rng() * theme.islandNames.length)]

      objects.push({
        type: 'ellipse', left: ix, top: iy, width: iw, height: ih,
        fill: theme.landFills[Math.floor(rng() * theme.landFills.length)],
        stroke: '#8b7355',
        minZoom: 0.03, maxZoom: 1.0,
      })

      objects.push({
        type: 'text', left: ix + iw / 2 - 100, top: iy - 30,
        width: 200, height: 24,
        text: name, fontSize: 20,
        minZoom: 0.05, maxZoom: 0.5,
      })
    }
  }

  // --- Harbor scale: towns ---
  for (const continent of continents) {
    const townCount = 1 + Math.floor(rng() * 2)
    for (let i = 0; i < townCount; i++) {
      const tx = continent.x + continent.w * 0.2 + rng() * continent.w * 0.6
      const ty = continent.y + continent.h * 0.2 + rng() * continent.h * 0.6
      const name = theme.townNames[Math.floor(rng() * theme.townNames.length)]

      // Town marker (visible at harbor scale)
      objects.push({
        type: 'rect', left: tx, top: ty, width: 200, height: 150,
        fill: '#f5f0e1', stroke: '#8b7355',
        minZoom: 0.15, maxZoom: 4.0,
      })

      objects.push({
        type: 'text', left: tx + 10, top: ty + 10,
        width: 180, height: 20,
        text: name, fontSize: 14,
        minZoom: 0.15, maxZoom: 4.0,
      })
    }
  }

  // --- Deck scale: landmarks + stickies with flavor text ---
  for (let i = 0; i < 4; i++) {
    const lx = rng() * MAP_WIDTH * 0.8 + MAP_WIDTH * 0.1
    const ly = rng() * MAP_HEIGHT * 0.8 + MAP_HEIGHT * 0.1
    const name = theme.landmarks[i % theme.landmarks.length]

    objects.push({
      type: 'sticky', left: lx, top: ly, width: 160, height: 100,
      fill: '#fef08a', text: `📍 ${name}`,
      minZoom: 0.5, maxZoom: Infinity,
    })
  }

  return {
    objects,
    viewportCenter: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    initialZoom: 0.03,
  }
}

// Simple seeded PRNG (mulberry32)
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

**Step 3: Add `'generateExpeditionMap'` command**

In `aiInterpretApi.ts`, add to `AiCommand` union:

```ts
| { action: 'generateExpeditionMap'; themeId?: string; seed?: number }
```

In `executeAiCommands.ts`, add handler:

```ts
} else if (cmd.action === 'generateExpeditionMap') {
  const theme = EXPEDITION_THEMES.find(t => t.id === (cmd.themeId ?? 'pirate-seas'))
    ?? EXPEDITION_THEMES[0]
  const map = generateExpeditionMap(theme, cmd.seed)

  for (const obj of map.objects) {
    const objectId = await createObject(boardId, obj.type as CreateObjectType, {
      left: obj.left,
      top: obj.top,
      width: obj.width,
      height: obj.height,
      fill: obj.fill,
      stroke: obj.stroke,
      text: obj.text,
      fontSize: obj.fontSize,
    }, { zIndex: baseZ + createIndex })

    // Set scale band visibility in object data via updateObject
    if (obj.minZoom != null || obj.maxZoom != null) {
      await updateObject(boardId, objectId, {
        // Data fields need to be set on the canvas object — handled by
        // a post-creation update or by extending createObject to accept data fields.
      })
    }

    createdIds.push(objectId)
    createIndex++
  }
}
```

Note: Setting `minZoom`/`maxZoom` requires either extending `createObject` to accept arbitrary `data` fields, or doing a follow-up `updateObject` call. Extending `createObject` is cleaner — add a `data?: Record<string, unknown>` param that gets merged into the object's data on creation.

**Step 4: Trigger on board creation**

In `WorkspacePage.tsx` (or `BoardPage.tsx`), when the board first loads and `board.boardMode === 'explorer'` and the board has 0 objects, auto-trigger map generation:

```ts
useEffect(() => {
  if (isExplorer && objectCount === 0 && !mapGeneratedRef.current) {
    mapGeneratedRef.current = true
    executeAiCommands(board.id, [{ action: 'generateExpeditionMap', themeId: 'pirate-seas' }], {
      createFrame: ...,
      getViewportCenter: ...,
    })
  }
}, [isExplorer, objectCount])
```

After generation, set initial viewport to the map center at ~3% zoom so user sees the full map.

**Step 5: (Optional) AI enrichment**

After the procedural map is created, fire a background AI call to the `ai-interpret` Edge Function:

```
Generate pirate-themed names for an expedition map:
- 4 continent names with 1-sentence descriptions
- 8 island names
- 5 ocean region names
- 4 town names with types (port/fort/village)
- 3 landmark names with legends (1 sentence each)
Theme: Pirate Seas
Return JSON: { continents: [{name, desc}], islands: [name], oceans: [name], towns: [{name, type}], landmarks: [{name, legend}] }
```

When the response arrives, `updateObject` the text labels with the AI-generated names. This replaces the procedural name bank values with unique creative content.

This step is fire-and-forget — the map is already usable from Step 4. The AI call just enriches it.

**Acceptance criteria:**
- [ ] New expedition board with 0 objects auto-generates a map
- [ ] Map has ~40–80 objects across multiple scale bands
- [ ] Objects are visible/hidden at appropriate zoom levels
- [ ] Procedural generation is instant (<200ms)
- [ ] Map has continents, islands, ocean labels, towns, landmarks
- [ ] Initial viewport set to ~3% zoom showing the full map
- [ ] (Optional) AI enrichment updates names in background within ~2s

---

## Task 11: Fog of War (Optional Toggle)

**Files:**
- New: `src/features/workspace/components/FogOfWarOverlay.tsx`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`

**Goal:** A dark overlay that the board owner can "reveal" by painting areas. Toggleable. Explorer mode only.

**Implementation:**

Fog of War is rendered as an SVG overlay with a rect fill and `clipPath` cutouts for revealed areas.

State in `WorkspacePage`:
- `fogEnabled: boolean` (default `false`)
- `fogReveals: Array<{cx: number, cy: number, radius: number}>` — revealed circle regions

Storage: `localStorage` keyed by `meboard:fog:${boardId}` (MVP). Later: Supabase table for multi-user sync.

A "Reveal" tool (🔦 icon) in the toolbar when fog is enabled:
- Click on the canvas to reveal a circular area (radius = brushWidth, reusing the brush slider)
- Reveal points are added to `fogReveals`, fog overlay re-renders

The overlay:

```tsx
<svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}>
  <defs>
    <mask id="fog-mask">
      <rect width="100%" height="100%" fill="white" />
      {fogReveals.map((r, i) => {
        const sx = r.cx * zoom + panX
        const sy = r.cy * zoom + panY
        const sr = r.radius * zoom
        return <circle key={i} cx={sx} cy={sy} r={sr} fill="black" />
      })}
    </mask>
  </defs>
  <rect width="100%" height="100%" fill="rgba(15,10,25,0.82)" mask="url(#fog-mask)" />
</svg>
```

Toolbar: `⛅` toggle button for fog on/off. Only visible when `boardMode === 'explorer'`.

**Acceptance criteria:**
- [ ] Fog overlay covers entire canvas when enabled
- [ ] Clicking with reveal tool clears circular areas
- [ ] Revealed areas persist to localStorage
- [ ] Fog toggleable on/off
- [ ] Explorer mode only
- [ ] Revealed areas transform correctly with pan/zoom

---

## Task 12: Laser Pointer

**Files:**
- Modify: `src/features/workspace/types/tools.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`
- Modify: `src/features/workspace/components/CursorOverlay.tsx`
- Modify: `src/features/workspace/api/presenceApi.ts` (or use existing broadcast channel)

**Goal:** A temporary freehand trail that fades after 1.5 seconds. Broadcast to other users. Never persisted. All modes.

**Implementation:**

Add `'laser'` to `ToolType`.

When laser tool is active:
- On `pointermove`, collect points into a trail buffer (max ~100 points)
- Broadcast trail points via the existing cursor Broadcast channel (add `laserTrail: Array<{x,y,t}>` to the broadcast payload)
- Render trail in `CursorOverlay.tsx` for remote users:

```tsx
{laserPoints.map((p, i) => {
  const age = now - p.t
  const opacity = Math.max(0, 1 - age / 1500)
  return (
    <div key={i} style={{
      position: 'absolute',
      left: p.x * zoom + panX,
      top: p.y * zoom + panY,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: `rgba(255, 50, 50, ${opacity})`,
      pointerEvents: 'none',
    }} />
  )
})}
```

A `requestAnimationFrame` loop culls points older than 1.5s.

Local user's own trail rendered the same way (no network round-trip — immediate).

**Acceptance criteria:**
- [ ] Laser tool creates a glowing trail that fades in 1.5s
- [ ] Trail visible to all users in the board
- [ ] No objects created, no DB writes
- [ ] Trail broadcast via existing Realtime channel
- [ ] Available in all board modes

---

## Task 13: Follow Mode

**Files:**
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/hooks/usePresence.ts`
- Modify: `src/features/workspace/api/presenceApi.ts`

**Goal:** Click a presence icon to follow that user's viewport in real-time. All modes.

**Implementation:**

Broadcast viewport transforms: In `handleViewportChange`, include `viewportTransform` in the cursor broadcast payload (alongside position):

```ts
channel.send({
  type: 'broadcast',
  event: 'cursor',
  payload: { userId, x, y, viewportTransform: vpt },
})
```

In `usePresence`, store other users' `viewportTransform` in the `others` state.

In `WorkspacePage`:
- State: `followingUserId: string | null`
- When clicking a presence icon, if not already following: set `followingUserId`
- When following is active, on each incoming cursor broadcast from that user, set our viewport to match theirs:

```ts
useEffect(() => {
  if (!followingUserId) return
  const other = others.find(o => o.userId === followingUserId)
  if (other?.viewportTransform) {
    canvasZoomRef.current?.setViewportTransform(other.viewportTransform)
  }
}, [followingUserId, others])
```

Show a banner: "Following [name] — click anywhere to stop"

Click anywhere / press Escape / click the presence icon again → set `followingUserId = null`.

Add `setViewportTransform` to `FabricCanvasZoomHandle`:

```ts
setViewportTransform: (vpt: number[]) => {
  const canvas = canvasRef.current
  if (!canvas || !canvas.viewportTransform) return
  for (let i = 0; i < 6; i++) canvas.viewportTransform[i] = vpt[i]
  canvas.requestRenderAll()
  onViewportChangeRef.current?.(vpt)
}
```

**Acceptance criteria:**
- [ ] Clicking presence icon starts following that user
- [ ] Viewport mirrors followed user's pan/zoom in real-time
- [ ] "Following [name]" banner visible
- [ ] Click anywhere or Escape stops following
- [ ] Available in all board modes

---

## Task 14: Animated Zoom Transitions + Advanced Shapes

**Files:**
- Modify: `src/features/workspace/lib/fabricCanvasZoom.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`
- Modify: `src/features/workspace/lib/shapeFactory.ts`
- Modify: `src/features/workspace/types/tools.ts`
- Modify: `src/features/workspace/components/WorkspaceToolbar.tsx`

**Goal:** Smooth animated zoom/pan transitions; arrow and bezier curve shapes.

**Step 1: Animated transitions in `fabricCanvasZoom.ts`**

Add `animateToViewport` to `ZoomHandlers`:

```ts
animateToViewport: (targetVpt: number[], duration?: number) => void
```

Implementation:

```ts
const animateToViewport = (targetVpt: number[], duration = 400) => {
  const startVpt = [...(canvas.viewportTransform ?? [1,0,0,1,0,0])]
  const startTime = performance.now()
  const frame = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const ease = t * (2 - t) // ease-out quadratic
    const vpt = canvas.viewportTransform!
    for (let i = 0; i < 6; i++) {
      vpt[i] = startVpt[i] + (targetVpt[i] - startVpt[i]) * ease
    }
    canvas.requestRenderAll()
    notifyViewport()
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
```

Use this in `panToScene`, zoom preset clicks, and Ports of Call navigation instead of instant viewport set.

**Step 2: Arrow shape**

Add `'arrow'` to `ToolType`. Add to `shapeFactory.ts`:

```ts
case 'arrow': {
  const points = [
    { x: left, y: top + height * 0.4 },
    { x: left + width * 0.65, y: top + height * 0.4 },
    { x: left + width * 0.65, y: top },
    { x: left + width, y: top + height / 2 },
    { x: left + width * 0.65, y: top + height },
    { x: left + width * 0.65, y: top + height * 0.6 },
    { x: left, y: top + height * 0.6 },
  ]
  return withId(new Polygon(points, { ...baseOpts, fill: FILL }))
}
```

**Step 3: Bezier curve tool (stretch goal)**

Add `'curve'` to `ToolType`. This is the most complex shape tool:
- Click to place anchor points
- Drag from an anchor to set control handles
- Creates a Fabric `Path` with cubic bezier segments (`M`, `C` commands)
- Preview as you build
- Double-click to finish the curve

This is a stretch goal — implement if time allows. Estimated ~4–6 hours standalone.

**Acceptance criteria:**
- [ ] Zoom/pan transitions are smooth (ease-out, ~400ms)
- [ ] Ports of Call navigation uses animated transitions
- [ ] Arrow shape tool available in all modes
- [ ] (Stretch) Bezier curve tool with anchor points and control handles

---

## Memory Bank Updates

After completing all tasks, update:

1. **`memory-bank/activeContext.md`** — Add Explorer Canvas section with board modes, new tools, LOD, map generation
2. **`memory-bank/progress.md`** — Mark Explorer Canvas tasks complete, add to "What Works" section
3. **`memory-bank/NEXT_AGENT_START_HERE.md`** — Update quick reference with new tool types, board mode, scale bands, map generator
4. **`memory-bank/systemPatterns.md`** — Document board mode architecture, LOD pattern, procedural generation pattern
5. **`docs/PLANNED_CANVAS_FEATURES.md`** — Update §4 Multi-Scale Map Vision as IMPLEMENTED

---

## Summary

| Task | What | Effort | Group | Mode |
|------|------|--------|-------|------|
| 1 | Board mode infrastructure | ~3 hrs | A | All |
| 2 | Brush slider + types + opacity + eraser | ~4 hrs | B | All |
| 3 | Ellipse + Polygon + Star shapes | ~3 hrs | B | All |
| 4 | Freeform polygon tool | ~3 hrs | B | All |
| 5 | Zoom-dependent visibility (LOD) | ~4 hrs | C | Explorer |
| 6 | Scale band indicator HUD | ~1 hr | C | Explorer |
| 7 | Ports of Call bookmarks | ~3 hrs | C | Explorer |
| 8 | Mini-map navigator | ~4 hrs | D | Explorer |
| 9 | Hex grid + snap-to-grid | ~3 hrs | D | All/Explorer |
| 10 | Procedural + AI map generator | ~6 hrs | E | Explorer |
| 11 | Fog of War (optional) | ~5 hrs | F | Explorer |
| 12 | Laser pointer | ~2 hrs | F | All |
| 13 | Follow mode | ~3 hrs | F | All |
| 14 | Animated transitions + arrow + bezier | ~4 hrs | G | All |
| **Total** | | **~48 hrs** | | |
