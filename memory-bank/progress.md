# Progress

## What Changed

- **Stack (v6.0):** Firebase → Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Canvas (v5.0):** tldraw → Fabric.js (BSD license)
- **Rationale:** tldraw v4+ requires trial/hobby/commercial license for deployed apps
- **Trade-off:** More custom sync/presence code; mitigated by viewport culling + delta-only strategy
- **Post-MVP:** AI agent, Undo/Redo (explicitly deferred)
- **PRD polish:** Why Fabric note, culling implementation details, presence schema, Fabric-specific tests

## What Works

- **Project scaffolding** — Vite + React + TypeScript, Supabase SDK, ESLint/Prettier/Husky, Jest + RTL
- Feature-sliced structure: `features/{auth,boards,workspace,ai}`, `shared/{lib/supabase,config}`
- Supabase config, `.env.example`, `supabase/migrations/`
- **Authentication** — Supabase Auth (Google + Email), LoginPage, useAuth, BoardListPage
- **Board list & CRUD** — createBoard, useUserBoards, BoardListPage, WorkspacePage
- **Deployment** — Vercel, vercel.json (COOP header), auth debounce
- **Workspace** — Fabric.js canvas (FabricCanvas) with pan/zoom; zoom range 0.001%–10000% (MVP); **grid overlay** (20px tldraw-style); **cursor position readout** (bottom-left x/y); **zoom slider** (25%–400%, log scale) + dropdown; **inline board title edit** (click header title to rename)
- **Sticky notes** — Start empty (no placeholder). On create, edit mode opens automatically (blinking cursor, ready to type). Text scales with sticky size. Double-click existing sticky to edit.
- **Sync** — Live document sync; real-time position updates (object:moving/scaling/rotating, 80ms throttle)
- **Presence & cursors** — Low-latency via Broadcast (same path as object moves); CSS transform + 80ms transition for smooth interpolation
- **Locking** — Fully working: acquire on selection, release on deselection; objects locked by others are non-selectable; position updates sync while locking active

## What's Left to Build

### MVP (Priority Order)
1. ~~Project scaffolding~~ ✅
2. ~~Authentication~~ ✅
3. ~~Board list & CRUD~~ ✅
4. ~~Workspace~~ ✅
5. ~~Shapes + toolbar~~ ✅
6. ~~Viewport culling~~ ✅
7. ~~Sync~~ ✅
8. ~~Presence & cursors~~ ✅
9. ~~Locking~~ ✅
10. ~~Board sharing~~ ✅
11. ~~**Google Auth**~~ ✅ — Complete (user can log in with Google)
12. ~~**Presence awareness — "Who's on board"**~~ ✅ — Names in header ("X others viewing — Alice, Bob"); working as wanted.
13. ~~**Multi-selection move sync**~~ ✅ — boardSync syncs each object in selection (getObjectsToSync + pendingMoveIds).
14. ~~Selection~~ ✅
13. ~~AI Agent~~ — Post-MVP
14. ~~Deployment~~ ✅

- ~~**zIndex layering (MVP §4)**~~ ✅ — Bring to front / send to back. boardSync: getObjectZIndex/setObjectZIndex, sortCanvasByZIndex; zIndex in emitAdd/emitModify/applyRemote; FabricCanvas bringToFront/sendToBack; toolbar layer buttons when selection.

### Workspace UX
- ~~**Inline board rename**~~ ✅ — Click board title in workspace header (e.g. "Untitled Board") to edit inline. Blur or Enter saves; Escape cancels. WorkspacePage: titleEditing state, updateBoardTitle, onBoardTitleChange callback. BoardPage wires callback to setBoard.
- ~~**Presence icon avatars in header**~~ ✅ — Replaced text "X others viewing — Alice, Bob" with up to 4 circular pirate emoji icon buttons (+N overflow). Hover tooltip = name. Click = `panToScene()` jump to cursor. Count text on cluster hover only. `getPirateIcon` exported from `CursorOverlay.tsx`. `panToScene(sceneX, sceneY)` added to `FabricCanvasZoomHandle`.
- ~~**Presence stale cleanup fix**~~ ✅ — `usePresence.ts` stale timer now resets `lastActive → 0` (stub, hides canvas cursor) instead of removing entries. Icons in header persist while user is connected; removed only on Presence `leave` (real disconnect). `CursorOverlay` already skips `lastActive === 0` for cursor rendering.
- ~~**Viewport persistence**~~ ✅ — viewportPersistence.ts (meboard:viewport:{boardId}); debounced save (400ms) on pan/zoom; restore on FabricCanvas mount; Reset view in zoom dropdown.

### Post-MVP
- ~~**AI agent**~~ ✅ — ai-interpret Edge Function (OpenAI gpt-4o-mini), AiPromptBar, invokeAiInterpret + executeAiCommands. Natural language → createObject/updateObject/deleteObjects via aiClientApi. OPENAI_API_KEY secret. Deploy: `supabase functions deploy ai-interpret --no-verify-jwt`. OpenAI key permissions fixed (model.request scope confirmed working).
  - ✅ **AI observability** — LangSmith traces via `wrapOpenAI` (inputs, outputs, tokens, latency). Secrets: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING_BACKGROUND=false`, `LANGSMITH_PROJECT=meboard`. Edge Function also logs `[ai-interpret] request` + `[ai-interpret] usage` to Supabase Edge Function logs. Usage + source returned to client.
  - ✅ **AI performance** — Three-tier client-side bypass: (1) `detectSimpleShape()` handles "draw a blue circle at 100, 100" patterns instantly (zero network); (2) `detectTemplateLocally()` handles known templates instantly; (3) Edge Function for everything else. Edge Function: `max_tokens` 300, system prompt split into core (~750 tok) + form addendum (~350 tok, appended only when prompt mentions form/field/input/checkout/wizard).
  - ✅ **AI result chip** in AiPromptBar: blue "⚡ Generated locally — no API call" / gray "📋 Template applied — no API call" / green "✦ AI · N tokens (X in / Y out)". Modal stays open after run.
- Undo/Redo
- **MeBoard branding** — Phase 1 ✅ done (safe parallel items); Phase 2 deferred until Undo/Redo merges. Spec: docs/MeBoard_BRANDING_SPEC.md.
  - ✅ LoginPage rebrand — hero copy ("MeBoard", "Ahoy Captain"), parchment card, gold Google button ("Join the Crew with Google"), "Enter the Ship" submit, "New to the crew?" toggle, "Why MeBoard?" section, testimonial, CTA
  - ✅ NavBar + Footer — `src/shared/components/NavBar.tsx` + `Footer.tsx`; rendered in LoginPage
  - ✅ index.html — "MeBoard – Pirate-Themed Collaborative Whiteboard"; OG tags; anchor emoji favicon
  - ✅ App.tsx loading — "Hoisting the sails…" with ⚓ icon on navy gradient
  - ✅ Pirate cursor icons — CursorOverlay: emoji icon only (⚓🦜🧭☠️🔱) hash-assigned per userId; color dot removed
  - ✅ Map border overlay + toggle — `MapBorderOverlay.tsx` (4 sepia gradient strips, zoom-aware opacity, compass corners); 🗺️ toggle in toolbar; `showMapBorder` in WorkspacePage
  - ✅ Pirate Plunder stickers — `pirateStickerFactory.ts` (9 emoji stickers via fabric.Text: ⚓☠️⛵🎩🧭🦜💰🗡️🛢️ at 96×96); non-editable, select like images; click-to-place; 🏴‍☠️ dropdown in WorkspaceToolbar; sword = single blade 🗡️
  - ✅ Cursor icon fix — color dot removed; only pirate emoji shown
  - ✅ **Parrot mascot** — `ParrotMascot.tsx`: flat SVG green parrot perched on a branch, fixed upper-right of BoardListPage; parchment speech bubble below parrot (pointer-up triangle); bobbing CSS animation (3s ease-in-out, speeds up on hover); 🦜 button cycles to next joke; ✕ dismiss; BoardListPage toolbar + grid use `paddingRight: 245` to keep content clear of parrot+bubble zone; BoardListPage header updated "CollabBoard" → "⚓ MeBoard".
  - ✅ **AI pirate jokes** — `pirate-jokes` Edge Function (OpenAI gpt-4o-mini, temperature 0.95, 5 jokes/call, no auth required). `usePirateJokes` hook: checks `localStorage` for `meboard:jokes:YYYY-MM-DD` cache first; fetches Edge Function on miss; falls back to 8 hardcoded jokes on error; exposes stable `pickJoke()`. First-time welcome message (onboarding) shown when no boards + `meboard:welcomed:${userId}` key absent; key set on show so subsequent visits get jokes.
  - ✅ **GitHub OAuth replaces Google** — Google OAuth removed (provider scrapped). GitHub button promoted as sole OAuth option with dark polished styling (`btn-github` hover class, drop shadow, 700 weight). `signInWithGoogle` removed from authApi.ts.
  - ✅ **Hero illustration** — `HeroIllustration.tsx` significantly enhanced: 18 gold stars, crescent moon (top-right), faint compass rose lines, 4 crew avatars (🦜🧭⚓☠️) with pulse rings (was 3), rim grip notches on wheel, ocean gradient fill + 2 wave paths, distant ship silhouette with gold sail. ViewBox expanded 420→460.
  - **Remaining branding items** — captain cursor icon. Done: WelcomeToast, NavBar/Footer on BoardListPage, EmptyCanvasX easter egg.
  - **Features/Pricing pages** — TODO very much later. Placeholder routes for marketing; deferred.
- **Planned canvas features** — docs/PLANNED_CANVAS_FEATURES.md: Object grouping, Free draw, ~~Lasso selection~~ ✅, Multi-scale map vision. **Finished-product:** Connectors (Miro-style, required) ✅, Frames ✅, Duplicate ✅, Copy & Paste ✅, Marquee mode (box-select when starting on large objects). See doc for implementation notes and effort estimates.
- ~~Rotation (Task G)~~ ✅ — object:rotating hooked to emitModifyThrottled in boardSync.ts; rotation syncs live
- ~~**Per-object stroke width (border thickness)**~~ ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils + FabricCanvas ref; sync via existing object:modified.
- ~~Touch handling~~ ✅ — Two-finger pan + pinch zoom via native touch events on canvas element; touch-action:none on container; single-touch via Fabric pointer-event mapping.
- ~~Undo/Redo~~ ✅ — historyManager.ts; local history (add/remove/modify/text edit); Cmd+Z/⇧Z shortcuts; undo/redo toolbar buttons; remoteChangeRef prevents recording remote changes; syncs to DB via normal boardSync event flow.
- 6+ AI commands
- ~~**AI Client API**~~ ✅ — createObject, updateObject, deleteObjects, queryObjects in workspace/api/aiClientApi.ts; documentsApi: getDocument, fetchDocuments(criteria); exported from @/features/workspace. See docs/AI_CLIENT_API.md.
- ~~**AI Client API docs (Task B)**~~ ✅ — docs/AI_CLIENT_API.md updated: marked "Implemented (client + Edge Function)", import examples, usage examples. Edge Function (supabase/functions/ai-canvas-ops/index.ts) + frontend wrapper (aiCanvasOpsEdgeApi.ts) + barrel export all in place.

### Finished-product requirements (documented 2026-02-18)
- ~~**Connectors**~~ ✅ — Miro-style Phase 1 complete (2026-02-19): waypoints, arrowheads (none/end/both), stroke dash (solid/dashed/dotted), create-on-drop popup, floating endpoints on object delete, toolbar controls. Rotation/scale fix (2026-02-19): endpoints now re-anchor in real-time when connected objects are rotated or scaled (local + remote). Phase 2 nice-to-haves: port hover glow, double-click segment for waypoint, right-click context menu, auto-route.
- ~~**Frames**~~ ✅ — Container elements. Draw with Frame tool (+ → Containers → Frame). Objects dropped inside auto-join via `childIds`. Moving frame moves all children. Title editable. Synced to Supabase. AI templates use `createFrame` command to wrap generated objects. See activeContext.md for full architecture. **Phase 2 planned:** send-to-back auto-capture, frame title zoom fix (hide below threshold), per-frame add-row, form slots. See docs/plans/2026-02-20-frame-phase2-improvements.md.
- ~~**Duplicate**~~ ✅ — Cmd+D or toolbar button. Fabric clone(); new UUIDs; +20,+20 offset; connectors floated via `floatConnectorBothEndpoints`. History compound add. 2026-02-19.
- ~~**Copy & Paste**~~ ✅ — Cmd+C / Cmd+V. In-memory clipboard (clipboardStore.ts); serialize via toObject(['data','objects']); paste at cursor or viewport center; enlivenObjects revive; connectors floated. History compound add. 2026-02-19.
- ~~**Marquee mode**~~ ✅ — Alt+drag (Select tool) draws selection box even when starting on large objects. FabricCanvas.tsx.
- ~~**Lasso selection**~~ ✅ — Lasso tool in toolbar. Draw freeform path; objects whose center is inside path are selected. Fabric `Intersection.isPointInPolygon`. DOM capture like marquee. 2026-02-19.

### Planned (sync + UX polish)
- ~~**Multi-selection move sync v2**~~ ✅ — Fixed. During drag: broadcast selection-move delta (objectIds + dx, dy) on Realtime channel; other clients apply delta. On drop: write absolute positions to documents. Origin-vs-center bug resolved (see Recently Fixed).
- ~~**Bring forward / send backward (Task F)**~~ ✅ — bringForward/sendBackward implemented in FabricCanvas.tsx + toolbar buttons in WorkspaceToolbar.tsx. One step in z-order working.
- ~~**Boards page cleanup**~~ ✅ — Done. Then redesigned as **grid of cards** (not list): ordered by last_accessed_at; user_boards.last_accessed_at migration (20260218100000); joinBoard upserts it; formatLastAccessed "Opened X ago". Grid: gridAutoRows 130, columnGap 16, rowGap 20. Alignment fixes. Kebab menu: copy link, rename, delete.

## Current Status
**Phase:** MVP + post-MVP complete. DataTable polish ✅ (2026-02-20): accent colors, optional title bar, view/edit mode. Template redesign ✅ (2026-02-20): SWOT/Retro/UserJourney now use DataTable objects with colored headers. `createGrid` AI command ✅. All 6 required AI layout/template commands working.
**Next:** Connector Phase 2, remaining branding (hero illustration).

## Recently Added (2026-02-20 — Table Polish + Template Redesign)
- ✅ **DataTable schema** — `showTitle: boolean` (hides title bar), `accentColor?: string` (border + header tint), `headerColor?: string` on `FormColumn` (per-column `<th>` background).
- ✅ **FrameFormOverlay accent colors** — Border: `2px solid ${isEditing ? '#6366f1' : accent}`. Column `<th>` background: `col.headerColor ?? accentBg`. Title bar: `accentBg` background + `accent` text/border. `accentTint()` maps 5 preset accent colors to light tints; unknown accents fall back to `#f8fafc`.
- ✅ **View / Edit mode** — View (default): no footer, no delete controls, no type dropdowns, read-only `<span>` cells, `pointerEvents: none` on `<td>`. Edit (double-click): all controls visible, indigo border, cells editable. `editingTableId` state in WorkspacePage; `onTableEditStart`/`onTableEditEnd` via FabricCanvas props. Double-click sets id; click on non-table ends it.
- ✅ **createGrid AI command** — `{ action: 'createGrid', rows, cols, fill?, width?, height? }` creates an R×C grid of stickies centered on viewport. Added to `AiCommand` union + handler in `executeAiCommands`.
- ✅ **Template table type** — `TemplateObjectSpec.type: 'table'` with `showTitle`, `accentColor`, `formSchema` fields. `createTable` callback in `ExecuteAiOptions`; `FabricCanvasZoomHandle.createTable` imperative handle. `WorkspacePage` → `AiPromptBar` → `executeAiCommands` fully wired.
- ✅ **SWOT template** — 4 DataTable objects (Strengths green, Weaknesses red, Opportunities blue, Threats amber); `showTitle: true`; 5 pre-filled rows each. Frame 560×500.
- ✅ **Retrospective template** — 1 DataTable (700×360); `showTitle: false`; 3 columns with distinct `headerColor` (green/red/blue); 5 empty rows. Frame 740×420.
- ✅ **User Journey Map template** — 1 DataTable (940×360); `showTitle: false`; Phase column + 5 stage columns (blue headers); 5 pre-populated rows (Actions/Tasks/Feelings/Pain Points/Opportunities). Frame 980×420.

### AI Template Redesign ✅ (2026-02-19)
- Client-side template registry (`templateRegistry.ts`) — 4 templates (pros-cons, swot, user-journey, retrospective) as pure TypeScript data specs.
- `applyTemplate` command in `AiCommand` union; `viewportCenter` in `AiInterpretOptions`.
- `executeAiCommands` handles `applyTemplate`: frame-first at viewport center, children placed at `frameLeft + relLeft`.
- `getViewportCenter()` on `FabricCanvasZoomHandle`; wired through `AiPromptBar` → `WorkspacePage`.
- Edge Function system prompt simplified to intent detection only (~40 lines). Redeployed.
- **z-index bug fix:** `emitAdd`/`emitModify` now include `'zIndex'` in `toObject()` extra keys so frame z=1 is preserved (was being overwritten with `Date.now()` causing frame to render on top of children).
- Pros & Cons template redesigned: clean 2-column sticky layout, no opaque rect backgrounds.

## ~~🔴 Blocking Issue: AI Agent OpenAI Key Permissions~~ ✅ RESOLVED
OpenAI key permissions confirmed fixed. AI agent and parrot joke generation (usePirateJokes) are now unblocked.

## ⚠️ Look at Soon

- **Grid pattern disappeared** — The tldraw-style 20px canvas grid (GridOverlay.tsx) is no longer visible. Was working: FabricCanvas transparent background, GridOverlay rendered behind canvas, SVG pattern + `#fafafa` fill, transforms with viewport. Investigate: verify GridOverlay is still rendered in WorkspacePage, `showGrid` state is wired, canvas `backgroundColor` is still `'transparent'`.
- **Parchment/map treatment around canvas** — Canvas workspace needs the pirate-map aesthetic treatment. `MapBorderOverlay.tsx` exists (4 sepia gradient strips, compass corners, zoom-aware opacity, 🗺️ toggle) but the goal is a full parchment skin: aged-paper background for the infinite canvas, worn/vignette edges. Tied to MeBoard branding. Significant visual polish item.

## Known Issues
- ~~**Ungroup bug**~~ ✅ FIXED — Root cause: Fabric.js v7 tracks `parent` (permanent group ref) and `group` (transient ActiveSelection ref) separately. `canvas.remove(group)` leaves both set on children. (1) `child.group` caused `payloadWithSceneCoords` to double-apply the group transform → wrong DB position → `applyRemote` snap. (2) `child.parent` caused `ActiveSelection.exitGroup` to call `parent._enterGroup(child)` on deselect → child re-entered removed group → scrambled coords + unselectable. Fix: clear both `childRaw.group = undefined` and `childRaw.parent = undefined` before processing children in `ungroupSelected()` and Cmd+Shift+G handler. `FabricCanvas.tsx`.
- ~~**Box-select over large objects**~~ ✅ FIXED — Marquee mode: Alt+drag draws selection box even when starting on large objects.
- ~~**Zoom slider misaligned at max**~~ ✅ FIXED — `ZOOM_SLIDER_MAX` was `100` (10000%) but `MAX_ZOOM` is `10` (1000%). Slider was only ~86% right at max zoom. Fixed: `ZOOM_SLIDER_MAX = 10` in WorkspaceToolbar.tsx to match `MAX_ZOOM` in fabricCanvasZoom.ts.
- ~~**Multi-selection move drift**~~ ✅ FIXED — See Recently Fixed below.
- ~~**StrictMode (Task C)**~~ ✅ FIXED — Re-added conditionally: `import.meta.env.PROD ? <StrictMode>{app}</StrictMode> : app` in main.tsx. Dev skips StrictMode (avoids Realtime channel churn). Prod gets StrictMode safety checks. Previously removed because in dev, React StrictMode double-invokes effects: the document/lock/presence subscriptions run → cleanup (unsubscribe, removeChannel) → run again. That teardown/re-setup causes "channel churn": you briefly drop the Realtime subscription and re-create it, which can miss position updates from other users or cause reconnection lag when multiple people are moving objects. With StrictMode removed, effects run once in dev so no churn. **Production is unaffected** — StrictMode does not double-invoke in production builds, so re-adding `<React.StrictMode>` for prod is safe and gives StrictMode’s other benefits (e.g. detecting impure render side effects) without any churn.

## Recently Added (2026-02-19 — Board list features + drawing fixes)

### Board List Page
- ✅ **Search** — real-time title filter, debounce-free (client-side on in-memory array)
- ✅ **Sort** — Recent / Name / Count (object count). Pill-style sort group in toolbar.
- ✅ **Tabs** — My Boards / Public / All. Public tab fetches all `is_public=true` boards. All = union deduped.
- ✅ **Pagination** — 20 boards/page, Prev/Next, resets on filter/sort/tab change.
- ✅ **Public boards** — `is_public` column on `boards`. RLS updated: any auth'd user can read/write public boards. `updateBoardVisibility` RPC enforces owner-only. Toggle in kebab + Share modal (owner only).
- ✅ **Object count on cards** — `get_user_boards_with_counts` RPC joins documents; count shown on card.
- ✅ **Kebab ownership gate** — Rename, Make public/private, Delete only for `board.ownerId === userId`.
- ✅ **Board thumbnails** — `thumbnail_url` on boards. `board-thumbnails` Storage bucket (public). Captured in `handleBack` (not unmount) via `FabricCanvasZoomHandle.captureDataUrl()` (zoomToFit → toDataURL JPEG 0.7 × 0.5). Resized to 400×280 via offscreen canvas. Uploaded via Supabase Storage; URL saved to boards table. 130px image zone on cards.
- ✅ **Member management in Share modal** — `profiles` table + backfill migration. `get_board_members` + `remove_board_member` RPCs. Member list with Owner badge; owner can remove members. Member list refreshes after "Add to board" (2026-02-20) so new members appear immediately.
- ✅ **RLS fix: boards_select** — added `OR auth.uid() = owner_id` so INSERT+RETURNING doesn't 403 before board_members row exists.
- ✅ **Storage policies** — authenticated INSERT/UPDATE + public SELECT on `board-thumbnails` bucket.

### Drawing Tool Fix
- ✅ **Universal handle detection** — All drawing tools (sticker, text, sticky, shapes) use same rule: `_currentTransform?.corner` set → resize/rotate; otherwise → create new object. Previously `if (target) return` blocked drawing on top of existing objects entirely.

## Recently Added (2026-02-19 — Font size control + sticker zoom fix)
- ✅ **Font size control** — `FontControl` now includes a Size number input (8–10 000) alongside the font family dropdown. `fontUtils.ts`: `getFontSizeFromObject`, `setFontSizeOnObject`. `SelectionStrokeInfo`: `fontSize: number | null`. `FabricCanvasZoomHandle`: `setActiveObjectFontSize`. Input syncs when selection changes; clamps on blur; Enter applies.
- ✅ **Sticker zoom-scaling fix** — Stickers switched from `fontSize = 96/zoom` to `fontSize: 96` + `scaleX/scaleY = 1/zoom`. Emoji font metrics at huge fontSize values (96 000+) produced oversized, offset selection boxes (emoji visually much smaller than its nominal fontSize). Fixed: bounding-box is always measured at `fontSize 96` (reliable), then uniform scale makes it appear ~96 px on screen at any zoom. `MAX_STICKER_SCALE = 100_000` covers the full range down to 0.001% zoom.

## Recently Added (2026-02-19 — Lasso selection)
- ✅ **Lasso selection** — New Lasso tool in toolbar (next to Hand). Draw freeform path; on mouseup, objects whose center falls inside the path are selected via Fabric `Intersection.isPointInPolygon`. DOM capture so lasso works when starting on objects. Transient Polyline preview during drag. Requires 3+ points. Escape cancels in-progress lasso. FabricCanvas.tsx, tools.ts, WorkspaceToolbar.tsx.

## Recently Added (2026-02-19 — Escape key + tool UX + free draw + marquee fixes)
- ✅ **Escape key releases everything** — `handleKeyDown` now handles `Escape`: cancels active marquee drag (removes rect, removes DOM listeners), cancels in-progress shape/frame draw (removes preview object), cancels connector draw (removes preview line), calls `fabricCanvas.discardActiveObject()`, sets `isDrawingMode = false`, and calls `onToolChangeRef.current?.('select')` to return the toolbar to Select. New `onToolChange` prop on `FabricCanvas`; `WorkspacePage` passes `setSelectedTool`.
- ✅ **Free draw path hit detection** — Free draw paths now have `perPixelTargetFind: true` set in `handleObjectAdded`. Previously, clicking anywhere inside the path's bounding box selected the path (blocking objects underneath). Now only clicking on the actual stroke pixels selects the path, so objects under the path are click-selectable normally.
- ✅ **Marquee selection fully fixed** — Two separate bugs: (1) `intersectsWithRect` in Fabric v7 uses polygon edge-crossing logic — returns `false` when an object is **fully contained** inside the marquee (no edges cross). Fixed by checking `intersectsWithRect(tl, br) || isContainedWithinRect(tl, br)`. (2) Free draw paths with large bounding boxes were hijacking small marquees; fixed by using `isContainedWithinRect` only for `path` objects so the path must be fully inside the marquee to be included.

## Recently Added (2026-02-19)
- ✅ **Presence icon avatars** — Header presence replaced: circular emoji icon buttons (up to 4, "+N" overflow), hover tooltip, click jumps to that user's cursor via `panToScene`. `getPirateIcon` exported. `panToScene` added to `FabricCanvasZoomHandle`.
- ✅ **Presence stale cleanup fix** — Idle users no longer disappear from header. Stale timer resets `lastActive` to 0 (hides canvas cursor) instead of removing entries. Presence `leave` handles real disconnects.
- ✅ **Connector rotation/scale** — Endpoints re-anchor in real-time when connected objects are rotated or scaled. `boardSync.ts`: `getTransformIds` helper; `object:scaling` + `object:rotating` now call `updateConnectorsForObjects`; `applyRemote` calls `updateConnectorsForObjects` after applying remote updates so remote clients also see endpoints snap correctly. Port positions were already correct via `calcTransformMatrix()` — only the event trigger was missing.
- ✅ **Parrot mascot** — `ParrotMascot.tsx` (SVG parrot + parchment speech bubble). Bobbing animation. 8 hardcoded pirate greetings/jokes; random pick on mount; 🦜 cycle button; ✕ dismiss. Fixed in upper-right of BoardListPage via `position: fixed`. Bubble drops below parrot (pointer-up), not to the left, to avoid covering toolbar. Toolbar + grid `paddingRight: 245` reserves space for full bubble width (220px) + parrot (90px) + margin (20px). BoardListPage header: "CollabBoard" → "⚓ MeBoard". **Next step:** replace static `PARROT_GREETINGS` array with `usePirateJokes` hook (5 AI-generated jokes/day via Edge Function, cached in localStorage keyed by date) — OpenAI key fixed, ready to implement.

## Recently Fixed (2026-02-20 — Frame/table title persistence)
- ✅ **Frame and table title fontSize jumping on move** — User sets title to small size (e.g. 2px); when moving the frame/table, the title jumps back to large. Root cause: applying remote updates synced group transform and data only, never the title IText child's text/fontSize. Fix: `syncFrameOrTableTitleFromRevived` copies title IText from revived payload to existing; `text:editing:exited` syncs IText text to `data.title` before emit so payload is correct. boardSync.ts.

## Recently Added (2026-02-20 — Table object polish)
- ✅ **Tables fully movable** — `FrameFormOverlay.tsx` outer container changed from `pointerEvents: 'auto'` to `pointerEvents: 'none'`. Fabric.js listens for `mousemove` on the canvas element (not `document`), so a sibling overlay with `auto` pointer-events silently drops drag-tracking events. With the container set to `none`, mousedown/mousemove reach the canvas directly and Fabric can drag the table from any point on its surface. Individual interactive elements (`<th>`, `<td>`, footer buttons, row delete buttons) each declare `pointerEvents: 'auto'` to restore interactivity. The title bar was already `pointer-events: none` (unchanged).
- ✅ **Column type dropdown hidden until header hover** — `FrameFormPanel` gained `hoveredColId: string | null` state. The type `<select>` and delete `✕` button are conditionally rendered only when `hoveredColId === col.id`. `onMouseEnter`/`onMouseLeave` on `<th>` drive the state. The inline type label (e.g. " Text") is also suppressed while hovering to avoid crowding. After the native `<select>` picks a new type it naturally closes; the header returns to clean state when the mouse leaves.

## Recently Fixed (2026-02-17 / 2026-02-18 / 2026-02-19 / 2026-02-20)
- ✅ **Table not movable after selectability fix** — After making Tables selectable via the title bar (`pointer-events: none` on the title bar div), the table body still had `pointer-events: auto` which intercepted Fabric's drag-tracking `mousemove` events. Fix: set entire overlay container to `pointer-events: none`; restore `auto` per interactive child. Table is now draggable from any surface area.
- ✅ **Column type dropdown always visible** — The native `<select>` column type control was permanently visible in each column header, cluttering the UI. Fix: hover-reveal via `hoveredColId` state; controls only render when column header is hovered; native select auto-dismisses after selection.
- ✅ **Share modal members list not refreshing after add** — After "Add to board", success message showed but members list stayed stale. Fix: `refreshMembers()` re-fetches via `getBoardMembers` when `inviteToBoard` returns `result.added`. ShareModal.tsx.
- ✅ **Shape flip/mirror on scale handle cross** — When dragging a scale handle past its opposite (e.g. top past bottom), Fabric produces negative scale. Fix: (1) Use Fabric's default scaling during drag (removed custom control overrides). (2) Normalize only at `object:modified`: `normalizeScaleFlips` converts negative scale → positive scale + flipX/flipY in `fabricCanvasScaleFlips.ts`. (3) Skip `applyRemote` when object is the active selection (`existing === active` or `existing.group === active`) so our own postgres_changes echo doesn't overwrite the in-progress transform and cause flicker. boardSync.ts, FabricCanvas.tsx, fabricCanvasScaleFlips.ts.
- ✅ **Pirate Plunder stickers** — Replaced SVG Path with fabric.Text emoji (96×96); non-editable, selects like image; sword = single blade 🗡️; 9 stickers: anchor, skull, ship, hat, compass, parrot, chest, sword, barrel.
- ✅ **FabricCanvas refactor** — Was 1013 LOC (exceeded 1000 hard max). Extracted fabricCanvasZOrder.ts, fabricCanvasZoom.ts, fabricCanvasHistoryHandlers.ts, drawCanvasGrid.ts. FabricCanvas now 777 LOC; all tests pass. App.test.tsx fixed for MeBoard rebrand (heading matcher level: 1).
- ✅ **Cursor lag fix** — Broadcast for positions (like object moves), Presence for join/leave only. 33ms throttle replaces debounce. CursorOverlay CSS transform + 80ms linear transition for interpolation. Stale cleanup 3s.
- ✅ **Canvas UX polish** — Grid overlay (GridOverlay.tsx, 20px tldraw-style), cursor position readout (bottom-left x/y), zoom slider (25%–400%, log scale) alongside dropdown.
- ✅ **Boards grid redesign** — Grid of cards (not list), ordered by last_accessed_at. Migration 20260218100000_user_boards_last_accessed.sql; BoardMeta.lastAccessedAt; joinBoard upserts last_accessed_at; formatLastAccessed "Opened X ago". Grid: gridAutoRows 130, columnGap 16, rowGap 20. Alignment fixes for row spacing.
- ✅ **Lock log cleanup** — Removed verbose [LOCKS], [FABRIC], [APPLYLOCK] logs. Only log CHANNEL_ERROR/TIMED_OUT (skip CLOSED when intentional). locksApi.ts, boardSync.ts, FabricCanvas.tsx.
- ✅ **Multi-selection move drift** — Root cause: all shapes use `originX:'left', originY:'top'`, but `calcTransformMatrix()` returns the object **center** (via `getRelativeCenterPoint`). Using `qrDecompose(calcTransformMatrix()).translateX` as `left` wrote the center into an origin field, shifting objects right by `width/2` and down by `height/2` on every apply. **Three fixes in boardSync.ts:** (1) `payloadWithSceneCoords` now uses Fabric's `addTransformToObject` + save/restore so origin is correctly converted via `setPositionByOrigin`; (2) move-delta receiver uses `obj.left + dx` directly instead of calcTransformMatrix center; (3) `applyRemote` skips objects in the active selection to prevent sender's own postgres_changes echo from corrupting group-relative positions.
- ✅ **Boards page cleanup** — Figma-inspired: header aligned with Workspace, loading skeletons, empty state, card-style rows, kebab menu (Copy share link, Rename inline, Delete with confirm). boardsApi: updateBoardTitle, deleteBoard; RLS boards_delete (owner only). useUserBoards returns { boards, loading }.
- ✅ **Sticky notes UX** — No placeholder; on create, auto-enter edit (50ms delay, tryEnterTextEditing + hiddenTextarea.focus()) so blinking cursor appears. shapeFactory sticky = [bg, mainText] only.
- ✅ **Stroke width** — strokeUtils, StrokeControl, onSelectionChange, setActiveObjectStrokeWidth; toolbar shows Stroke dropdown when selection has stroke.
- ✅ **Toolbar + header aesthetic** — Icon tool groups, dividers, tldraw-like styling; header buttons aligned.
- ✅ **Shape tool vs selection** — With any shape tool active, pointer-down always starts drawing (never selects). FabricCanvas: discardActiveObject + draw start regardless of target.
- ✅ **Hand tool** — New toolbar tool; left-drag always pans (cursor: grab). No selection when hand active.
- ✅ **Zoom shortcuts** — +/= zoom in, − zoom out, 0 = fit to content, 1 = 100%. FabricCanvas handleKeyDown.
- ✅ **Zoom UI** — Toolbar zoom dropdown (25%, 50%, 100%, 200%, 400%, Fit). FabricCanvas ref exposes setZoom/zoomToFit; WorkspacePage wires ref + viewport zoom.
- ✅ **Board loading** — Paginated initial fetch (documentsApi): PAGE_SIZE 50, order by object_id, range(); first batch applied immediately, rest in sequence so UI stays responsive.
- ✅ Zoom (MVP) — Very wide zoom range 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100); FabricCanvas. Figma-like infinite canvas.
- ✅ **Trackpad pan/zoom** — Two-finger scroll = pan (relativePan); pinch = zoom at cursor (handleWheel ctrlKey branch). Pinch sensitivity 0.006 (deltaY multiplier). FabricCanvas.tsx.
- ✅ Multi-selection move sync (scene coords) — Objects in selection were synced with group-relative coords → others saw them disappear during move and in wrong place on drop. Now payloadWithSceneCoords() uses qrDecompose(calcTransformMatrix()) so we sync absolute left/top/angle/scale.
- ✅ Multi-selection move sync — Moving multiple selected objects (circle + triangle) now syncs; boardSync getObjectsToSync + pendingMoveIds
- ✅ Presence awareness — Header shows "X others viewing — Alice, Bob"; working as wanted
- ✅ Locking + document sync — Split FabricCanvas effect so document sync persists when auth loads; lock sync in separate effect
- ✅ Locking enabled — userId/userName in lock sync effect deps; boardSync refactored to setupDocumentSync + setupLockSync
- ✅ Text rotation — objects no longer enter edit mode during transform
- ✅ layoutManager serialization — removed from toObject() calls
- ✅ Ghost click zone — setCoords() + reapply lock state after remote updates
- ✅ Optimistic locking, broadcast for instant propagation
- ✅ INSERT instead of UPSERT — database enforces mutual exclusion
