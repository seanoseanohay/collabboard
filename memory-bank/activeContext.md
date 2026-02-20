# Active Context

## Current Focus (for next agent)
**Table Polish + Template Redesign complete (2026-02-20).** All 6 tasks implemented:

1. **DataTable schema extended** — `DataTableData` gains `showTitle: boolean` + `accentColor?: string`; `FormColumn` gains `headerColor?: string`; `dataTableFactory.ts` accepts both new params with defaults.
2. **FrameFormOverlay accent + title bar** — Border color driven by `accentColor` (default `#93c5fd`); `accentTint()` maps 5 known accents to light backgrounds; title bar conditionally rendered (`showTitle` flag); column headers tinted via `col.headerColor ?? accentBg`.
3. **View / Edit mode** — Default = view mode (no controls, read-only cells, draggable from full surface); double-click → edit mode (indigo border `#6366f1`, footer/delete/type-controls appear, cells editable). `editingTableId` state in `WorkspacePage`; `onTableEditStart`/`onTableEditEnd` callbacks wire through `FabricCanvas` → `WorkspacePage` → `FrameFormOverlay`.
4. **TemplateObjectSpec table type** — `type: 'table'` added to union; `showTitle`, `accentColor`, `formSchema` fields. `createTable` callback added to `ExecuteAiOptions` and wired through `FabricCanvas.createTable` → `WorkspacePage` → `AiPromptBar`. `createGrid` command added to `AiCommand` union + handler in `executeAiCommands`.
5. **Templates redesigned** — SWOT: 4 DataTable objects (green/red/blue/amber accents, `showTitle: true`, 5 pre-filled rows each). Retrospective: 1 wide table, 3 color-coded column headers, no title bar. User Journey Map: 1 wide table, Phase + 5 stage columns with blue headers, 5 pre-populated rows. `makeId()` helper generates fresh UUIDs at module load time.
6. **All 6 required AI commands verified** — arrangeInGrid ✅, createGrid ✅, spaceEvenly ✅, SWOT template ✅, User Journey template ✅, Retrospective template ✅.

**Frame/table title persistence fix (2026-02-20).** Frame and table titles had the same bug: setting the title to a small size (e.g. 2px fontSize) would jump back to a large size when moving. Root cause: when applying remote updates, we only synced `data` (title string, childIds/formSchema) and the group transform — we never synced the title IText child's `text` or `fontSize` from the revived payload. Fix in `boardSync.ts`: (1) Added `syncFrameOrTableTitleFromRevived(existing, revived)` — copies title IText's text and fontSize from revived to existing when applying remote for frames/tables. (2) In `text:editing:exited`, sync IText text to `data.title` for frame/table before `emitModify` so the payload has correct frameTitle/tableTitle.

**Table object polish complete (2026-02-20).** Two bugs fixed in `FrameFormOverlay.tsx`:

1. **Tables now fully movable** — Root cause: the overlay container had `pointer-events: auto`, which intercepted all `mousemove` events that Fabric.js needs to track drags (Fabric attaches `mousemove` to the canvas element, not the document, so events captured by a sibling overlay are lost). Fix: set `pointerEvents: 'none'` on the outer overlay `div` (removed `onMouseDown` stopPropagation too, which was no-op anyway since the canvas is a sibling). Interactive children re-enable pointer events explicitly: `<th>` (hover tracking), `<td>` (cell inputs), row delete buttons, and the footer buttons all have `pointerEvents: 'auto'`. The title bar was already `pointer-events: none`.

2. **Column type dropdown hides after selection / only shows on hover** — Added `hoveredColId: string | null` state to `FrameFormPanel`. The type `<select>` and delete `✕` button in each column header are only rendered when `hoveredColId === col.id`. `onMouseEnter`/`onMouseLeave` on the `<th>` control the state. The type label text (e.g. "Text", "Number") is also suppressed while hovering so the controls have room. This makes the header clean by default and only reveals controls on demand.

**Share modal member refresh (2026-02-20).** When adding a member via "Add to board" in the Share modal, the members list now refreshes immediately so the new member appears (instead of showing a success message but leaving the list stale). `ShareModal.tsx`: added `refreshMembers` helper; `handleAdd` calls it when `inviteToBoard` returns `result.added`.

**Frame Phase 2 complete (2026-02-20).** Three features shipped:
1. **Send-to-back auto-capture** — `sendToBack`/`sendBackward` fire `frame:captureBeforeSendBack` canvas event; boardSync listener auto-adds objects above the frame in z-order whose centers are inside frame bounds to `childIds`.
2. **Frame title zoom fix** — Titles hidden below 40% zoom (`HIDE_TITLE_ZOOM_THRESHOLD = 0.4`) via `updateFrameTitleVisibility` called from `notifyViewport` on every viewport change. Base fontSize reduced 14→12 in `frameFactory.ts`.
3. **Frame Forms → rearchitected as standalone Table objects** — Schema-driven HTML form overlay (`FrameFormOverlay.tsx`) positioned over `DataTable` canvas objects (`subtype: 'table'`). All field types (text, number, dropdown, checkbox, date). Full CRUD: add/rename/delete columns, add/delete rows, edit cells. Syncs via boardSync (`formSchema` in table.data). Real-time collaborative. Tables can be Frame children (move with frame). Overlay uses `pointer-events: none` on container + `auto` on interactive elements so the table remains draggable from any part of its surface.

**Ungroup bug fully fixed (2026-02-19).** Two-part root cause in Fabric.js v7:
1. **Position jump** — `canvas.remove(group)` does not call `group.remove(child)`, so `child.group` still pointed to the removed Group. `emitAdd` → `payloadWithSceneCoords` detected `child.group` and applied the group matrix a second time onto already-scene-space coords → wrong DB write → `applyRemote` snapped objects to wrong positions.
2. **Objects unselectable after deselect** — `child.parent` also still pointed to the removed Group. Fabric v7's `ActiveSelection.exitGroup` calls `object.parent._enterGroup(object, true)` when the initial post-ungroup ActiveSelection is discarded → child was shoved back into the removed Group, coordinates scrambled back to group-relative, `child.group` reset to removed Group → unselectable on next click.
- **Fix:** Clear both `childRaw.group = undefined` and `childRaw.parent = undefined` before `addTransformToObject` + `canvas.add` in both `ungroupSelected()` and the Cmd+Shift+G keyboard handler. `FabricCanvas.tsx` only.

**Previous:** Zoom-aware creation + font size control (2026-02-19). Three fixes:
1. **Font size control** — `FontControl` now shows a Size input (8–10 000) alongside font family. `getFontSizeFromObject`/`setFontSizeOnObject` in `fontUtils.ts`; `fontSize` field in `SelectionStrokeInfo`; `setActiveObjectFontSize` on `FabricCanvasZoomHandle`. Visible whenever text or sticky is selected.
2. **Sticker zoom scaling** — Stickers now use `fontSize: 96` (fixed) + `scaleX/scaleY = 1/zoom` instead of inflating `fontSize`. Emoji font metrics at huge sizes (96 000+) were producing oversized, offset selection boxes. Fixed: bounding box is always computed at `fontSize 96` (reliable), then scaled. `MAX_STICKER_SCALE = 100_000` covers full zoom range down to 0.001%.
3. **Text/sticky zoom creation** — Already compensated via `BASE_TEXT_FONT_SIZE / zoom` and `minSceneW = 120/zoom`. No code change needed; confirmed working.

**Previous:** Free draw + marquee fully fixed (2026-02-19). Three bugs resolved:
1. `perPixelTargetFind: true` on free draw paths — click-select now falls through to objects under a path's bounding box.
2. Marquee `intersectsWithRect` only triggers on edge-crossing (not full containment) — fixed with `|| isContainedWithinRect`.
3. Free draw path large bounding box hijacking small marquees — paths use `isContainedWithinRect` only.

**Previous:** Escape key released everything (2026-02-19). Pressing Esc now cancels any in-progress operation (marquee, shape draw, connector draw, free draw) and returns the toolbar to Select. `onToolChange` prop added to `FabricCanvas`; `WorkspacePage` passes `setSelectedTool`.

**Previous:** Duplicate + Copy & Paste implemented (2026-02-19). Cmd+D duplicates selected object(s) with +20 offset; connectors are floated. Cmd+C copies selection to in-memory clipboard; Cmd+V pastes at cursor (or viewport center). Toolbar buttons in contextual row.

**Current state:** TypeScript compiles clean, no linter errors. Edge Function deployed. Frames sync across collaborators.

**Remaining work:**
1. ~~**Fix OpenAI key**~~ ✅
2. ~~**`usePirateJokes` hook**~~ ✅
3. ~~**Presence icon avatars in workspace header**~~ ✅
4. ~~**Viewport persistence**~~ ✅
5. ~~**Frames**~~ ✅ — See Recent Changes below.
6. **Canvas features** — ~~Free draw~~ ✅, ~~Ungroup bug~~ ✅, ~~Lasso selection~~ ✅. See docs/PLANNED_CANVAS_FEATURES.md.
7. **Connector Phase 2** — port hover glow, double-click segment for waypoint, right-click context menu (Reset route, Reverse direction), auto-route.
8. ~~**Frame Phase 2**~~ ✅ — (a) Send-to-back auto-capture ✅, (b) Frame title zoom fix ✅, (c) Frame forms ✅. See Recent Changes above.

**Parrot mascot layout pattern:**
- `ParrotMascot` is `position: fixed, right: 20, top: 58`. Flex column, parrot on top, bubble below.
- Speech bubble has `maxWidth: 220`, drops below parrot with up-pointing triangle.
- BoardListPage toolbar + grid both use `paddingRight: 245` to reserve space for parrot+bubble zone (parrot 90px + margin 20px + bubble 220px + buffer = ~245px).
- `pickGreeting()` picks randomly from `PARROT_GREETINGS[]` on mount and on 🦜 click.

**MeBoard branding** ✅ — Phase 1 + Phase 2 + Parrot mascot done. Login, nav, footer, index.html, App loading, pirate cursor icons, map border overlay + toggle, Pirate Plunder stickers, Parrot mascot. Spec: docs/MeBoard_BRANDING_SPEC.md.

**Planned canvas features** — See docs/PLANNED_CANVAS_FEATURES.md: Object grouping (Group ✅, Ungroup ✅), ~~Free draw~~ ✅, ~~Lasso selection~~ ✅, Multi-scale map vision. **Finished-product:** Connectors ✅, Frames ✅, Duplicate ✅, Copy & Paste ✅, ~~Marquee mode~~ ✅ (Alt+drag).

## Recent Changes (2026-02-19 — AI Template Redesign)

### AI Template Redesign
- **templateRegistry.ts** — 4 client-side template specs (pros-cons, swot, user-journey, retrospective). Pure data, no I/O. Frame dimensions + child objects as `relLeft`/`relTop` offsets.
- **executeAiCommands.ts** — `applyTemplate` branch: looks up spec from `TEMPLATE_REGISTRY`, creates frame first at viewport center (`getViewportCenter?.() ?? {x:400,y:300}`), creates children sequentially at `frameLeft + relLeft`. `getViewportCenter` added to `ExecuteAiOptions`.
- **FabricCanvas.tsx** — `getViewportCenter()` added to `FabricCanvasZoomHandle`. Implemented in `useImperativeHandle` using `(width/2 - vpt[4]) / zoom`.
- **AiPromptBar.tsx** — `getViewportCenter` prop; passed to `executeAiCommands` + `invokeAiInterpret`.
- **WorkspacePage.tsx** — passes `getViewportCenter` from `canvasZoomRef`.
- **ai-interpret/index.ts** — System prompt simplified (~40 lines vs ~80): template detection returns `applyTemplate` command only; viewport center injected into freeform user messages; `viewportCenter` extracted from request body.
- Templates are frame-first, viewport-centered, defined entirely in TypeScript (no Edge Function redeploy needed to change layouts).
- **ai-interpret Edge Function** redeployed 2026-02-19.

### Critical z-index bug fix (boardSync.ts)
- **Root cause:** `emitAdd` and `emitModify` called `obj.toObject(['data', 'objects'])` which does NOT include the custom `zIndex` property in Fabric.js serialization. For frames created with `setObjectZIndex(frame, 1)`, `payload.zIndex` came back `undefined`, causing the fallback `Date.now()` to overwrite the frame's z=1 with a massive timestamp — putting the frame visually ON TOP of all children.
- **Fix:** Added `'zIndex'` to the toObject extra-keys array in both `emitAdd` and `emitModify`. Now pre-set z-indexes (including frame z=1) are serialized and preserved. New objects without a pre-set zIndex still get `Date.now()` as before.

### Pros & Cons template redesign
- Removed opaque rect backgrounds (were hiding stickies visually even when z-order was correct).
- Replaced with clean 2-column layout: header stickies (green "Pros ✓" / red "Cons ✗") + 3 blank stickies per column. Matches Retrospective pattern.

## Recent Changes (2026-02-19 — Lasso Selection)

### Lasso Selection
- **Tool:** Lasso button in toolbar (next to Hand). Draw freeform path to select objects inside the path.
- DOM capture (like marquee) so lasso works when starting on objects. mousedown → transient Polyline preview; mousemove → append points; mouseup → Fabric `Intersection.isPointInPolygon` on object centers, set ActiveSelection. Requires 3+ points. Escape cancels.
- Files: FabricCanvas.tsx (lassoState, onLassoMouseMove/Up, onCaptureMouseDown), tools.ts, WorkspaceToolbar.tsx.

## Recent Changes (2026-02-19 — Duplicate, Copy & Paste)

### Duplicate
- **Shortcut:** Cmd/Ctrl+D. **Toolbar:** Duplicate button in contextual row (when selection exists).
- Fabric `clone()` (async) per object; new UUIDs via `setObjectId`; +20,+20 offset. Connectors: `floatConnectorBothEndpoints` disconnects from source/target and offsets float points.
- History: `pushCompound` with add actions per duplicated object.
- Files: FabricCanvas.tsx (duplicateSelected imperative handle), WorkspaceToolbar.tsx (Duplicate button).

### Copy & Paste
- **Copy:** Cmd/Ctrl+C. Serializes selection via `toObject(['data','objects'])` into `clipboardStore.ts` (in-memory, session-only).
- **Paste:** Cmd/Ctrl+V. Revives via `util.enlivenObjects`; assigns new IDs; positions at `lastScenePointRef` (cursor) or viewport center. Connectors floated.
- Paste positions first object at paste point; others keep relative arrangement.
- Files: clipboardStore.ts (new), FabricCanvas.tsx (copySelected, paste, lastScenePointRef), WorkspaceToolbar.tsx (Copy, Paste buttons).

## Recent Changes (2026-02-19 — Frames)

### Frame Architecture
Frames are **visual containers** (Fabric Group: bg Rect + title IText) whose associated canvas objects are tracked by `data.childIds: string[]`. Unlike Fabric Group containers, children are independent canvas objects — fully selectable, moveable, and editable at all times.

**Key design decisions:**
- `data.subtype = 'frame'` discriminates from sticky (`subtype` absent) and container groups.
- Children stored in `data.childIds` (not as Fabric Group children). Moving the frame propagates delta to children via `boardSync.ts` `object:moving` handler.
- Frames auto-send-to-back on creation (`zIndex: 1`); `sortCanvasByZIndex` keeps them behind children.
- Frame bg fill is always a valid hex (`#f1f5f9`) — rgba broke the color picker.
- Preview frames during drag use `assignId: false` so `emitAdd` skips them (no spurious DB writes).

### New Files
- `src/features/workspace/lib/frameFactory.ts` — `createFrameShape(left, top, w, h, title, assignId)`. Returns Fabric Group [bg Rect, title IText].
- `src/features/workspace/lib/frameUtils.ts` — `isFrame`, `getFrameData`, `getFrameChildIds`, `setFrameChildIds`, `setFrameTitle`.

### Changes to Existing Files
- **`types/tools.ts`** — Added `'frame'` to `ToolType` and `SHAPE_TOOLS`.
- **`boardSync.ts`** — Imports `isFrame`, `getFrameChildIds`, `setFrameChildIds`. `getObjectsToSync` includes frame children (for delta broadcast + DB write on drop). `object:moving` propagates delta to children. `object:added` / `object:modified` call `checkAndUpdateFrameMembership` (auto-capture objects inside frame bounds). `emitAdd` / `emitModify` serialize `subtype:'frame'`, `frameTitle`, `childIds`. `applyRemote` restores frame data; skips `updateStickyTextFontSize` for frames. `mouse:down` tracks frame prev-pos for delta.
- **`FabricCanvas.tsx`** — Frame tool drawing in mouseDown/mouseMove/mouseUp (uses `createFrameShape`). `createFrame` imperative handle. `isFrameGroup` check in `notifySelectionChange` prevents frames being misidentified as sticky notes. Frame selection shows Layers controls.
- **`WorkspaceToolbar.tsx`** — Frame icon (▭ with title bar line). "Containers" section in insert menu. Frame in `INSERT_TOOLS` and `TOOLS` arrays.
- **`executeAiCommands.ts`** — Tracks `trackedBounds` per created object. `createFrame` command computes bounding box from tracked bounds + padding and calls `options.createFrame(...)`. `ExecuteAiOptions` interface exported.
- **`aiInterpretApi.ts`** — Added `{ action: 'createFrame'; title?: string }` to `AiCommand` union.
- **`AiPromptBar.tsx`** — Accepts `createFrame` prop; passes it as `options.createFrame` to `executeAiCommands`.
- **`WorkspacePage.tsx`** — Passes `createFrame={(params) => canvasZoomRef.current?.createFrame(params)}` to `AiPromptBar`.
- **`fabricCanvasZOrder.ts`** — Fixed `getTargetObjects`: checks `type === 'activeselection'` (not `'getObjects' in active`) so z-order buttons work on single Group objects (stickies, frames) instead of silently no-op-ing.
- **`supabase/functions/ai-interpret/index.ts`** — System prompt updated: all 4 templates end with `{ "action": "createFrame", "title": "..." }` instead of `groupCreated`. Re-deployed.

### What Was Fixed (2026-02-17)
1. **Locking never enabled** — Effect ran before auth loaded; `userId`/`userName` were empty. Added `userId`/`userName` to effect deps so sync re-ran when auth ready.
2. **Document sync torn down on auth change** — Adding auth to deps caused full effect teardown (canvas + documents + locks) whenever auth changed. Document subscription was removed, so position updates stopped.
3. **Fix: Split sync into two effects:**
   - **Effect 1** `[width, height, boardId]` — Canvas + document sync only. Never torn down when auth changes. Keeps receiving position updates.
   - **Effect 2** `[boardId, userId, userName]` — Lock sync only. Tear down/recreate only when auth changes. Document sync persists.

### Code Changes
- **boardSync.ts:** Extracted `setupDocumentSync()` and `setupLockSync()`. `applyLockStateCallbackRef` lets document sync re-apply lock state after remote position updates. `setupBoardSync()` composes both.
- **FabricCanvas.tsx:** Two effects — document sync (deps: width, height, boardId); lock sync (deps: boardId, userId, userName).

## ⚠️ Look at Soon

1. **Grid pattern disappeared** — The tldraw-style 20px grid overlay (GridOverlay.tsx) appears to have gone missing. Was working (FabricCanvas transparent background, GridOverlay behind canvas, transforms with viewport). Needs investigation: check that GridOverlay is still rendered in WorkspacePage, that `showGrid` state is wired correctly, and that the canvas background is still transparent.

2. **Parchment/map border around the canvas** — Need to wrap the canvas workspace in a parchment/treasure-map aesthetic treatment. The `MapBorderOverlay.tsx` exists (4 sepia gradient strips + compass corners, zoom-aware opacity, 🗺️ toggle in toolbar) but the intent is to give the *entire* canvas area — not just the border strips — a parchment texture feel (aged paper background, worn edges, possibly a vignette). Think tldraw-style infinite canvas but with a pirate map skin. This is a significant visual polish item tied to the MeBoard branding.

## Next Steps

1. **Zoom/pan** — Hand tool ✅, shortcuts (+/-, 0 fit, 1 100%) ✅, zoom UI dropdown ✅, **zoom slider** ✅ (log scale 25%–400%), trackpad two-finger pan + pinch zoom ✅ (FabricCanvas handleWheel; pinch sensitivity 0.006).
2. **Canvas grid** — tldraw-style grid overlay ✅ (20px cells, transforms with viewport). GridOverlay.tsx; FabricCanvas transparent background; GridOverlay behind canvas.
3. **Cursor position readout** — tldraw-style ✅ (bottom-left, x/y scene coords). CursorPositionReadout.tsx; onPointerMove always fired for readout (and presence when user).
4. ~~**Shape tool vs selection**~~ ✅ — With shape tool active, pointer-down always starts drawing (discardActiveObject + draw); never selects.
5. ~~**Board loading performance**~~ ✅ — Paginated fetch in documentsApi (50 per batch, order by object_id).
6. ~~**Stroke width (border thickness)**~~ ✅ — PRD §4. strokeUtils (getStrokeWidthFromObject, setStrokeWidthOnObject), StrokeControl in toolbar when selection has stroke (1/2/4/8px). Sync uses Fabric strokeWidth in payload. FabricCanvas: onSelectionChange, setActiveObjectStrokeWidth on ref.

## Recent Changes (2026-02-19 — Board list features + drawing fixes)

### Board List Page — new features
- **Search** — real-time client-side filter on board title. Input in toolbar top row.
- **Sort** — Recent (default, by `last_accessed_at`), Name (alpha), Count (by object count). Pill-style toggle group.
- **Tabs** — My Boards / Public / All. `activeTab` state; "Public" fetches `fetchPublicBoards()`; "All" unions user boards + public boards (deduped by ID).
- **Pagination** — 20 per page, Prev/Next controls. Resets to page 0 on tab/search/sort change.
- **Public boards** — `is_public BOOLEAN NOT NULL DEFAULT false` on `boards`. `updateBoardVisibility` calls `update_board_visibility` RPC (owner-only enforcement server-side). Toggle in kebab menu (owner only) and Share modal (owner only, shows current visibility label + description).
- **🌐 Public badge** on board cards for public boards.
- **Object count** on board cards ("3 objects"). Backed by `get_user_boards_with_counts` RPC (joins `documents`).
- **Kebab menu** — Rename, Make public/private, Delete only shown to `board.ownerId === userId`. All users see Copy share link.
- **Board thumbnails** — `thumbnail_url TEXT` on `boards`. Storage bucket `board-thumbnails` (public). On Back button click in workspace, `captureDataUrl()` → `saveBoardThumbnail()` (resize to 400×280 JPEG, upload via Storage, update boards row). Cards show 130px image zone; placeholder gradient if no thumbnail. `FabricCanvasZoomHandle.captureDataUrl()` zooms to fit then calls `canvas.toDataURL()`.
- **Capture timing fix** — capture in `handleBack` (canvas still alive) + `beforeunload`, NOT in unmount effect (children dispose canvas before parent cleanup runs).

### Member management (Share modal)
- `profiles` table (`user_id, display_name, email`) + trigger on `auth.users` insert. Backfill migration for existing users.
- `get_board_members(boardId)` RPC returns members with display name, email, is_owner, joined_at.
- `remove_board_member(boardId, userId)` RPC — owner-only, deletes from board_members + user_boards.
- Share modal now loads + shows member list with Owner badge. Board owner sees × remove buttons. Scrollable list (max 160px).

### RLS fixes (migration 20260219000000–000007)
- `boards_select`: added `OR auth.uid() = owner_id` so INSERT+RETURNING works before board_members is created. Without this, `createBoard` got 403.
- `documents_all`, `locks_select/insert`, `presence_select/insert`: extended to allow access when `boards.is_public = true`.
- `board_members_insert`: allows self-join to public boards.
- Storage policies for `board-thumbnails`: authenticated INSERT/UPDATE, public SELECT.

### Drawing tool fix (FabricCanvas.tsx)
**Universal rule for all drawing tools (sticker, text, sticky, rect, circle, triangle, line, connector):**
- Click on resize/rotate **handle** of the ACTIVE object (`_currentTransform?.corner` is set) → let Fabric handle (resize/rotate)
- Click on **body** of any object (active or not), or empty space → always create new object

Previously: `if (target) return` blocked drawing on top of any existing object. Now only handle-clicks are blocked. All tools use the same `isOnHandle` check. Sticker remains click-to-place (no drag), shapes drag-to-draw; guard logic is identical.

## Recent Changes (2026-02-19 — Presence icons + stale fix)

**Presence icon avatars (`WorkspacePage.tsx`, `CursorOverlay.tsx`, `FabricCanvas.tsx`):**
- ✅ `getPirateIcon(userId)` exported from `CursorOverlay.tsx` (was private).
- ✅ `panToScene(sceneX, sceneY)` added to `FabricCanvasZoomHandle` interface + `useImperativeHandle`: sets `vpt[4] = width/2 - sceneX*zoom`, `vpt[5] = height/2 - sceneY*zoom`, re-renders, notifies viewport.
- ✅ `WorkspacePage` header presence replaced: `presenceCluster` div (flex row, `marginLeft: auto`); up to 4 emoji icon buttons (28px circle, `title` = name); "+N" overflow badge; `presenceHovered` state (`onMouseEnter`/`onMouseLeave`) shows count text. Click → `canvasZoomRef.current?.panToScene(o.x, o.y)`.

**Presence stale cleanup fix (`usePresence.ts`):**
- ✅ Stale timer (1s interval) now **resets `lastActive` to 0** on idle entries instead of removing them. `lastActive: 0` = stub state: canvas cursor hidden (`CursorOverlay` already skips these), but user stays in `others` → header icon persists while connected. Presence `leave` (tab close / disconnect) still removes entries entirely. Crash fallback still works: entry stays at stub until Supabase Presence heartbeat fires `leave` (~30–60s).

## Recent Changes (2026-02-19 — Parrot mascot)

**Parrot mascot (`ParrotMascot.tsx`):**
- ✅ New component at `src/features/boards/components/ParrotMascot.tsx`
- Flat SVG parrot: green body + belly, orange cheek, crest feathers, hooked beak, tail feathers, claws on branch. viewBox 0 0 90 153.
- CSS `parrot-bob` keyframe: 3s ease-in-out float, speeds up to 0.8s on hover.
- Props: `message`, `onDismiss`, `onNewMessage`.
- Speech bubble drops below parrot (flex column), up-pointing gold triangle pointer (right: 28).
- 🦜 button = cycle to new joke; ✕ = dismiss.
- Added to `BoardListPage` — `position: fixed, right: 20, top: 58`.
- `PARROT_GREETINGS` array (8 items) + `pickGreeting()` in BoardListPage.
- `showParrot` + `parrotMsg` state; `parrotMsg` initialised via `useState(pickGreeting)`.
- BoardListPage header: "CollabBoard" → "⚓ MeBoard".
- `toolbar` and `grid` styles: `paddingRight: 245` — keeps all buttons + cards clear of parrot+bubble zone.
- ~~**Next:** replace static greetings with `usePirateJokes` hook~~ ✅ Done. `pirate-jokes` Edge Function + `usePirateJokes` hook wired in. First-time welcome message shown when `!localStorage.getItem('meboard:welcomed:'+userId)` and `boards.length === 0`; key set after showing. Subsequent visits get AI-generated jokes from cache or Edge Function.

## Recent Changes (2026-02-19 — Other)

**Shape flip/mirror fix:**
- ✅ **Fabric default + normalize only on object:modified** — Removed custom flip-aware control handlers. Use Fabric's default scaling during drag. At `object:modified`, `normalizeScaleFlips` converts negative scale → positive + flipX/flipY. `applyRemote` now skips when `existing === active` (single selection) so our own postgres_changes echo doesn't overwrite the in-progress transform. boardSync.ts, FabricCanvas.tsx, fabricCanvasScaleFlips.ts (simplified to only `normalizeScaleFlips`).

**Zoom slider max alignment fix:**
- ✅ `ZOOM_SLIDER_MAX` was `100` (10000%) but `MAX_ZOOM` in `fabricCanvasZoom.ts` is `10` (1000%). At max zoom (1000%), the slider was only ~86% across instead of fully right. Fixed by setting `ZOOM_SLIDER_MAX = 10` in WorkspaceToolbar.tsx.



**LangSmith AI observability:**
- ✅ **ai-interpret** Edge Function uses OpenAI SDK + `wrapOpenAI` for tracing. All LLM calls (inputs, outputs, tokens, latency, errors) visible at smith.langchain.com.
- Secrets: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`. Documented in SUPABASE_SETUP.md, AI_CLIENT_API.md.

**In-app AI call visibility (2026-02-20):**
- ✅ **ai-interpret Edge Function** now logs each request (`[ai-interpret] request` with boardId, userId, promptPreview) and token usage (`[ai-interpret] usage`) to Supabase Edge Function logs (Dashboard → Edge Functions → ai-interpret → Logs). Also returns `usage: { prompt_tokens, completion_tokens, total_tokens }` in the response body.
- ✅ **aiInterpretApi.ts** — `AiInterpretResponse` now includes `source: 'local' | 'template' | 'api'` and `usage?: AiUsage`. Three tiers: (1) `detectSimpleShape()` for "draw a blue circle at 100, 100" patterns — instant, zero network; (2) `detectTemplateLocally()` for known template names — instant, zero network; (3) Edge Function + OpenAI for everything else.
- ✅ **ai-interpret Edge Function** — `max_tokens` reduced 1024→300. System prompt split into `SYSTEM_PROMPT_CORE` (~750 tok) + `FORM_ADDENDUM` (~350 tok, appended only when prompt mentions "form"/"field"/"input"/"checkout"). Saves ~0.5s TTFT for non-form requests.
- ✅ **AiPromptBar.tsx** — Modal stays open after a successful run and shows a result chip: blue "⚡ Generated locally — no API call" for simple shapes; gray "📋 Template applied — no API call" for templates; green "✦ AI · N tokens (X in / Y out)" for real API calls.

**Cursor lag fix — Broadcast + CSS interpolation:**
- ✅ **Root cause 1:** Cursor positions were going through postgres_changes → Presence API → now through Supabase **Broadcast** (same zero-DB path as object move-deltas). Channel `cursor:${boardId}` uses `channel.send({ type:'broadcast', event:'cursor' })` for positions and `channel.track({ userId, name, color })` (Presence) for join/leave only.
- ✅ **Root cause 2:** Debounce only sent after user stopped moving. Switched to **33ms throttle** so positions stream continuously during movement.
- ✅ **Root cause 3:** Cursor divs used `left/top` style props (layout reflow per update). Switched to `transform: translate(x,y)` (GPU compositing) + `transition: transform 80ms linear` (interpolation bridges the network gap visually — cursor glides rather than jumps).
- ✅ **Stale cleanup:** `usePresence` 1s interval purges cursors not seen in 3s. Handles disconnect without Presence `leave`.
- Files changed: `presenceApi.ts`, `usePresence.ts`, `CursorOverlay.tsx`, `usePresence.test.ts`.

## Recent Changes (2026-02-18)

**FabricCanvas refactor (successful):**
- FabricCanvas.tsx was 1013 LOC (over hard max 1000). Extracted four modules to restore compliance with project rules:
  - `lib/fabricCanvasZOrder.ts` (102 LOC) — bringToFront, sendToBack, bringForward, sendBackward
  - `lib/fabricCanvasZoom.ts` (93 LOC) — createZoomHandlers (applyZoom, zoomToFit, handleWheel); MIN_ZOOM, MAX_ZOOM, ZOOM_STEP
  - `lib/fabricCanvasHistoryHandlers.ts` (88 LOC) — createHistoryEventHandlers factory
  - `lib/drawCanvasGrid.ts` (40 LOC) — tldraw-style 20px grid
- FabricCanvas.tsx now 777 LOC (under 1000 hard max). All 29 tests pass.
- App.test.tsx fixed: heading matcher updated to `/meboard/i` with `level: 1` (MeBoard rebrand; "Why MeBoard?" h2 also matched before).

**Canvas UX polish:**
- ✅ **Grid overlay** — tldraw-style grid (20px cells). GridOverlay.tsx behind FabricCanvas. Canvas background transparent; grid provides #fafafa + SVG pattern. Transform syncs with viewport.
- ✅ **Cursor position readout** — Bottom-left x/y in scene coords. CursorPositionReadout.tsx. onPointerMove fires always (not just when logged in); used for readout + presence.
- ✅ **Zoom slider** — Range input 25%–400%, log scale (zoomToSliderValue, sliderValueToZoom). WorkspaceToolbar. In addition to dropdown.

## Recent Changes (2026-02-17)

**Trackpad pan/zoom:**
- ✅ **Two-finger scroll = pan, pinch = zoom** — FabricCanvas handleWheel: plain wheel → relativePan(-deltaX, -deltaY); ctrlKey (pinch) → zoom at cursor. Pinch sensitivity 0.006 (deltaY multiplier). Works on trackpad; mouse wheel still zooms, Hand/Space+drag unchanged.

**Sticky notes:**
- ✅ **No placeholder text** — Sticky is [bg, mainText] only; mainText starts empty. Removed "Double-click to edit" and placeholder IText.
- ✅ **Auto-enter edit on create** — When user finishes drawing a sticky (mouse up), edit mode opens after 50ms so blinking cursor appears and user can type immediately. tryEnterTextEditing(mainText) with hiddenTextarea?.focus().

**Stroke width + toolbar aesthetic:**
- ✅ **Stroke width** — Select any stroke-bearing object; "Stroke" dropdown appears in toolbar (1/2/4/8px). strokeUtils.ts (getStrokeWidthFromObject, setStrokeWidthOnObject), StrokeControl.tsx, FabricCanvas onSelectionChange + setActiveObjectStrokeWidth; sync via object:modified.
- ✅ **Toolbar redesign** — Icon-based tool groups (Select|Hand | Rect|Circle|Triangle|Line | Text|Sticky), dividers, zoom dropdown right; tldraw-like flat style (32px icon buttons, subtle active state).
- ✅ **Header** — WorkspacePage header aligned: same border/shadow, 32px buttons, #e5e7eb borders, #374151 text.

## Earlier Recent Changes (2026-02-17)

**Zoom (MVP):**
- ✅ Very wide zoom range: MIN_ZOOM = 0.00001 (0.001%), MAX_ZOOM = 100 (10000%). Figma-like infinite-canvas zoom. FabricCanvas.tsx.

**Multi-selection move sync (coordinates fix):**
- ✅ Objects in ActiveSelection have relative left/top/angle/scale; we were syncing those so other clients saw wrong position (disappear during move, wrong place on drop). boardSync now uses payloadWithSceneCoords(obj, payload): when obj.group exists, override payload with util.qrDecompose(obj.calcTransformMatrix()) so left/top/angle/scaleX/scaleY/skew are scene (absolute) coordinates. Used in emitAdd and emitModify.

**Multi-selection move sync:**
- ✅ boardSync: getObjectsToSync(target) returns [target] if id, else getObjects() for ActiveSelection; emitModifyThrottled uses pendingMoveIds (Set); object:modified syncs each object in selection. Moving circle + triangle together now syncs to other devices.

**Presence awareness:**
- ✅ Header shows names list: "X others viewing — Alice, Bob" (WorkspacePage); tooltip with full list; ellipsis for long lists. Working as wanted (not perfect).

**Locking + Document Sync Fix:**
- ✅ Split FabricCanvas effect: document sync vs lock sync
- ✅ Document sync deps `[width, height, boardId]` — never tears down on auth
- ✅ Lock sync deps `[boardId, userId, userName]` — adds locking when auth ready
- ✅ boardSync: setupDocumentSync, setupLockSync, applyLockStateCallbackRef
- ✅ Locking works: User1 selects → User2 cannot grab; position updates sync live

**Earlier 2026-02-17 — Locking fixes:**
- ✅ evented: false on locked objects
- ✅ Optimistic locking, broadcast for instant propagation
- ✅ Reapply lock state after remote position updates
- ✅ setCoords() after position updates (ghost click zone)

## Next Steps (Recode Order)

1. ~~Dependencies~~ ✅
2. ~~Fabric canvas wrapper~~ ✅
3. ~~Shapes + toolbar~~ ✅
4. ~~Viewport culling~~ ✅
5. ~~Delta sync~~ ✅
6. ~~Presence & cursors~~ ✅
7. **Locking** ✅ — Fully working (split effect, document sync persists)
8. ~~Board sharing~~ ✅
9. ~~Selection~~ ✅
10. ~~Tests~~ ✅
11. ~~**Google Auth**~~ ✅ — Complete (user can log in with Google)
12. ~~**Presence awareness — "Who's on board"**~~ ✅ — Names list in header ("X others viewing — Alice, Bob"); working as wanted (not perfect).
13. ~~**Multi-selection move sync**~~ ✅ — boardSync getObjectsToSync + pendingMoveIds; object:modified syncs each in selection.
14. **Zoom/pan** — Very wide zoom ✅, Hand tool ✅, shortcuts (+/-, 0, 1) ✅, zoom UI ✅, trackpad two-finger pan + pinch zoom ✅ (handleWheel: ctrlKey = zoom, else pan; pinch 0.006).
15. ~~**Shape tool: no selection when drawing**~~ ✅ — FabricCanvas: shape tool always draws, discardActiveObject on pointer down.
16. ~~**Board loading performance**~~ ✅ — documentsApi fetchInitial paginated (PAGE_SIZE 50).

## Multi-selection move sync v2 — FIXED (2026-02-18)

**Goal:** All items end up in the right spot when moving a selection; other clients see moves with minimal lag.

**Status: Working.** Root cause was originX/originY vs calcTransformMatrix center mismatch. All shapes use `originX:'left', originY:'top'` but `calcTransformMatrix()` returns the object center. Writing center coords as left/top shifted objects by width/2 and height/2 on every apply. **Three fixes in boardSync.ts:** (1) `payloadWithSceneCoords` uses `util.addTransformToObject` + save/restore for correct origin conversion; (2) move-delta receiver uses `obj.left + dx` directly; (3) `applyRemote` skips objects in active selection to prevent sender echo corruption.

**Design (documented in PRD § Sync Strategy):** During drag broadcast `{ objectIds, dx, dy }`; on drop write absolute to documents. Single-object and Fabric Group (sticky) moves unchanged.

## Z-order nudge — DONE

**bringForward/sendBackward** — One step in z-order implemented in FabricCanvas + toolbar buttons. PRD §4 Object Capabilities.

## Planned: AI Client API (Post-MVP)

**Goal:** All app actions (create objects, update props, delete, query) should be doable via a client-side API so AI (Cursor, Claude, in-app agent) can perform the same operations as the UI.

**Scope:** createObject, updateObject, deleteObjects, queryObjects. UI and AI share this API. See docs/AI_CLIENT_API.md.

**Effort estimate:** ~1–2 days (client-only); ~2–3 days with server Edge Function + query.

## Active Decisions
- PRD v5.0: Fabric.js for licensing; viewport culling for perf; AI + Undo post-MVP
- MVP gate: auth → canvas → objects → sync → cursors → locking ✅

## Considerations
- **FabricCanvas effect split:** Document sync in Effect 1 (deps: width, height, boardId). Lock sync in Effect 2 (deps: boardId, userId, userName). Prevents document subscription teardown when auth loads.
- **boardSync:** setupDocumentSync + setupLockSync; applyLockStateCallbackRef for re-applying locks after remote updates.
- **Multi-selection move:** ✅ Fixed. Broadcast deltas during drag, absolute on drop. Origin-vs-center bug resolved (payloadWithSceneCoords uses addTransformToObject; move-delta receiver uses obj.left+dx; applyRemote skips active selection echo).
- **Z-order:** bringToFront/sendToBack implemented; bringForward/sendBackward (one step) done. PRD §4.
- **Boards page:** Grid of cards, last_accessed_at order. user_boards.last_accessed_at; joinBoard upserts it. Grid: gridAutoRows 130, columnGap 16, rowGap 20. Migration 20260218100000_user_boards_last_accessed.sql. Kebab menu: copy link, rename, delete. Replaces prior list layout (BoardListPage (list of user’s boards). Figma-inspired scope in memory-bank/boards-page-cleanup.md (layout, Workspace consistency, loading/empty, copy link, delete, rename, sort).
