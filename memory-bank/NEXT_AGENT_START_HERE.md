# START HERE - Next Agent Context

**Date:** 2026-02-21

## Explorer Canvas Plan (2026-02-21)

**Plan doc:** `docs/plans/2026-02-21-explorer-canvas.md` — 14 tasks, ~48 hrs, 7 parallel groups.

**Summary:** New "Expedition" board mode with enhanced drawing (brush slider 1–512px log scale, 4 brush types, opacity, eraser), new shapes (ellipse, polygon/hexagon/star, freeform polygon, arrow), zoom-dependent visibility (LOD: 5 scale bands — Ocean/Voyage/Harbor/Deck/Spyglass), procedural + AI map generation, Ports of Call bookmarks, mini-map navigator, hex grid + snap, optional Fog of War, laser pointer, follow mode, animated zoom transitions.

**Key architecture:**
- `board_mode` column on `boards` table (`'standard' | 'explorer'`)
- `BoardMeta.boardMode` flows through `BoardPage` → `WorkspacePage` → `WorkspaceToolbar` → `FabricCanvas`
- Explorer-exclusive features gated by `isExplorer = board.boardMode === 'explorer'`
- Enhanced drawing tools + new shapes available in ALL board modes
- LOD uses `data.minZoom` / `data.maxZoom` on canvas objects
- Procedural map: `expeditionMapGenerator.ts` (seeded PRNG, ~50ms), ~40–80 objects across scale bands
- AI enrichment: background call to `ai-interpret` Edge Function for creative names (optional, ~2s)

**Execution order:** Task 1 (infrastructure) first → Tasks 2/3/4 (tools) parallel → Tasks 5/6/7 (explorer features) parallel → Tasks 8/9 (grid+minimap) parallel → Task 10 (map gen) → Tasks 11/12/13 (fog+collab) parallel → Task 14 (polish).

## MeBoard 1.0 COMPLETE (2026-02-21)

Tasks 1-3 of the Explorer Canvas plan are done. These are the "all-modes" features that constitute MeBoard 1.0:

1. **Board mode infrastructure** ✅ — `board_mode` column on `boards` table. `BoardMeta.boardMode` threaded through full component tree. Creation picker: "⚓ New Board" / "🗺️ New Expedition". Expedition badge on board cards. Migration: `20260221000000_board_mode.sql` (applied to remote).
2. **Enhanced DrawBrushControl** ✅ — Full rewrite with 4 brush types (pencil/circle/spray/pattern), eraser toggle (`globalCompositeOperation: 'destination-out'`), log-scale size slider (1–512px), opacity slider, color picker. New FabricCanvas imperative handles: `setDrawBrushType`, `setDrawBrushOpacity`, `setDrawEraserMode`.
3. **New shapes** ✅ — Ellipse + Polygon (3–12 sides, star mode). Added to `ToolType`, `SHAPE_TOOLS`, `shapeFactory.ts`, insert menu. Contextual toolbar: sides spinner + star checkbox. 4 new tests passing.

**Also fixed:** vitest `globals: true` in `vite.config.ts`. Migration DROP FUNCTION pattern for RPC return type changes.

## Current State

**Template + DataTable bug fixes complete (2026-02-20).** Four issues fixed on top of the Table Polish + Template Redesign task. TypeScript: 0 errors (pre-existing `auth/index.ts` export error unrelated).

### What Was Done (2026-02-20 — Bug Fixes)

1. **SWOT frame overflow** — `TABLE_MIN_WIDTH = 280` silently inflated the 240px table specs past the 560px frame. Fixed: `frameWidth` → 620, right-column `relLeft` → 320, table widths → 280 in `templateRegistry.ts`.

2. **Frame containment for templates** — Sticky/rect children (Pros & Cons) created via `createObject` arrived via realtime with `isApplyingRemote = true`, skipping `checkAndUpdateFrameMembership` → `frame.childIds` empty → moving frame left children behind.
   - `createFrame` in `FabricCanvasZoomHandle` now returns `string` (the frame ID).
   - New `setFrameChildren(frameId: string, childIds: string[]) => void` on `FabricCanvasZoomHandle`; fires `object:modified` to sync.
   - `executeAiCommands.ts`: `templateChildIds: string[]` collects IDs for both table and non-table children; after loop calls `options.setFrameChildren(templateFrameId, templateChildIds)`.
   - `ExecuteAiOptions.createFrame` return type changed to `string`; `setFrameChildren?` added.
   - Wired through `AiPromptBar` (new prop + dep) → `WorkspacePage`.

3. **accentColor / showTitle persistence** — Both fields were never written to Supabase or restored on load.
   - `boardSync.ts` `emitAdd` and `buildPayload`: add `payload.accentColor` + `payload.showTitle` for `subtype === 'table'`.
   - `tableData` loading block: adds `accentColor` and `showTitle` from `clean.*`.
   - Remote-update handler for tables: merges `accentColor` + `showTitle` from `clean` into `existingData`.

4. **Frame/Table rotation disabled + overlay zoom mismatch**
   - `frameFactory.ts` and `dataTableFactory.ts`: `lockRotation: true` + `setControlsVisibility({ mtr: false })`.
   - `FrameFormOverlay.tsx`: hide threshold `zoom < 0.15` → `zoom < 0.4`; removed `const minWidth = 320`; overlay `width: screenWidth` (no floor). Overlay now scales 1:1 with the canvas object at all zoom levels.

### What Was Done (2026-02-20 — Table Polish + Template Redesign)
1. **DataTable schema** — `showTitle: boolean` + `accentColor?: string` on `DataTableData`; `headerColor?: string` on `FormColumn`; `dataTableFactory.ts` params updated with defaults.
2. **FrameFormOverlay accent + title bar** — Accent-driven border, column headers, title bar. `accentTint()` helper. `showTitle` flag controls title bar. `headerColor` per column.
3. **View / Edit mode** — Double-click → edit (indigo border, controls); click outside → view (accent border, read-only). `editingTableId` in WorkspacePage; callbacks via FabricCanvas props.
4. **`createGrid` command** — `{ action: 'createGrid', rows, cols, fill?, width?, height? }` → R×C sticky grid at viewport center. Added to `AiCommand` union + `executeAiCommands`.
5. **`createTable` callback** — `ExecuteAiOptions.createTable`, `FabricCanvasZoomHandle.createTable` imperative handle, wired WorkspacePage → AiPromptBar → executeAiCommands. `TemplateObjectSpec` extended with `type: 'table'`.
6. **Templates redesigned** — SWOT (4 colored DataTables, `showTitle: true`, frame 620×500), Retrospective (1 table, 3 colored headers, `showTitle: false`), User Journey Map (1 wide table, Phase + 5 stage columns, 5 pre-populated rows).

### Key Patterns for DataTable
- `showTitle: false` → no title bar rendered, table is compact data grid only.
- `accentColor: '#16a34a'` → green border + `#dcfce7` header tint. Accent map: green/red/blue/amber/default-blue.
- `isEditing` passed from `FrameFormOverlay` → `FrameFormPanel`; driven by `editingTableId === frame.objectId`.
- Double-click on Fabric DataTable group → `onTableEditStart(id)`. Click on canvas (non-table) → `onTableEditEnd()`.
- `createTable` in `FabricCanvasZoomHandle`: creates shape, sets formSchema, adds to canvas, returns objectId string.
- `accentColor` and `showTitle` are now persisted to Supabase — always include them in `buildPayload` for tables.
- Frame/DataTable objects both use `lockRotation: true` — never show rotation handle.
- HTML overlay is hidden at `zoom < 0.4`; scales exactly to `screenWidth × screenHeight` (no minimum width floor).

**MVP is complete.** Stroke width control and tldraw-style toolbar are in place. Zoom range extended to 0.001%–10000% (MIN_ZOOM 0.00001). Locking, sync, presence, Hand tool, zoom shortcuts + zoom UI, shape-tool fix, and paginated document load are done.

### What Was Done (Previous Session)
1. **Shape tool vs selection** — With any shape tool active, pointer-down always starts drawing (discardActiveObject + draw); never selects. FabricCanvas handleMouseDown.
2. **Hand tool** — New tool in WorkspaceToolbar; left-drag pans (cursor grab); FabricCanvas isHandDrag branch.
3. **Zoom shortcuts** — +/= in, − out, 0 fit to content, 1 = 100%. applyZoom/zoomToFit in FabricCanvas; handleKeyDown.
4. **Zoom UI** — Toolbar zoom dropdown (25%–400% + Fit). FabricCanvas ref (FabricCanvasZoomHandle) exposes setZoom/zoomToFit; WorkspacePage passes zoom from viewport and ref to toolbar.
5. **Board loading** — documentsApi fetchInitial paginated: PAGE_SIZE 50, order by object_id, range(); batches applied in sequence so first 50 appear quickly.

### Completed
- Google Auth, presence awareness, multi-selection move sync, very wide zoom ✅
- **Shape tool fix** ✅ — Draw never selects when shape tool active
- **Hand tool** ✅
- **Zoom shortcuts** ✅ — +/-, 0, 1
- **Zoom UI** ✅ — Dropdown in toolbar
- **Paginated document load** ✅
- **Stroke width** ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils, FabricCanvas onSelectionChange + setActiveObjectStrokeWidth
- **Sticky notes** ✅ — No placeholder text; on create, edit mode opens automatically (blinking cursor). shapeFactory: [bg, mainText]; handleMouseUp → setTimeout(50) → tryEnterTextEditing(mainText); hiddenTextarea?.focus().
- **Toolbar aesthetic** ✅ — Icon-based tool groups (tldraw-like), header aligned
- **Zoom range** ✅ — 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100); stroke in design units (automatic)

## Connectors Phase 1 DONE (2026-02-19)
Full implementation: waypoints (drag midpoint handles to reshape, double-click to delete), arrowheads (none/end/both, via `after:render`), stroke dash (solid/dashed/dotted), create-on-drop popup, floating endpoints on delete, toolbar controls, full sync.

Files changed: `connectorFactory.ts` (rewrite), `connectorControls.ts` (rewrite + waypoint handles), new `connectorArrows.ts` (after:render arrowheads), new `ConnectorDropMenu.tsx` (shape picker popup), `FabricCanvas.tsx` (integrated + drop menu state), `WorkspaceToolbar.tsx` (arrow mode + dash controls), `boardSync.ts` (serialize waypoints/arrowMode/strokeDash/floatPoints). TypeScript: 0 errors, 0 lint errors.

## Connector Rotation/Scale Fix DONE (2026-02-19)
Connector endpoints now update in real-time when connected objects are **rotated** or **scaled**. Previously only `object:moving` triggered `updateConnectorsForObjects`; `object:scaling` and `object:rotating` only called `emitModifyThrottled`.

**Fix in `boardSync.ts`:**
- Added `getTransformIds` helper (mirrors move's `getObjectsToSync` pattern).
- `object:scaling` and `object:rotating` now call `updateConnectorsForObjects(ids)` before `emitModifyThrottled`.
- `applyRemote`: both the group path and regular-object path now call `updateConnectorsForObjects` after applying remote property changes, so remote rotate/scale propagates to connector endpoints on all clients. Guard: `!isConnector(existing)` prevents redundant updates when a connector itself is remotely modified.
- Port positions were already correct (they use `calcTransformMatrix()` which includes full rotation + scale matrix) — only the trigger was missing.

## Critical Pattern: Free Draw Event Registration Order

Free-draw paths require their ID to be assigned **before** `setupDocumentSync` is called, because boardSync's `object:added` fires first. The handler `assignFreeDrawPathId` must always be registered on `canvas.on('object:added')` **before** `setupDocumentSync(...)`.

Pattern: any handler that mutates an object before boardSync sees it must be registered before `setupDocumentSync`.

## Explorer Canvas Group D COMPLETE (2026-02-21)

Tasks 8 and 9 of the Explorer Canvas plan are done:

8. **Mini-map navigator** ✅ — `MiniMapNavigator.tsx` (200×140px parchment-styled overlay, bottom-left, explorer only). `getMiniMapData()` on `FabricCanvasZoomHandle`: saves viewport, zoom-to-fit, JPEG capture, restore. Blue viewport rectangle overlay. Click-to-pan via `panToScene`. Updates every 2s + on object count change. `getBoundingRect(true)` for grouped objects. Refresh race protection via version counter.
9. **Hex grid + snap** ✅ — `drawHexGrid(canvas)` in `drawCanvasGrid.ts` (flat-top hexagons, HEX_SIZE=20, low-zoom guard `hexH < 4`). `gridType: 'square' | 'hex' | 'none'` prop on FabricCanvas; explorer boards default `'hex'`, standard boards `'square'`. `GridOverlay` (CSS) only rendered when `gridType === 'square'`. 3-button pill in toolbar (□/⬡/✕). `snapToGrid: boolean` prop; snap rounds to nearest 20px grid on `object:modified` (before `setupDocumentSync`). 🧲 toggle in toolbar.

## Explorer Canvas Group E COMPLETE (2026-02-21)

Task 10 of the Explorer Canvas plan is done:

10. **Procedural expedition map generator** ✅ — `expeditionThemes.ts` (3 themes: Pirate Seas/Frozen North/Volcanic Chain). `expeditionMapGenerator.ts` (Mulberry32 seeded PRNG, generates 41–91 objects across 5 LOD scale bands). `populateExpeditionMap()` on `FabricCanvasZoomHandle` creates Fabric objects (Ellipse/Rect/IText) directly on canvas — boardSync `object:added` handles Supabase sync. `WorkspacePage` triggers on first load of empty expedition board (`isExplorer && objectCount === 0 && boardReady`). `mapGeneratedRef` guards re-trigger; resets on `board.id` change. Initial viewport: 3% zoom centered on map.

## Next Items (suggested)

### Expedition Map v2 COMPLETE (2026-02-21)

**Plan doc:** `docs/plans/2026-02-21-expedition-map-v2.md` — complete.

**What was built:**
- **Re-centered coordinates:** Map world now ±10M centered at (0,0); `viewportCenter: {x:0,y:0}`.
- **Procedural coastlines:** `noiseCoastline.ts` — FBM-based radial distortion, 80 vertices for continents, 50 for islands. Each landmass has unique craggy shape (bays, peninsulas).
- **Extended MapObjectSpec:** `'polygon'` and `'polyline'` types with `points[]` and `strokeDashArray`. `populateExpeditionMap` in `useFabricImperativeApi.ts` now creates `Fabric.Polygon` and `Fabric.Polyline`.
- **Treasure markers (Deck scale 0.005+):** Per-continent gold parchment rects + red ✕ + name label + dashed polyline trail from nearest town.
- **Rich harbor towns (Harbor scale 0.0008–0.012):** Town boundary wall + 3–5 buildings + dock + dock label. Dashed paths between adjacent towns per continent.
- **Compass rose:** 🧭 at Harbor scale.
- **Sea routes (Voyage scale 0.00005–0.001):** Dashed blue polylines connecting adjacent continents.
- **Sea creatures (Voyage scale 0.00008–0.0005):** 5 emoji markers (🐙🦑🐋🦈🐉) scattered in ocean.
- **Coastal outposts (~30% of islands, Voyage scale 0.0002–0.001):** Small fortress rects + 🏰 Outpost labels.
- **`treasureNames` on all 3 themes** in `expeditionThemes.ts`.
- **`mapRole` on text objects** (`continent-name | island-name | ocean-name | town-name | landmark-name | treasure-name`) stored in Fabric `data` for future AI name enrichment.

**Total ~120–160 objects per map.** Content at every zoom level from 0.002% through Harbor.

### Explorer Canvas Group F COMPLETE (2026-02-21)

Tasks 11, 12, 13 done:
- **Task 11: Fog of War** ✅ — FogOfWarOverlay, fogOfWarStorage. Persistence (fog enabled survives navigation). Reveal slider (20–300px). Zoom scaling (sceneRadius = revealRadius/zoom). Expedition maps auto-enable fog.
- **Task 12: Laser pointer** ✅ — Trail buffer, broadcast, 1.5s fade. All modes.
- **Task 13: Follow mode** ✅ — Click presence icon to mirror viewport. All modes.

### Remaining Explorer Canvas task
- **Task 14** — Animated zoom transitions + arrow shape.
- See `docs/plans/2026-02-21-explorer-canvas.md` for full details.

**Done this session:**
- **AI Client API** ✅ — createObject, updateObject, deleteObjects, queryObjects; getDocument/fetchDocuments in documentsApi; exported from @/features/workspace.
- **AI Client API docs (Task B)** ✅ — docs/AI_CLIENT_API.md updated: marked "Implemented (client + Edge Function)", import examples, usage examples. Edge Function (supabase/functions/ai-canvas-ops) + frontend wrapper (aiCanvasOpsEdgeApi.ts) + barrel export all verified.
- **Trackpad pan/zoom** ✅ — Two-finger scroll = pan, pinch = zoom at cursor (FabricCanvas handleWheel: ctrlKey → zoom, else relativePan). Pinch sensitivity 0.006 (deltaY multiplier).

**Done this session:**
- **AI agent** ✅ — ai-interpret Edge Function (OpenAI gpt-4o-mini), AiPromptBar in workspace, invokeAiInterpret + executeAiCommands. User types natural language ("add a blue rectangle at 100, 100"); client executes via aiClientApi. Requires OPENAI_API_KEY secret. Deploy: `supabase functions deploy ai-interpret --no-verify-jwt`.

## ~~🔴 BLOCKING: OpenAI API Key Missing Scope~~ ✅ RESOLVED

**Status:** OpenAI key permissions confirmed fixed. AI agent (`ai-interpret`) and parrot joke generation (usePirateJokes) are now unblocked.

**Post-MVP / polish:**
- ~~Undo/Redo~~ ✅ DONE.
- ~~Revocable invite links~~ — removed from scope.

**Done this session (MeBoard branding — canvas items, post-merge):**
- **CursorOverlay fix** ✅ — Removed color dot; only pirate emoji icon shown (⚓🦜🧭☠️🔱 hash-assigned) + name label below.
- **MapBorderOverlay** ✅ — `src/features/workspace/components/MapBorderOverlay.tsx`: 4 gradient strips at canvas edges (sepia/parchment), zoom-aware opacity (fades when zoomed in), compass rose emoji in corners. Toggle button (🗺️) in WorkspaceToolbar right section. `showMapBorder` state in WorkspacePage.
- **Pirate Plunder stickers** ✅ — 9 emoji stickers (anchor ⚓, skull ☠️, ship ⛵, hat 🎩, compass 🧭, parrot 🦜, chest 💰, sword 🗡️, barrel 🛢️). `pirateStickerFactory.ts`: uses `fabric.Text` (not IText) — non-editable, selects like image; 96×96 scene units; emoji font stack. `ToolType` + `'sticker'`. FabricCanvas: click-to-place (no drag) in handleMouseDown; `selectedStickerKind` prop + `stickerKindRef`. WorkspaceToolbar: 🏴‍☠️ dropdown "Pirate Plunder" 3-col grid; map border toggle. Sword is single-blade 🗡️.

**Done this session (MeBoard branding — safe parallel items):**
- **LoginPage rebrand** ✅ — Full pirate theme: "MeBoard" hero, "Ahoy Captain" copy, parchment card, gold Google button ("Join the Crew with Google"), "Enter the Ship" submit, "New to the crew? Sign up free ⚓" toggle, "Why MeBoard?" feature section, testimonial, CTA.
- **NavBar + Footer** ✅ — `src/shared/components/NavBar.tsx` (fixed top, MeBoard logo, Log In/Sign out) + `src/shared/components/Footer.tsx`. Used in LoginPage and BoardListPage. Features/Pricing pages out of scope (add later if needed).
- **index.html** ✅ — Title: "MeBoard – Pirate-Themed Collaborative Whiteboard"; meta description; OG tags; anchor emoji favicon (SVG data URI).
- **App.tsx loading** ✅ — "Hoisting the sails…" with ⚓ anchor icon on navy gradient.
- **Pirate cursor icons** ✅ — `CursorOverlay.tsx`: dot replaced with emoji icon (⚓🦜🧭☠️🔱) assigned deterministically via `hash(userId) % 5`. Color dot removed — icon only.

**Fixed this session (2026-02-19):**
- ~~**Cursor lag**~~ ✅ — Switched cursor positions from Presence API (DB round-trip) to **Supabase Broadcast** (same path as move-deltas, no DB). Debounce → 33ms throttle so positions stream during movement. CursorOverlay: `left/top` → `transform: translate(x,y)` + `transition: transform 80ms linear` for GPU-composited interpolation. Stale cursor cleanup 3s in usePresence. Files: `presenceApi.ts`, `usePresence.ts`, `CursorOverlay.tsx`.

**Fixed this session:**
- ~~**Multi-selection move drift**~~ ✅ — Root cause: originX/originY vs calcTransformMatrix center mismatch. Three fixes in boardSync.ts (payloadWithSceneCoords uses addTransformToObject; move-delta receiver uses obj.left+dx; applyRemote skips active selection echo). See systemPatterns for the pattern doc.

**Recently completed (2026-02-19):**
- ~~**`usePirateJokes` hook + Edge Function**~~ ✅ — pirate-jokes Edge Function + usePirateJokes; cache `meboard:jokes:YYYY-MM-DD`; first-time welcome `meboard:welcomed:${userId}` when no boards.
- ~~**Presence icon avatars**~~ ✅ — WorkspacePage header emoji icons; getPirateIcon; panToScene; "+N" overflow.
- ~~**Presence stale cleanup fix**~~ ✅ — lastActive → 0 stub instead of remove; icons persist until leave.
- ~~**Viewport persistence**~~ ✅ — viewportPersistence.ts; debounced 400ms save; restore on mount; Reset view in zoom dropdown.
- ~~**WelcomeToast**~~ ✅ — "Welcome aboard!" on first BoardListPage visit per session.
- ~~**EmptyCanvasX**~~ ✅ — Faint central "✕" on empty zoomed-out boards; EmptyCanvasX.tsx; onObjectCountChange.
- ~~**NavBar/Footer on BoardListPage**~~ ✅ — Features/Pricing out of scope (add later if needed).

**Planned (documented in PRD + memory bank):**
- **Canvas features** — docs/PLANNED_CANVAS_FEATURES.md: Object grouping (Group ✅, Ungroup ⚠️ **bug: objects move + unselectable — being fixed**), Free draw (pencil), Lasso selection, Multi-scale map vision.
- **Finished-product requirements** — Connectors (Miro-style, required), Frames, Duplicate, Copy & Paste, Marquee mode (box-select over large objects). See docs/PLANNED_CANVAS_FEATURES.md §5–9.
- ~~**Bring forward / send backward**~~ ✅ — Done. bringForward/sendBackward in FabricCanvas + toolbar buttons.
- ~~**Boards page cleanup**~~ ✅ — Done (Figma-inspired: header, loading, empty, card rows, copy link, delete, rename, sort).
- **Boards grid (last-opened order)** ✅ — Grid of cards (not list), ordered by last_accessed_at. Migration 20260218100000_user_boards_last_accessed.sql; BoardMeta.lastAccessedAt; joinBoard upserts last_accessed_at; subscribeToUserBoards orders by last_accessed_at desc. formatLastAccessed: "Opened 2h ago", etc. Grid layout: gridAutoRows 130, columnGap 16, rowGap 20; gridItem display flex; boardCard flex 1 minHeight 100. Log cleanup: removed verbose [LOCKS]/[FABRIC]/[APPLYLOCK]; only log CHANNEL_ERROR/TIMED_OUT (skip CLOSED).

### Parallel agent tasks (no merge conflicts)

**Run these in parallel (different files/areas):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| ~~**A**~~ | ~~**Fix multi-selection move drift**~~ | ~~boardSync.ts, FabricCanvas.tsx~~ | ✅ DONE. Origin-vs-center fix. |
| ~~**B**~~ | ~~**AI Client API docs**~~ | ~~docs/AI_CLIENT_API.md~~ | ✅ DONE. Docs updated, usage examples, Edge Function + client imports verified. |
| ~~**C**~~ | ~~**StrictMode for production only**~~ | ~~main.tsx~~ | ✅ DONE. StrictMode wraps app only when import.meta.env.PROD. |
| ~~**D**~~ | ~~**AI agent (Edge Function)**~~ | supabase/functions/ai-interpret, AiPromptBar | ✅ DONE. OpenAI + aiClientApi. |
| **E** | **Revocable invite links** | supabase/migrations, invite API, ShareModal/BoardListPage | Post-MVP. Low priority — do last. |

**Run one at a time (all touch workspace canvas/sync — same area):**

| Agent | Task | Primary files | Notes |
|-------|------|----------------|--------|
| ~~**F**~~ | ~~**Z-order nudge (bring forward / send backward)**~~ | ~~FabricCanvas.tsx, WorkspaceToolbar, boardSync.ts~~ | ✅ DONE. bringForward/sendBackward implemented + toolbar buttons. |
| ~~**G**~~ | ~~**Rotation throttle + sync**~~ | ~~boardSync.ts~~ | ✅ DONE. object:rotating hooked to emitModifyThrottled. |
| ~~**H**~~ | ~~**Touch handling (mobile)**~~ | ~~FabricCanvas.tsx~~ | ✅ DONE. Two-finger pan + pinch zoom via native touchstart/touchmove/touchend on canvas element (passive:false). touch-action:none on container. Single-touch (tap/draw/select) routes through Fabric pointer-event mapping unchanged. |
| ~~**I**~~ | ~~**Undo/Redo**~~ | ~~New feature module, FabricCanvas, boardSync~~ | ✅ DONE. historyManager.ts; Cmd+Z/Shift+Z keyboard shortcuts; undo/redo toolbar buttons; onHistoryChange prop; remoteChangeRef in setupDocumentSync prevents recording remote changes. |

**Rule:** Agents **A–E** can run in parallel with each other. Agents **F–I** each touch `boardSync` and/or `FabricCanvas` — run only one of F–I at a time (or after A is done, to avoid conflicts).

## FabricCanvas File Structure (after 2026-02-21 refactor)

`FabricCanvas.tsx` was 2637 LOC — split into 5 files all under 1000 LOC:

| File | LOC | Purpose |
|------|-----|---------|
| `components/FabricCanvas.tsx` | 273 | Thin orchestrator, mounts canvas, wires hooks |
| `hooks/useFabricImperativeApi.ts` | 752 | All `useImperativeHandle` methods (FabricCanvasZoomHandle) |
| `hooks/useFabricCanvasSetup.ts` | 792 | Main `useEffect`: init, event wiring, doc sync, history |
| `hooks/fabricCanvasEventHandlers.ts` | 867 | `createFabricCanvasEventHandlers` pure factory (returns handlers only, no `.on()` calls) |
| `hooks/fabricCanvasKeyHandlers.ts` | 266 | `createKeyboardHandlers` pure factory (handleKeyDown/handleKeyUp) |

**Key rule:** The event handler factories are pure — they define functions only. All `canvas.on()` / `document.addEventListener()` calls live in `useFabricCanvasSetup.ts`.

## Quick Reference
- **Zoom range:** 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100). `fabricCanvasZoom.ts`.
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **FabricCanvas:** forwardRef with FabricCanvasZoomHandle (setZoom, zoomToFit, getActiveObject, setActiveObjectStrokeWidth). onSelectionChange(strokeInfo). Hand tool: isHandDrag → pan. Shape tool: always draw. Stroke in design units (scales with zoom automatically). **Trackpad:** two-finger scroll = pan (relativePan), pinch = zoom at cursor (ctrlKey branch; sensitivity 0.006). **Touch (mobile):** native touchstart/touchmove/touchend on canvasEl (passive:false) — 2-finger pan + pinch zoom; single-touch routes through Fabric pointer-event mapping. Container has touch-action:none. **Implementation split:** `useFabricImperativeApi.ts` (ref handle) + `useFabricCanvasSetup.ts` (effect) + `fabricCanvasEventHandlers.ts` (factory) + `fabricCanvasKeyHandlers.ts` (keyboard factory).
- **strokeUtils.ts:** getStrokeWidthFromObject, setStrokeWidthOnObject, MIN/MAX_STROKE_WEIGHT (1–100), clampStrokeWeight(); StrokeControl uses number input.
- **WorkspaceToolbar:** Icon groups (Select|Hand | shapes | Text|Sticky), Pirate Plunder (🏴‍☠️) dropdown, StrokeControl when selectionStroke set, map border toggle (🗺️), zoom dropdown.
- **Pirate Plunder stickers:** fabric.Text emoji (96×96), non-editable, click-to-place. pirateStickerFactory.ts: STICKER_DEFS (anchor, skull, ship, hat, compass, parrot, chest, sword 🗡️, barrel). ToolType 'sticker'.
- **Sticky notes:** No placeholder. Create → box completes → edit mode opens (blinking cursor). shapeFactory sticky = [bg, mainText]; FabricCanvas handleMouseUp auto-enters edit after 50ms.
- **documentsApi:** subscribeToDocuments fetchInitial uses .range(offset, offset + PAGE_SIZE - 1) in a loop.
- **Lines:** shapeFactory creates lines as Polyline (not Fabric Line). No legacy Line boards to support.
- **AI agent:** ai-interpret Edge Function (OpenAI gpt-4o-mini). AiPromptBar in WorkspacePage. invokeAiInterpret → executeAiCommands → aiClientApi. OPENAI_API_KEY secret required. **Deploy MUST use `--no-verify-jwt`** (Supabase gateway rejects ES256 user JWTs otherwise). Auth in function uses `supabase.auth.getUser(token)` (explicit token — required in Deno). Client uses `supabase.functions.invoke()`. ✅ OpenAI key permissions fixed — AI agent working.
  - **Three-tier resolution:** (1) `detectSimpleShape()` — "draw a blue circle at 100, 100" → instant, zero network; (2) `detectTemplateLocally()` → instant, zero network; (3) Edge Function + OpenAI. `AiInterpretResponse.source: 'local' | 'template' | 'api'` + `usage?: AiUsage`.
  - **Edge Function perf:** `max_tokens: 300`. `SYSTEM_PROMPT_CORE` (~750 tok) + `FORM_ADDENDUM` (~350 tok) appended only when `isFormRequest(prompt)`.
  - **Observability:** LangSmith via `wrapOpenAI`. Supabase secrets required: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING_BACKGROUND=false`, `LANGSMITH_PROJECT=meboard`. Also logs to Supabase Edge Function logs (`[ai-interpret] request` + `[ai-interpret] usage`).
  - **AiPromptBar result chip:** blue ⚡ local / gray 📋 template / green ✦ AI with token count. Modal stays open after run.
- **BoardListPage:** Grid of cards (repeat(auto-fill, minmax(220px, 1fr))), gridAutoRows 130, columnGap 16, rowGap 20. Ordered by last_accessed_at. boardsApi: recordBoardAccess, BoardMeta.lastAccessedAt.
- **usePirateJokes:** `src/features/boards/hooks/usePirateJokes.ts`. Cache key `meboard:jokes:YYYY-MM-DD`. Edge Function `pirate-jokes` (deploy: `supabase functions deploy pirate-jokes --no-verify-jwt`). FALLBACK_JOKES array used when offline/error. `pickJoke()` stable ref.
- **Parrot welcome:** `meboard:welcomed:${userId}` localStorage flag. Set on first show (no boards). After that, always jokes.
- **Presence icons:** `WorkspacePage` header. `getPirateIcon(userId)` exported from `CursorOverlay.tsx`. `FabricCanvasZoomHandle.panToScene(x, y)` centers viewport. Max 4 icons + "+N" overflow. `presenceHovered` state for count label.
- **Presence stale:** `usePresence.ts` stale timer resets `lastActive → 0` (stub) not remove. `CursorOverlay` skips `lastActive === 0`. Only `presence leave` event removes from list.
- **Viewport persistence:** `viewportPersistence.ts` — load/save per board (meboard:viewport:{boardId}); 400ms debounce; FabricCanvas restores on mount; Reset view in zoom dropdown.
