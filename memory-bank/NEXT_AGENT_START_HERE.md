# START HERE - Next Agent Context

**Date:** 2026-02-19

## Current State

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

## Next Items (suggested)

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
- **NavBar + Footer** ✅ — `src/shared/components/NavBar.tsx` (fixed top, MeBoard logo, Features/Pricing links, Log In button) + `src/shared/components/Footer.tsx` ("© MeBoard – All hands on deck"). Used in LoginPage only for now (safe from Undo/Redo conflicts).
- **index.html** ✅ — Title: "MeBoard – Pirate-Themed Collaborative Whiteboard"; meta description; OG tags; anchor emoji favicon (SVG data URI).
- **App.tsx loading** ✅ — "Hoisting the sails…" with ⚓ anchor icon on navy gradient.
- **Pirate cursor icons** ✅ — `CursorOverlay.tsx`: dot replaced with emoji icon (⚓🦜🧭☠️🔱) assigned deterministically via `hash(userId) % 5`. Color dot removed — icon only.

**Fixed this session (2026-02-19):**
- ~~**Cursor lag**~~ ✅ — Switched cursor positions from Presence API (DB round-trip) to **Supabase Broadcast** (same path as move-deltas, no DB). Debounce → 33ms throttle so positions stream during movement. CursorOverlay: `left/top` → `transform: translate(x,y)` + `transition: transform 80ms linear` for GPU-composited interpolation. Stale cursor cleanup 3s in usePresence. Files: `presenceApi.ts`, `usePresence.ts`, `CursorOverlay.tsx`.

**Fixed this session:**
- ~~**Multi-selection move drift**~~ ✅ — Root cause: originX/originY vs calcTransformMatrix center mismatch. Three fixes in boardSync.ts (payloadWithSceneCoords uses addTransformToObject; move-delta receiver uses obj.left+dx; applyRemote skips active selection echo). See systemPatterns for the pattern doc.

**Recently completed (2026-02-19):**
- ~~**`usePirateJokes` hook + Edge Function**~~ ✅ — `supabase/functions/pirate-jokes/index.ts` (OpenAI gpt-4o-mini, 5 jokes/call, temperature 0.95, no auth). `src/features/boards/hooks/usePirateJokes.ts`: checks `meboard:jokes:YYYY-MM-DD` localStorage cache, fetches Edge Function on miss, falls back to 8 hardcoded jokes on error; exposes stable `pickJoke()` via `useCallback` + `useRef`. `BoardListPage` waits for both `loading` and `jokesLoading` before showing parrot message. First-time welcome message (`meboard:welcomed:${userId}` localStorage flag) shown when no boards exist.

**Planned (documented in PRD + memory bank):**
- **Presence icon avatars in workspace header** — Replace "X others viewing — Alice, Bob" text with pirate emoji icons. Up to 4 icons, then "+N" overflow. Hover → name tooltip. Click → pan/zoom canvas to that user's cursor. Count text on hover of cluster only. Files: `WorkspacePage.tsx`; export `getPirateIcon` from `CursorOverlay.tsx` or move to `src/shared/lib/pirateIcon.ts`.
- **Viewport persistence** — TODO: Persist zoom/pan per board so returning users see where they left off. Currently resets to (0,0) at 100% on reload. localStorage + debounced save; optional "Reset view" control. See docs/PLANNED_CANVAS_FEATURES.md §0.
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

## Quick Reference
- **Zoom range:** 0.001%–10000% (MIN_ZOOM 0.00001, MAX_ZOOM 100). FabricCanvas.tsx.
- **boardSync.ts:** getObjectsToSync(), pendingMoveIds (Set), object:modified syncs each in selection.
- **FabricCanvas:** forwardRef with FabricCanvasZoomHandle (setZoom, zoomToFit, getActiveObject, setActiveObjectStrokeWidth). onSelectionChange(strokeInfo). Hand tool: isHandDrag → pan. Shape tool: always draw. Stroke in design units (scales with zoom automatically). **Trackpad:** two-finger scroll = pan (relativePan), pinch = zoom at cursor (ctrlKey branch; sensitivity 0.006). **Touch (mobile):** native touchstart/touchmove/touchend on canvasEl (passive:false) — 2-finger pan + pinch zoom; single-touch routes through Fabric pointer-event mapping to existing mouse:down/move/up. Container has touch-action:none.
- **strokeUtils.ts:** getStrokeWidthFromObject, setStrokeWidthOnObject, MIN/MAX_STROKE_WEIGHT (1–100), clampStrokeWeight(); StrokeControl uses number input.
- **WorkspaceToolbar:** Icon groups (Select|Hand | shapes | Text|Sticky), Pirate Plunder (🏴‍☠️) dropdown, StrokeControl when selectionStroke set, map border toggle (🗺️), zoom dropdown.
- **Pirate Plunder stickers:** fabric.Text emoji (96×96), non-editable, click-to-place. pirateStickerFactory.ts: STICKER_DEFS (anchor, skull, ship, hat, compass, parrot, chest, sword 🗡️, barrel). ToolType 'sticker'.
- **Sticky notes:** No placeholder. Create → box completes → edit mode opens (blinking cursor). shapeFactory sticky = [bg, mainText]; FabricCanvas handleMouseUp auto-enters edit after 50ms.
- **documentsApi:** subscribeToDocuments fetchInitial uses .range(offset, offset + PAGE_SIZE - 1) in a loop.
- **Lines:** shapeFactory creates lines as Polyline (not Fabric Line). No legacy Line boards to support.
- **AI agent:** ai-interpret Edge Function (OpenAI gpt-4o-mini). AiPromptBar in WorkspacePage. invokeAiInterpret → executeAiCommands → aiClientApi. OPENAI_API_KEY secret required. **Deploy MUST use `--no-verify-jwt`** (Supabase gateway rejects ES256 user JWTs otherwise). Auth in function uses `supabase.auth.getUser(token)` (explicit token — required in Deno). Client uses `supabase.functions.invoke()`. ✅ OpenAI key permissions fixed — AI agent working.
- **BoardListPage:** Grid of cards (repeat(auto-fill, minmax(220px, 1fr))), gridAutoRows 130, columnGap 16, rowGap 20. Ordered by last_accessed_at. boardsApi: recordBoardAccess, BoardMeta.lastAccessedAt.
- **usePirateJokes:** `src/features/boards/hooks/usePirateJokes.ts`. Cache key `meboard:jokes:YYYY-MM-DD`. Edge Function `pirate-jokes` (deploy: `supabase functions deploy pirate-jokes --no-verify-jwt`). FALLBACK_JOKES array used when offline/error. `pickJoke()` stable ref.
- **Parrot welcome:** `meboard:welcomed:${userId}` localStorage flag. Set on first show (no boards). After that, always jokes.
