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
  - **Remaining branding items** — hero illustration, Google hover state, captain cursor icon. Done: WelcomeToast, NavBar/Footer on BoardListPage, EmptyCanvasX easter egg.
  - **Features/Pricing pages** — TODO very much later. Placeholder routes for marketing; deferred.
- **Planned canvas features** — docs/PLANNED_CANVAS_FEATURES.md: Object grouping, Free draw, Lasso selection, Multi-scale map vision. **Finished-product:** Connectors (Miro-style, required), Frames, Duplicate, Copy & Paste, Marquee mode (box-select when starting on large objects). See doc for implementation notes and effort estimates.
- ~~Rotation (Task G)~~ ✅ — object:rotating hooked to emitModifyThrottled in boardSync.ts; rotation syncs live
- ~~**Per-object stroke width (border thickness)**~~ ✅ — StrokeControl in toolbar when selection has stroke (1/2/4/8px); strokeUtils + FabricCanvas ref; sync via existing object:modified.
- ~~Touch handling~~ ✅ — Two-finger pan + pinch zoom via native touch events on canvas element; touch-action:none on container; single-touch via Fabric pointer-event mapping.
- ~~Undo/Redo~~ ✅ — historyManager.ts; local history (add/remove/modify/text edit); Cmd+Z/⇧Z shortcuts; undo/redo toolbar buttons; remoteChangeRef prevents recording remote changes; syncs to DB via normal boardSync event flow.
- 6+ AI commands
- ~~**AI Client API**~~ ✅ — createObject, updateObject, deleteObjects, queryObjects in workspace/api/aiClientApi.ts; documentsApi: getDocument, fetchDocuments(criteria); exported from @/features/workspace. See docs/AI_CLIENT_API.md.
- ~~**AI Client API docs (Task B)**~~ ✅ — docs/AI_CLIENT_API.md updated: marked "Implemented (client + Edge Function)", import examples, usage examples. Edge Function (supabase/functions/ai-canvas-ops/index.ts) + frontend wrapper (aiCanvasOpsEdgeApi.ts) + barrel export all in place.

### Finished-product requirements (documented 2026-02-18)
- ~~**Connectors**~~ ✅ — Miro-style Phase 1 complete (2026-02-19): waypoints, arrowheads (none/end/both), stroke dash (solid/dashed/dotted), create-on-drop popup, floating endpoints on object delete, toolbar controls. Rotation/scale fix (2026-02-19): endpoints now re-anchor in real-time when connected objects are rotated or scaled (local + remote). Phase 2 nice-to-haves: port hover glow, double-click segment for waypoint, right-click context menu, auto-route.
- **Frames** — Container elements to organize content areas. See §6.
- **Duplicate** — Cmd+D or toolbar button. See §7.
- **Copy & Paste** — Cmd+C / Cmd+V. See §8.
- **Marquee mode** — Box-select (grab box) draws even when starting drag on top of large objects. Fix for current Fabric behavior. See §9.

### Planned (sync + UX polish)
- ~~**Multi-selection move sync v2**~~ ✅ — Fixed. During drag: broadcast selection-move delta (objectIds + dx, dy) on Realtime channel; other clients apply delta. On drop: write absolute positions to documents. Origin-vs-center bug resolved (see Recently Fixed).
- ~~**Bring forward / send backward (Task F)**~~ ✅ — bringForward/sendBackward implemented in FabricCanvas.tsx + toolbar buttons in WorkspaceToolbar.tsx. One step in z-order working.
- ~~**Boards page cleanup**~~ ✅ — Done. Then redesigned as **grid of cards** (not list): ordered by last_accessed_at; user_boards.last_accessed_at migration (20260218100000); joinBoard upserts it; formatLastAccessed "Opened X ago". Grid: gridAutoRows 130, columnGap 16, rowGap 20. Alignment fixes. Kebab menu: copy link, rename, delete.

## Current Status
**Phase:** MVP + post-MVP complete. Board list page fully featured. Viewport persistence + branding polish done (2026-02-19).
**Next:** Canvas features (free draw, grouping, lasso), Connector Phase 2, remaining branding (hero illustration).

## ~~🔴 Blocking Issue: AI Agent OpenAI Key Permissions~~ ✅ RESOLVED
OpenAI key permissions confirmed fixed. AI agent and parrot joke generation (usePirateJokes) are now unblocked.

## Known Issues
- **Ungroup bug (being fixed)** — When ungrouping a container group, ungrouped objects (1) move from their correct position and (2) become unselectable. Root cause under investigation (Fabric.js group→canvas coordinate conversion, and/or selectable/evented state not persisting after ungroup). Partial mitigations tried: `calcTransformMatrix()` instead of `calcOwnMatrix()`, explicit `child.set({ selectable: true, evented: true })` before adding to canvas; issue persists. See docs/PLANNED_CANVAS_FEATURES.md §1.
- **Box-select over large objects** — When user starts a drag on top of a large object, Fabric does not draw the selection marquee (grab box); it selects/moves the object instead. Fix: Marquee mode — modifier key or toggle so drag always draws selection box. See docs/PLANNED_CANVAS_FEATURES.md §9.
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
- ✅ **Member management in Share modal** — `profiles` table + backfill migration. `get_board_members` + `remove_board_member` RPCs. Member list with Owner badge; owner can remove members.
- ✅ **RLS fix: boards_select** — added `OR auth.uid() = owner_id` so INSERT+RETURNING doesn't 403 before board_members row exists.
- ✅ **Storage policies** — authenticated INSERT/UPDATE + public SELECT on `board-thumbnails` bucket.

### Drawing Tool Fix
- ✅ **Universal handle detection** — All drawing tools (sticker, text, sticky, shapes) use same rule: `_currentTransform?.corner` set → resize/rotate; otherwise → create new object. Previously `if (target) return` blocked drawing on top of existing objects entirely.

## Recently Added (2026-02-19)
- ✅ **Presence icon avatars** — Header presence replaced: circular emoji icon buttons (up to 4, "+N" overflow), hover tooltip, click jumps to that user's cursor via `panToScene`. `getPirateIcon` exported. `panToScene` added to `FabricCanvasZoomHandle`.
- ✅ **Presence stale cleanup fix** — Idle users no longer disappear from header. Stale timer resets `lastActive` to 0 (hides canvas cursor) instead of removing entries. Presence `leave` handles real disconnects.
- ✅ **Connector rotation/scale** — Endpoints re-anchor in real-time when connected objects are rotated or scaled. `boardSync.ts`: `getTransformIds` helper; `object:scaling` + `object:rotating` now call `updateConnectorsForObjects`; `applyRemote` calls `updateConnectorsForObjects` after applying remote updates so remote clients also see endpoints snap correctly. Port positions were already correct via `calcTransformMatrix()` — only the event trigger was missing.
- ✅ **Parrot mascot** — `ParrotMascot.tsx` (SVG parrot + parchment speech bubble). Bobbing animation. 8 hardcoded pirate greetings/jokes; random pick on mount; 🦜 cycle button; ✕ dismiss. Fixed in upper-right of BoardListPage via `position: fixed`. Bubble drops below parrot (pointer-up), not to the left, to avoid covering toolbar. Toolbar + grid `paddingRight: 245` reserves space for full bubble width (220px) + parrot (90px) + margin (20px). BoardListPage header: "CollabBoard" → "⚓ MeBoard". **Next step:** replace static `PARROT_GREETINGS` array with `usePirateJokes` hook (5 AI-generated jokes/day via Edge Function, cached in localStorage keyed by date) — OpenAI key fixed, ready to implement.

## Recently Fixed (2026-02-17 / 2026-02-18 / 2026-02-19)
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
