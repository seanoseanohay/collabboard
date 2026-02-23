# AI Client API (Implemented)

## Named Board API

High-level named functions for programmatic board manipulation.
Import from `@/features/workspace`. Every function takes `boardId` as its first argument.
Writes go to Supabase; all canvas clients see the change via Realtime within ~50 ms.

### createStickyNote(boardId, text, x, y, color?)

```ts
import { createStickyNote } from '@/features/workspace'
const id = await createStickyNote(boardId, 'Hello world', 100, 200, '#fef08a')
```

| Param | Type | Default |
|-------|------|---------|
| boardId | string | required |
| text | string | required |
| x, y | number | required — scene coordinates |
| color | string | `'#fef08a'` (yellow) |

Returns: `objectId` (UUID)

---

### createShape(boardId, type, x, y, width, height, color?)

```ts
import { createShape } from '@/features/workspace'
const id = await createShape(boardId, 'rect', 50, 80, 200, 120, '#3b82f6')
```

| Param | Type | Notes |
|-------|------|-------|
| type | `'rect' \| 'circle' \| 'triangle' \| 'line' \| 'text'` | |
| x, y | number | top-left corner in scene coords |
| width, height | number | |
| color | string | `'#ffffff'` default |

Returns: `objectId` (UUID)

---

### createFrame(boardId, title, x, y, width, height)

Creates a labelled frame container. Frame is placed at z-index 1 (always behind its children).

```ts
import { createFrame } from '@/features/workspace'
const id = await createFrame(boardId, 'Sprint 1', 0, 0, 800, 600)
```

Returns: `objectId` (UUID)

---

### createConnector(boardId, fromId, toId, style?)

Creates an arrow/line between two existing objects.
Fetches both objects' current positions to compute endpoints; the canvas snaps endpoints to ports once rendered.

```ts
import { createConnector } from '@/features/workspace'
const id = await createConnector(boardId, rectId, circleId, {
  arrowMode: 'end',      // 'none' | 'end' | 'both'
  strokeDash: 'dashed',  // 'solid' | 'dashed' | 'dotted'
  sourcePort: 'mb',      // 'mt' | 'mr' | 'mb' | 'ml'
  targetPort: 'mt',
})
```

Returns: `objectId` (UUID)

---

### moveObject(boardId, objectId, x, y)

```ts
import { moveObject } from '@/features/workspace'
await moveObject(boardId, id, 300, 400)
```

---

### resizeObject(boardId, objectId, width, height)

```ts
import { resizeObject } from '@/features/workspace'
await resizeObject(boardId, id, 400, 300)
```

---

### updateText(boardId, objectId, newText)

Works on sticky notes, text objects, and labelled shapes.

```ts
import { updateText } from '@/features/workspace'
await updateText(boardId, id, 'Updated label')
```

---

### changeColor(boardId, objectId, color)

Sets the fill color. Accepts any CSS color string.

```ts
import { changeColor } from '@/features/workspace'
await changeColor(boardId, id, '#ef4444')
```

---

### getBoardState(boardId)

Returns all objects on the board as a flat array. Useful as AI context.

```ts
import { getBoardState, type BoardObject } from '@/features/workspace'
const objects: BoardObject[] = await getBoardState(boardId)
// objects[0] = { objectId, type, left, top, width, height, fill, text, data }
```

---

## Overview

All CollabBoard actions should be executable via a documented client-side API. This allows:

- AI assistants (Cursor, Claude, in-app agent) to perform the same operations as the UI
- Consistent command surface for human and AI-driven workflows
- Optional server-side Edge Function that uses the same operations

## API Surface (Target)

### createObject(boardId, type, props)

Create a canvas object (rect, circle, triangle, line, text, sticky).

**Params:**

- `boardId`: string
- `type`: 'rect' | 'circle' | 'triangle' | 'line' | 'text' | 'sticky'
- `props`: { left, top, width?, height?, fill?, stroke?, strokeWeight?, text?, fontSize?, ... } — `strokeWeight` = nominal border thickness (screen pixels at 100%)

**Returns:** objectId (UUID)

### updateObject(boardId, objectId, partialProps)

Update object properties. Merges into existing document.

**Params:**

- `boardId`: string
- `objectId`: string
- `partialProps`: { fill?, stroke?, strokeWeight?, strokeWidth?, text?, fontFamily?, fontWeight?, fontStyle?, ... } — `strokeWeight` is nominal (screen pixels at 100%) for zoom-invariant border thickness

### deleteObjects(boardId, objectIds)

Delete one or more objects.

**Params:**

- `boardId`: string
- `objectIds`: string[]

### queryObjects(boardId, criteria?)

Find objects matching optional criteria (e.g. fill = blue).

**Params:**

- `boardId`: string
- `criteria?`: { fill?: string; type?: string; ... }

**Returns:** Array of { objectId, data }

## Implementation Notes

- Build on existing `writeDocument`, `deleteDocument`; client applies via Realtime
- Reuse/extend `shapeFactory.createShape` for createObject
- Document Fabric serialization schema so server-side AI can emit valid payloads
- UI should call this API (not bypass it) so UI and AI share one path

## AI Agent (Natural Language)

**Implemented.** Users can type natural language in the workspace (e.g. "add a blue rectangle at 100, 100"). The `ai-interpret` Edge Function calls OpenAI and returns structured commands; the client executes them via aiClientApi.

- **Edge Function:** `supabase/functions/ai-interpret` — requires `OPENAI_API_KEY`, `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING_BACKGROUND=false` secrets. Observability: traces at [smith.langchain.com](https://smith.langchain.com). Deploy: `supabase functions deploy ai-interpret`
- **Frontend:** `AiPromptBar` in WorkspacePage; `invokeAiInterpret`, `executeAiCommands` in workspace feature

## Status

**Implemented (client + Edge Function).** Use from workspace feature:

```ts
import {
  createObject,
  updateObject,
  deleteObjects,
  queryObjects,
  edgeCreateObject,
  edgeUpdateObject,
  edgeDeleteObjects,
  edgeQueryObjects,
  type CreateObjectType,
  type CreateObjectProps,
  type UpdateObjectProps,
  type QueryObjectsCriteria,
} from '@/features/workspace'
```

- **Client:** `aiClientApi.ts` — createObject (shapeFactory + writeDocument), updateObject, deleteObjects, queryObjects. Realtime sync applies changes to all clients.
- **Edge Function:** `supabase/functions/ai-canvas-ops` — same operations (createObject, updateObject, deleteObjects, queryObjects) for server-side AI. Invoke from frontend via `edgeCreateObject`, `edgeUpdateObject`, `edgeDeleteObjects`, `edgeQueryObjects`, or call the function directly with `action` + params. Deploy with: `supabase functions deploy ai-canvas-ops`.
- `documentsApi`: getDocument, fetchDocuments (optional `type`/`fill` criteria).

## Usage Examples

**Create and update an object:**

```ts
import { createObject, updateObject } from '@/features/workspace'

const id = await createObject(boardId, 'rect', { left: 100, top: 50, width: 80, height: 60, fill: '#3b82f6' })
await updateObject(boardId, id, { fill: '#10b981', strokeWeight: 2 })
```

**Query and delete:**

```ts
import { queryObjects, deleteObjects } from '@/features/workspace'

const blue = await queryObjects(boardId, { fill: '#3b82f6' })
if (blue.length) await deleteObjects(boardId, blue.map((o) => o.objectId))
```
