# Design: Table Polish + Template Redesign

**Date:** 2026-02-20
**Status:** Approved

---

## Goal

1. Make DataTable a clean, Figma-like artifact (optional title, view/edit mode).
2. Redesign SWOT, Retrospective, and User Journey templates to use DataTable objects.
3. Keep Pros & Cons as sticky notes (already clean).
4. Ensure all six required AI commands work end-to-end.

---

## Success Criteria (Required Commands)

| Command | Category | Status |
|---|---|---|
| "Arrange these sticky notes in a grid" | Layout | `arrangeInGrid` already in executeAiCommands ✅ |
| "Create a 2×3 grid of sticky notes for pros and cons" | Layout | `createGrid` command — NEW |
| "Space these elements evenly" | Layout | `spaceEvenly` already in executeAiCommands ✅ |
| "Create a SWOT analysis template with four quadrants" | Template | `applyTemplate` → `swot` spec redesigned |
| "Build a user journey map with 5 stages" | Template | `applyTemplate` → `user-journey` spec redesigned |
| "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" | Template | `applyTemplate` → `retrospective` spec redesigned |

---

## Part 1 — DataTable Polish

### 1a. Remove the title bar (optional title)

Add `showTitle: boolean` to `DataTableData` (default `false`).

- When `false`: no title bar rendered. The overlay starts at the top with column headers.
- When `true`: title bar renders as today (editable IText label).
- Templates that need a label (SWOT quadrants) set `showTitle: true` + `accentColor`.
- `dataTableFactory.ts` default: `showTitle: false`.

**Data schema change:**
```ts
export interface DataTableData {
  id: string
  subtype: 'table'
  title: string
  showTitle: boolean        // NEW — default false
  accentColor?: string      // NEW — drives border + header tint
  formSchema: FormSchema | null
}
```

### 1b. Accent color

Add `accentColor?: string` to `DataTableData`.

Used in the overlay for:
- Outer border color (replaces hardcoded `#93c5fd`)
- Column header `<th>` background: 15% tint of accent (e.g. `#dcfce7` for green `#16a34a`)
- Title bar background: same tint; title text: accent color

Default (no `accentColor`): existing blue `#93c5fd` / `#eff6ff`.

Accent color is set per-object at creation time (templates) or via future toolbar color picker.

### 1c. View / Edit mode

**Two states per table:**

| State | Trigger | Behavior |
|---|---|---|
| View mode | Default (not double-clicked) | Clean read-only display. No `+ Row`, no `+ Column`, no `✕` buttons, no type labels. Cells show plain `<span>` text. Border color = `accentColor`. |
| Edit mode | Double-click on the Fabric object | All controls visible. Border changes to `#6366f1` (indigo) as edit indicator. Clicking outside overlay exits edit mode. |

**State flow:**
- `WorkspacePage` holds `editingTableId: string | null`
- `FabricCanvas` fires new callback `onTableDoubleClick(objectId: string)` on `mouse:dblclick` for DataTable objects
- `WorkspacePage` sets `editingTableId` on that callback
- `FrameFormOverlay` receives `editingTableId` prop; each `FrameFormPanel` receives `isEditing = editingTableId === frameId`
- Clicking the canvas outside the overlay calls `onTableDoubleClick(null)` (clears edit mode) — handled by `mouse:down` on non-table objects

**View mode cell rendering:**
- `text` / `number` / `date`: `<span>` showing value, or muted placeholder (`color: #94a3b8`) if empty
- `checkbox`: `<input type="checkbox" disabled />`
- `dropdown`: `<span>` showing selected option label

---

## Part 2 — Template Object Spec Extension

### TemplateObjectSpec changes

Add `'table'` to the type union and three new fields:

```ts
export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky' | 'input-field' | 'button' | 'table'  // 'table' is NEW
  relLeft: number
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string           // used as table title when showTitle: true
  fontSize?: number
  // Table-specific (only used when type === 'table')
  showTitle?: boolean
  accentColor?: string
  formSchema?: {
    columns: Array<{ id: string; name: string; type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'date' }>
    rows: Array<{ id: string; values: Record<string, string | number | boolean> }>
  }
}
```

### executeAiCommands changes

Add `createTable` to `ExecuteAiOptions`:

```ts
export interface ExecuteAiOptions {
  createFrame?: (params: ...) => void
  createTable?: (params: {
    left: number; top: number; width: number; height: number
    title: string; showTitle: boolean; accentColor?: string
    formSchema: FormSchema | null
  }) => string  // returns objectId
  getViewportCenter?: () => { x: number; y: number }
}
```

In `applyTemplate`, when `obj.type === 'table'`:
- Call `options.createTable(...)` with the spec's formSchema, showTitle, accentColor
- Track returned objectId in `createdIds` and `trackedBounds`

Add `createGrid` command handler:
```ts
// cmd.action === 'createGrid'
// cmd.rows: number, cmd.cols: number, cmd.fill?: string, cmd.width?, cmd.height?
// Creates rows×cols sticky notes at viewport center in a grid layout
```

---

## Part 3 — Template Redesigns

### Pros & Cons — NO CHANGE
Stays as stickies. "Create a 2×3 grid of sticky notes for pros and cons" → `createGrid` command creates the grid directly without a template.

### SWOT Analysis — Redesigned

**Layout:** Frame (560×500) containing four DataTables in a 2×2 grid, each 240×210.
Each table: `showTitle: true`, single column "Item" (5 blank rows).

| Quadrant | Title | `accentColor` | Position |
|---|---|---|---|
| Top-left | Strengths | `#16a34a` (green) | relLeft 20, relTop 52 |
| Top-right | Weaknesses | `#dc2626` (red) | relLeft 300, relTop 52 |
| Bottom-left | Opportunities | `#2563eb` (blue) | relLeft 20, relTop 278 |
| Bottom-right | Threats | `#ca8a04` (amber) | relLeft 300, relTop 278 |

### Retrospective — Redesigned

**Layout:** Frame (740×420) containing one DataTable (700×360), `showTitle: false`.
Three pre-named columns, 5 blank rows each:

| Column | Accent |
|---|---|
| ✓ What Went Well | `#16a34a` header tint |
| ✗ What Didn't | `#dc2626` header tint |
| → Action Items | `#2563eb` header tint |

Column header background tints are applied per-column using a `headerColor` field on `FormColumn` (new optional field).

### User Journey Map — Redesigned

**Layout:** Frame (980×380) containing one DataTable (940×320), `showTitle: false`.
Six columns: first column = "Phase" (row label, bold), five stage columns.
Five pre-populated rows with phase category labels in column 1.

Columns: `Phase` | `Awareness` | `Consideration` | `Decision` | `Retention` | `Advocacy`

Rows (pre-populated in column 1):
- `Actions`
- `Tasks`
- `Feelings`
- `Pain Points`
- `Opportunities`

---

## Part 4 — Per-Column Header Color (FormColumn extension)

To support colored column headers in Retrospective (and future tables), add optional `headerColor` to `FormColumn`:

```ts
export interface FormColumn {
  id: string
  name: string
  type: FormFieldType
  options?: string[]
  headerColor?: string   // NEW — optional background tint for this column's <th>
}
```

The overlay renders `background: col.headerColor ?? (accentColor tint)` on each `<th>`.

---

## Architecture Summary

```
WorkspacePage
  ├── FabricCanvas
  │     └── mouse:dblclick on DataTable → onTableDoubleClick(id)
  └── FrameFormOverlay
        ├── editingTableId prop
        └── FrameFormPanel (isEditing = editingTableId === frameId)
              ├── VIEW MODE: spans, no controls
              └── EDIT MODE: inputs, +Row, +Column, ✕ buttons

templateRegistry.ts
  └── TemplateSpec.objects[] includes type:'table' with formSchema

executeAiCommands.ts
  ├── applyTemplate → type:'table' calls createTable callback
  └── createGrid → creates N×M sticky notes at viewport center

FabricCanvas
  └── createTable imperative handle → createDataTableShape + setTableFormSchema
```

---

## Files Affected

| File | Change |
|---|---|
| `frameFormTypes.ts` | Add `headerColor?: string` to `FormColumn` |
| `dataTableFactory.ts` | Add `showTitle`, `accentColor` params; default `showTitle: false` |
| `dataTableUtils.ts` | Update `DataTableData` interface; add `showTitle`, `accentColor` |
| `FrameFormOverlay.tsx` | Add view/edit mode; accent color styling; optional title bar; per-column header color |
| `FabricCanvas.tsx` | `mouse:dblclick` → `onTableDoubleClick`; `createTable` imperative handle |
| `WorkspacePage.tsx` | `editingTableId` state; pass to `FrameFormOverlay`; wire `createTable` |
| `templateRegistry.ts` | Add `'table'` to `TemplateObjectSpec`; redesign SWOT/Retro/UserJourney |
| `executeAiCommands.ts` | Handle `type:'table'` in `applyTemplate`; add `createGrid` command; add `createTable` to options |
| `aiInterpretApi.ts` | Add `createGrid` to `AiCommand` union |

---

## Non-Goals (Out of Scope)

- Row headers (distinct from data cells) — not added; first column serves as row label
- Nested frame propagation fix — deferred
- Table resize handles — deferred
- Toolbar color picker for `accentColor` — deferred (set at creation time only)
