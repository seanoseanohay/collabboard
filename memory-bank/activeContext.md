# Active Context

## Current Focus
Presence & cursors.

## Recent Changes
- RTDB delta sync: documentsApi, boardSync, Fabric↔RTDB bidir
- Zoom: expanded to 0.02–20x for infinite canvas feel (was 0.1–5x)
- Viewport culling: Fabric skipOffscreen enabled
- WorkspaceToolbar: Select, Rect, Circle, Triangle, Line, Text, Sticky tools
- shapeFactory: createShape() for all types, tldraw-like flat styling
- FabricCanvas: selectedTool prop, drag-to-draw, preview, Delete/Backspace
- WorkspacePage: tool state, toolbar above canvas

## Next Steps (Recode Order)

1. ~~**Dependencies**~~ ✅
2. ~~**Fabric canvas wrapper**~~ ✅
3. ~~**Shapes + toolbar**~~ ✅
4. ~~**Viewport culling**~~ ✅ (Fabric skipOffscreen)
5. ~~**RTDB delta sync**~~ ✅
6. **Presence & cursors** — presence path, overlay, onDisconnect
7. **Locking** — client disable + server rules

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking

## Considerations
- Fabric requires custom sync (vs tldraw's built-in); use delta-only, UUID v4, server timestamps
- Locking: dual-layer (client + server); User A cannot edit what User B edits
- Presence: RTDB `/presence/{boardId}/{userId}`, 100ms or mousemove debounce
