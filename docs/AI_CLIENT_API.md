# AI Client API (Implemented)

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
