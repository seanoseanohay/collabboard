# Table Polish + Template Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish DataTable into a clean Figma-like artifact (optional title, view/edit mode, accent colors) and redesign SWOT/Retrospective/UserJourney templates to use DataTable objects, while ensuring all six required AI layout/template commands work.

**Architecture:** DataTable gets `showTitle` + `accentColor` data fields and a double-click-triggered edit mode managed by `WorkspacePage`. Templates are extended with a `'table'` type in `TemplateObjectSpec`; `executeAiCommands` handles table creation via a new `createTable` callback wired through `FabricCanvas`. Layout commands (`arrangeInGrid`, `spaceEvenly`) are already implemented; a new `createGrid` command is added for grid creation.

**Tech Stack:** React, TypeScript, Fabric.js, Supabase Realtime, inline CSS styles (no CSS modules/Tailwind in overlay components).

---

## Reference Files

Read these before starting each task — they contain the patterns everything else follows:

- `src/features/workspace/lib/frameFormTypes.ts` — FormSchema, FormColumn types
- `src/features/workspace/lib/dataTableFactory.ts` — createDataTableShape
- `src/features/workspace/lib/dataTableUtils.ts` — DataTableData, getTableData, setTableFormSchema
- `src/features/workspace/components/FrameFormOverlay.tsx` — full overlay + FrameFormPanel
- `src/features/workspace/lib/templateRegistry.ts` — TemplateSpec, TemplateObjectSpec, all templates
- `src/features/workspace/lib/executeAiCommands.ts` — executeAiCommands, ExecuteAiOptions
- `src/features/workspace/api/aiInterpretApi.ts` — AiCommand union type
- `src/features/workspace/WorkspacePage.tsx` — holds editingTableId state (after Task 3)
- `src/features/workspace/components/FabricCanvas.tsx` — imperative handles, event listeners

---

## Task 1: Extend DataTable data schema

**Files:**
- Modify: `src/features/workspace/lib/frameFormTypes.ts`
- Modify: `src/features/workspace/lib/dataTableUtils.ts`
- Modify: `src/features/workspace/lib/dataTableFactory.ts`

**Goal:** Add `showTitle: boolean`, `accentColor?: string` to `DataTableData`; add `headerColor?: string` to `FormColumn`; update factory defaults.

**Step 1: Update `frameFormTypes.ts`**

Add `headerColor` to `FormColumn`:

```ts
export interface FormColumn {
  id: string
  name: string
  type: FormFieldType
  options?: string[]
  headerColor?: string   // optional per-column <th> background tint
}
```

**Step 2: Update `dataTableUtils.ts`**

Replace `DataTableData` interface:

```ts
export interface DataTableData {
  id: string
  subtype: 'table'
  title: string
  showTitle: boolean        // false = no title bar rendered
  accentColor?: string      // drives border + column header tint
  formSchema: FormSchema | null
}
```

Update `getTableData` to include new fields with safe defaults:

```ts
export function getTableData(obj: FabricObject): DataTableData | null {
  const data = obj.get('data') as Partial<DataTableData> | undefined
  if (data?.subtype !== 'table') return null
  return {
    id: data.id ?? '',
    subtype: 'table',
    title: data.title ?? 'Untitled Table',
    showTitle: data.showTitle ?? false,
    accentColor: data.accentColor,
    formSchema: data.formSchema ?? null,
  }
}
```

**Step 3: Update `dataTableFactory.ts`**

Add `showTitle` and `accentColor` params:

```ts
export function createDataTableShape(
  left: number,
  top: number,
  width: number,
  height: number,
  title = 'Untitled Table',
  assignId = true,
  showTitle = false,
  accentColor?: string,
): FabricObject {
```

Update the `group.set('data', ...)` call to include new fields:

```ts
group.set('data', {
  id,
  subtype: 'table',
  title,
  showTitle,
  accentColor,
  formSchema: null,
})
```

And for `assignId = false` path:

```ts
group.set('data', { subtype: 'table', showTitle, accentColor, formSchema: null })
```

**Step 4: Verify TypeScript compiles clean**

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/features/workspace/lib/frameFormTypes.ts \
        src/features/workspace/lib/dataTableUtils.ts \
        src/features/workspace/lib/dataTableFactory.ts
git commit -m "feat: add showTitle, accentColor, headerColor to DataTable schema"
```

---

## Task 2: FrameFormOverlay — accent colors + optional title bar

**Files:**
- Modify: `src/features/workspace/components/FrameFormOverlay.tsx`

**Goal:** Use `accentColor` for border and column header tints; hide title bar when `showTitle === false`; support per-column `headerColor`.

**Step 1: Thread `accentColor` and `showTitle` into `FrameFormPanel`**

`FrameFormOverlay` already receives `frames: FormFrameSceneInfo[]`. Extend `FormFrameSceneInfo` in `frameFormTypes.ts` to include:

```ts
export interface FormFrameSceneInfo {
  objectId: string
  title: string
  showTitle: boolean       // NEW
  accentColor?: string     // NEW
  sceneLeft: number
  sceneTop: number
  sceneWidth: number
  sceneHeight: number
  scaleX: number
  scaleY: number
  formSchema: FormSchema | null
}
```

In `FrameFormOverlay`, pass `showTitle` and `accentColor` to `FrameFormPanel`:

```tsx
<FrameFormPanel
  ...
  showTitle={frame.showTitle}
  accentColor={frame.accentColor}
/>
```

Add to `PanelProps`:
```ts
showTitle: boolean
accentColor?: string
```

**Step 2: Compute accent-derived colors in `FrameFormPanel`**

At top of `FrameFormPanel`, after destructuring props:

```ts
const DEFAULT_ACCENT = '#93c5fd'
const accent = accentColor ?? DEFAULT_ACCENT

// Produce a light 15% tint for backgrounds: mix accent with white
// Simple approach: use the accent at low opacity via a helper
function accentTint(hex: string): string {
  // Map known accent colors to their established tints used elsewhere in the codebase
  const tints: Record<string, string> = {
    '#16a34a': '#dcfce7',
    '#dc2626': '#fee2e2',
    '#2563eb': '#dbeafe',
    '#ca8a04': '#fef9c3',
    '#93c5fd': '#eff6ff',
  }
  return tints[hex] ?? '#f8fafc'
}
const accentBg = accentTint(accent)
```

**Step 3: Apply accent to outer border**

In `overlayStyle`:
```ts
border: `2px solid ${accent}`,
```

**Step 4: Conditionally render title bar**

Wrap the title bar render:
```tsx
{showTitle && titleBar}
```

Update `titleBar` styles to use accent colors:
```ts
// title bar background:
background: accentBg,
// title span color:
color: accent,
// border bottom:
borderBottom: `1px solid ${accent}`,
```

**Step 5: Apply accent to column header `<th>` background**

In the `<th>` render, apply per-column `headerColor` if set, otherwise `accentBg`:

```tsx
<th
  key={col.id}
  style={{
    ...thStyle,
    background: col.headerColor ?? accentBg,
    pointerEvents: 'auto',
  }}
```

**Step 6: Update FabricCanvas to populate `showTitle` and `accentColor` in scene info**

Find where `FormFrameSceneInfo` is constructed (in `FabricCanvas.tsx`, look for `formFrames` or where `FrameFormOverlay` is fed data). Add `showTitle` and `accentColor` from `getTableData(obj)`:

```ts
const tableData = getTableData(obj)
// in the sceneInfo object:
showTitle: tableData?.showTitle ?? false,
accentColor: tableData?.accentColor,
```

**Step 7: TypeScript check + run app manually**

```bash
npx tsc --noEmit
npm run dev
```

Create a DataTable on canvas. Verify: default table has no title bar, blue border. A table created with `accentColor: '#16a34a'` shows green border + green column header tint.

**Step 8: Commit**

```bash
git add src/features/workspace/components/FrameFormOverlay.tsx \
        src/features/workspace/lib/frameFormTypes.ts \
        src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat: DataTable accent color, optional title bar"
```

---

## Task 3: View / Edit mode for DataTable

**Files:**
- Modify: `src/features/workspace/components/FrameFormOverlay.tsx`
- Modify: `src/features/workspace/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Goal:** Double-click enters edit mode (all controls visible). Default = view mode (clean read-only display).

### Sub-task 3a: Add `isEditing` to `FrameFormPanel`

Add `isEditing: boolean` to `PanelProps` and `FrameFormPanel` signature.

**View mode changes (when `!isEditing`):**

1. Hide footer entirely:
```tsx
{isEditing && (
  <div style={footerStyle}>
    <button style={btnStyle} onClick={addRow}>+ Row</button>
    <button style={btnStyle} onClick={addColumn}>+ Column</button>
    ...
  </div>
)}
```

2. Hide row delete `✕` column:
```tsx
// Last <th> (delete column header) — hide when not editing
<th style={{ ...thStyle, width: DEL_COL_W, minWidth: DEL_COL_W, display: isEditing ? undefined : 'none' }} />

// In each row, hide the delete <td>:
<td style={{ ...tdStyle, width: DEL_COL_W, minWidth: DEL_COL_W, display: isEditing ? undefined : 'none', ... }}>
```

3. Suppress column header hover controls (type dropdown + ✕) when not editing:
```tsx
{isEditing && isHovered && (
  <div style={{ position: 'absolute', top: 2, right: 2, ... }}>
    ...type select + delete button...
  </div>
)}
```

4. Suppress type label in column header when not editing:
```tsx
{isEditing && !isHovered && (
  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4, fontSize: '0.85em' }}>
    {FIELD_TYPE_LABELS[col.type]}
  </span>
)}
```

5. Replace cell inputs with read-only spans in view mode:

In `CellInput`, add `isEditing` prop:
```tsx
function CellInput({ col, value, onChange, fontSize, isEditing }: CellInputProps & { isEditing: boolean }) {
  if (!isEditing) {
    if (col.type === 'checkbox') {
      return <input type="checkbox" checked={!!value} disabled style={{ cursor: 'default', margin: '0 auto', display: 'block' }} />
    }
    const display = value === '' || value === undefined || value === null ? '' : String(value)
    return (
      <span style={{ fontSize, color: display ? '#1e293b' : '#94a3b8', padding: '1px 2px', display: 'block', minHeight: '1.2em' }}>
        {display}
      </span>
    )
  }
  // ... existing input rendering unchanged
}
```

6. Change border to indigo when editing:
```ts
border: `2px solid ${isEditing ? '#6366f1' : accent}`,
```

7. In edit mode, make all cells have `pointerEvents: 'auto'`; in view mode, cells are `'none'` (table is draggable from any surface):
```ts
// td style:
pointerEvents: isEditing ? 'auto' : 'none',
```

8. Pass `isEditing` down from `FrameFormOverlay`:
```tsx
<FrameFormPanel
  ...
  isEditing={editingTableId === frame.objectId}
/>
```

Add `editingTableId: string | null` to `FrameFormOverlayProps`.

### Sub-task 3b: Wire `editingTableId` in `WorkspacePage`

Add state:
```ts
const [editingTableId, setEditingTableId] = useState<string | null>(null)
```

Pass to `FrameFormOverlay`:
```tsx
<FrameFormOverlay
  ...
  editingTableId={editingTableId}
/>
```

Pass callback to `FabricCanvas`:
```tsx
<FabricCanvas
  ...
  onTableEditStart={(id) => setEditingTableId(id)}
  onTableEditEnd={() => setEditingTableId(null)}
/>
```

### Sub-task 3c: Wire double-click in `FabricCanvas`

Add props to `FabricCanvasProps`:
```ts
onTableEditStart?: (objectId: string) => void
onTableEditEnd?: () => void
```

In the effect where canvas events are set up, add:
```ts
fabricCanvas.on('mouse:dblclick', (e) => {
  const target = e.target
  if (target && isDataTable(target)) {
    const data = getTableData(target)
    if (data?.id) {
      onTableEditStartRef.current?.(data.id)
      return
    }
  }
})

fabricCanvas.on('mouse:down', (e) => {
  const target = e.target
  if (!target || !isDataTable(target)) {
    onTableEditEndRef.current?.()
  }
  // ... rest of existing mouse:down handler
})
```

Use refs for the callbacks (same pattern as other callback refs in FabricCanvas):
```ts
const onTableEditStartRef = useRef(onTableEditStart)
const onTableEditEndRef = useRef(onTableEditEnd)
useEffect(() => { onTableEditStartRef.current = onTableEditStart }, [onTableEditStart])
useEffect(() => { onTableEditEndRef.current = onTableEditEnd }, [onTableEditEnd])
```

**Step: TypeScript check**

```bash
npx tsc --noEmit
```

**Step: Manual test**

- `npm run dev`
- Create DataTable on canvas
- Default: no controls visible, clean grid
- Double-click: controls appear, border turns indigo
- Click canvas outside: controls disappear, border returns to accent color

**Step: Commit**

```bash
git add src/features/workspace/components/FrameFormOverlay.tsx \
        src/features/workspace/WorkspacePage.tsx \
        src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat: DataTable view/edit mode — double-click to edit, clean view by default"
```

---

## Task 4: Extend TemplateObjectSpec + executeAiCommands for table type

**Files:**
- Modify: `src/features/workspace/lib/templateRegistry.ts`
- Modify: `src/features/workspace/lib/executeAiCommands.ts`
- Modify: `src/features/workspace/api/aiInterpretApi.ts`
- Modify: `src/features/workspace/WorkspacePage.tsx`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Goal:** Templates can include `type: 'table'` objects with pre-set `formSchema`, `showTitle`, `accentColor`. `executeAiCommands` creates them via `createTable` callback. Add `createGrid` command.

### Sub-task 4a: Extend `TemplateObjectSpec`

In `templateRegistry.ts`, update the interface:

```ts
export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky' | 'input-field' | 'button' | 'table'
  relLeft: number
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string
  fontSize?: number
  // Table-only fields:
  showTitle?: boolean
  accentColor?: string
  formSchema?: {
    columns: Array<{ id: string; name: string; type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'date'; headerColor?: string }>
    rows: Array<{ id: string; values: Record<string, string | number | boolean> }>
  }
}
```

### Sub-task 4b: Add `createTable` to `ExecuteAiOptions`

In `executeAiCommands.ts`:

```ts
export interface ExecuteAiOptions {
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => void
  createTable?: (params: {
    left: number
    top: number
    width: number
    height: number
    title: string
    showTitle: boolean
    accentColor?: string
    formSchema: import('../lib/frameFormTypes').FormSchema | null
  }) => string   // returns the new object's id
  getViewportCenter?: () => { x: number; y: number }
}
```

### Sub-task 4c: Handle `type: 'table'` in `applyTemplate`

Inside the `applyTemplate` branch, inside the `for (const obj of spec.objects)` loop, add a branch before the `createObject` call:

```ts
if (obj.type === 'table') {
  if (!options?.createTable) continue
  const objectId = options.createTable({
    left: frameLeft + obj.relLeft,
    top: frameTop + obj.relTop,
    width: obj.width,
    height: obj.height,
    title: obj.text ?? 'Table',
    showTitle: obj.showTitle ?? false,
    accentColor: obj.accentColor,
    formSchema: obj.formSchema
      ? {
          columns: obj.formSchema.columns,
          rows: obj.formSchema.rows,
        }
      : null,
  })
  createdIds.push(objectId)
  trackedBounds.push({
    objectId,
    left: frameLeft + obj.relLeft,
    top: frameTop + obj.relTop,
    width: obj.width,
    height: obj.height,
  })
  createIndex++
  continue
}
// ... existing createObject call for other types
```

### Sub-task 4d: Add `createGrid` to `AiCommand` union

In `aiInterpretApi.ts`, add to the `AiCommand` union:

```ts
| {
    action: 'createGrid'
    rows: number
    cols: number
    fill?: string
    width?: number
    height?: number
  }
```

### Sub-task 4e: Handle `createGrid` in `executeAiCommands`

Add handler in the command loop:

```ts
} else if (cmd.action === 'createGrid') {
  const rows = typeof cmd.rows === 'number' ? Math.max(1, cmd.rows) : 2
  const cols = typeof cmd.cols === 'number' ? Math.max(1, cmd.cols) : 3
  const w = typeof cmd.width === 'number' ? cmd.width : 200
  const h = typeof cmd.height === 'number' ? cmd.height : 120
  const GAP = 16
  const center = options?.getViewportCenter?.() ?? { x: 400, y: 300 }
  const totalW = cols * w + (cols - 1) * GAP
  const totalH = rows * h + (rows - 1) * GAP
  const originLeft = Math.round(center.x - totalW / 2)
  const originTop = Math.round(center.y - totalH / 2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const objectId = await createObject(
        boardId,
        'sticky',
        {
          left: originLeft + c * (w + GAP),
          top: originTop + r * (h + GAP),
          width: w,
          height: h,
          fill: typeof cmd.fill === 'string' ? cmd.fill : '#fff9c4',
          text: '',
        },
        { zIndex: baseZ + createIndex }
      )
      createdIds.push(objectId)
      createIndex++
    }
  }
}
```

### Sub-task 4f: Wire `createTable` in `FabricCanvas` imperative handle

In `FabricCanvas.tsx`, find the `useImperativeHandle` block. Add:

```ts
createTable: (params: {
  left: number; top: number; width: number; height: number
  title: string; showTitle: boolean; accentColor?: string
  formSchema: FormSchema | null
}): string => {
  const obj = createDataTableShape(
    params.left, params.top, params.width, params.height,
    params.title, true, params.showTitle, params.accentColor
  )
  if (params.formSchema) {
    setTableFormSchema(obj, params.formSchema)
    // Also update the data object so accentColor + showTitle persist
    const existing = obj.get('data') as Record<string, unknown>
    obj.set('data', { ...existing, formSchema: params.formSchema })
  }
  fabricCanvas.add(obj)
  sortCanvasByZIndex(fabricCanvas)
  fabricCanvas.renderAll()
  emitAdd(boardId, obj)
  historyManagerRef.current?.pushAdd(getObjectId(obj)!)
  return getObjectId(obj)!
},
```

Add `createTable` to `FabricCanvasZoomHandle` interface.

### Sub-task 4g: Wire `createTable` in `WorkspacePage`

Pass `createTable` to `AiPromptBar` (same pattern as `createFrame`):

```tsx
createTable={(params) => {
  const id = canvasZoomRef.current?.createTable(params)
  return id ?? ''
}}
```

Update `AiPromptBar` props to accept `createTable` and pass it into `executeAiCommands` options.

**Step: TypeScript check**

```bash
npx tsc --noEmit
```

**Step: Commit**

```bash
git add src/features/workspace/lib/templateRegistry.ts \
        src/features/workspace/lib/executeAiCommands.ts \
        src/features/workspace/api/aiInterpretApi.ts \
        src/features/workspace/WorkspacePage.tsx \
        src/features/workspace/components/FabricCanvas.tsx \
        src/features/workspace/components/AiPromptBar.tsx
git commit -m "feat: table type in template registry, createTable callback, createGrid command"
```

---

## Task 5: Redesign SWOT, Retrospective, and User Journey templates

**Files:**
- Modify: `src/features/workspace/lib/templateRegistry.ts`

**Goal:** Replace the existing sticky-based SWOT, Retrospective, and User Journey specs with DataTable-based layouts.

### SWOT Analysis

Replace the existing `SWOT` constant:

```ts
function makeId() { return crypto.randomUUID() }

const SWOT: TemplateSpec = {
  id: 'swot',
  frameTitle: 'SWOT Analysis',
  frameWidth: 560,
  frameHeight: 500,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 240, height: 210,
      text: 'Strengths', showTitle: true, accentColor: '#16a34a',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 300, relTop: 52, width: 240, height: 210,
      text: 'Weaknesses', showTitle: true, accentColor: '#dc2626',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 20, relTop: 278, width: 240, height: 210,
      text: 'Opportunities', showTitle: true, accentColor: '#2563eb',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 300, relTop: 278, width: 240, height: 210,
      text: 'Threats', showTitle: true, accentColor: '#ca8a04',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
  ],
}
```

> **Note:** `makeId()` is called at module load time — each spec load gets fresh UUIDs. This is fine because templates are applied at runtime, not cached between uses.

### Retrospective

Replace existing `RETROSPECTIVE` constant:

```ts
const RETROSPECTIVE: TemplateSpec = {
  id: 'retrospective',
  frameTitle: 'Retrospective',
  frameWidth: 740,
  frameHeight: 420,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 700, height: 360,
      text: 'Retrospective', showTitle: false,
      formSchema: {
        columns: [
          { id: 'col1', name: '✓ What Went Well', type: 'text', headerColor: '#dcfce7' },
          { id: 'col2', name: "✗ What Didn't", type: 'text', headerColor: '#fee2e2' },
          { id: 'col3', name: '→ Action Items', type: 'text', headerColor: '#dbeafe' },
        ],
        rows: [
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
        ],
      },
    },
  ],
}
```

### User Journey Map

Replace existing `USER_JOURNEY` constant:

```ts
const USER_JOURNEY: TemplateSpec = {
  id: 'user-journey',
  frameTitle: 'User Journey Map',
  frameWidth: 980,
  frameHeight: 420,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 940, height: 360,
      text: 'User Journey', showTitle: false,
      formSchema: {
        columns: [
          { id: 'phase', name: 'Phase', type: 'text' },
          { id: 'awareness', name: 'Awareness', type: 'text', headerColor: '#dbeafe' },
          { id: 'consideration', name: 'Consideration', type: 'text', headerColor: '#dbeafe' },
          { id: 'decision', name: 'Decision', type: 'text', headerColor: '#dbeafe' },
          { id: 'retention', name: 'Retention', type: 'text', headerColor: '#dbeafe' },
          { id: 'advocacy', name: 'Advocacy', type: 'text', headerColor: '#dbeafe' },
        ],
        rows: [
          { id: makeId(), values: { phase: 'Actions', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Tasks', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Feelings', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Pain Points', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Opportunities', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
        ],
      },
    },
  ],
}
```

**Step: TypeScript check**

```bash
npx tsc --noEmit
```

**Step: Manual end-to-end test**

1. `npm run dev`
2. Open a board, open the AI prompt bar
3. Type "Create a SWOT analysis" → verify: frame appears with 4 colored tables, each showing title bar in its accent color, view mode (no controls)
4. Double-click one table → edit mode (controls appear, indigo border)
5. Click outside → returns to view mode
6. Type "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" → verify: frame with 1 table, 3 colored column headers, view mode
7. Type "Build a user journey map with 5 stages" → verify: frame with 1 table, Phase column + 5 stage columns, 5 pre-populated rows
8. Type "Create a 2×3 grid of sticky notes" → verify: 6 stickies in 2 rows × 3 cols

**Step: Commit**

```bash
git add src/features/workspace/lib/templateRegistry.ts
git commit -m "feat: redesign SWOT, Retrospective, UserJourney templates with DataTable objects"
```

---

## Task 6: Update memory bank documentation

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/NEXT_AGENT_START_HERE.md`

Update to reflect:
- DataTable: `showTitle`, `accentColor`, `headerColor` on `FormColumn`
- View/Edit mode: double-click enters edit, border turns indigo, controls appear
- Templates: SWOT/Retro/UserJourney now use DataTable objects
- `createGrid` AI command added
- 6 required layout/template commands all satisfied

```bash
git add memory-bank/
git commit -m "docs: update memory bank for table polish + template redesign"
```

---

## Verification Checklist

Before declaring done, verify all six required commands work via the AI prompt bar:

- [ ] "Arrange these sticky notes in a grid" — selects stickies, types command, they snap to grid
- [ ] "Create a 2×3 grid of sticky notes for pros and cons" — 6 stickies appear in 2×3 grid
- [ ] "Space these elements evenly" — selected objects distribute evenly
- [ ] "Create a SWOT analysis template with four quadrants" — frame + 4 colored tables
- [ ] "Build a user journey map with 5 stages" — frame + 1 table with 6 cols, 5 pre-populated rows
- [ ] "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" — frame + 1 table with 3 colored column headers

Also verify:
- [ ] Default DataTable created from toolbar has no title bar
- [ ] Double-click enters edit mode (indigo border, controls appear)
- [ ] Click outside returns to view mode (accent color border, no controls)
- [ ] Existing tables (created before this change) render correctly (backward compat via `showTitle ?? false`)
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
