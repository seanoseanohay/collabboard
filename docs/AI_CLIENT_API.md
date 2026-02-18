# AI Client API (Planned)

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

## Status

Planned. Not yet implemented.
