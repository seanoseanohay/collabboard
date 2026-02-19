# MeBoard Branding Specification

> Pirate-themed rebrand of CollabBoard. CollabBoard → MeBoard with treasure map / nautical aesthetic.

**Status:** Phase 1 (login, nav, footer, index) + Phase 2 (map border, pirate cursors, Pirate Plunder stickers) implemented.  
**Last updated:** 2026-02-18

---

## 1. Immediate Branding & Hero Overhaul

### Headline
- **From:** `# CollabBoard` (repeated)
- **To:** `# MeBoard` with a simple pirate logo (e.g., ship's wheel integrated into the "M" or framing the text)

### Subheadline
- **From:** "Sign in to continue"
- **To:** "Ahoy, Captain! Log in to hoist the canvas."

### Tagline
- "The collaborative whiteboard where crews plunder brilliant ideas — with a treasure map edge to set the adventure."

### Buttons
- **Google sign-in:** Gold with red hover, label "Join the Crew with Google"
- **Secondary sign-in:** Label "Enter the Ship" (was "Sign in")

### Sign-up prompt
- **From:** "Don't have an account? Sign up"
- **To:** "New to the crew? Sign up free" with a small anchor or parrot icon

### Files to update
- `src/features/auth/components/LoginPage.tsx`
- `index.html` (title, meta)

---

## 2. Subtle Pirate Visuals on the Landing Page

- **Background:** Low-opacity parchment texture or soft ocean fade so the login form stands out clearly
- **Hero illustration:** Stylized ship's wheel or simple treasure map framing an empty canvas, with modern crew avatars (light, inclusive, non-cluttered)
- **Placement:** Near the login box; ensure form readability and responsive layout

---

## 3. Treasure Map Border on the Canvas (Post-Login Workspace) — ✅ IMPLEMENTED

### Scope
- Apply **only to the borders/edges** of the infinite canvas view
- Central working area stays unchanged: pure white/off-white, no overlays, no interference with content

### Border details
- **Outer frame:** Fixed or viewport-relative, ~40–80px wide
- **Style:** Ultra-subtle aged parchment texture, soft torn edges, faint sepia tones
- **Nautical hints:** Very light dotted latitude/longitude lines or one tiny compass rose per corner
- **Opacity:** 10–20% max, desaturated and low-contrast — "unrolled map" whisper, invisible during focused work
- **Behavior:** Fades further when zoomed in or when content fills the view; more visible on zoom-out or empty boards ("exploring new seas")

### Constraints
- No bright colors, no icons in active zones, no waves/X marks in the border — just framing texture
- **Settings toggle:** "Hide Map Border" or "Clean Canvas" for users who prefer plain edges

### Implementation notes (implemented)
- `MapBorderOverlay.tsx` — 4 sepia gradient strips at edges, zoom-aware opacity, compass emoji in corners
- 🗺️ toggle button in WorkspaceToolbar; `showMapBorder` state in WorkspacePage
- Pass zoom from viewport for fade behavior

### Files (updated)
- `src/features/workspace/components/WorkspacePage.tsx`
- New: `src/features/workspace/components/MapBorderOverlay.tsx` (or similar)
- `WorkspaceToolbar` or header for toggle button

---

## 4. Polish Login & Onboarding Flow

- **Login form card:** Frame in light parchment-style card (echo canvas border aesthetic)
- **Microcopy above fields:** "Enter yer credentials, matey!"
- **Welcome animation:** After login — brief parrot swoop + "Welcome aboard!" then straight to canvas with map border visible
- **Demo Board button:** Quick guest access to a sample board showing treasure map border in action  
  - *Note: PRD says "No guest access in MVP" — may need public demo board or post-MVP*

---

## 5. Easter Eggs & Light Touches

| Location      | Behavior |
|--------------|----------|
| Landing idle | Gentle wave or flag ripple |
| In-app       | "arrr" in comments triggers pirate sticker or message *(requires comments feature — AiPromptBar is chat-like but not comments)* |
| Canvas       | Empty zoomed-out board shows faint central "X" that disappears on first edit |
| Loading      | "Hoisting the sails…" with tiny ship icon |

### Files to update
- `src/App.tsx` — loading state
- `GridOverlay` or similar for empty-canvas "X"
- Future comments feature for "arrr" easter egg

---

## 6. Supporting Content Below Login

- **Section:** "Why MeBoard?"
- **Content:** 3 pirate teasers — real-time collab, infinite canvas, fun tools — with subtle map accents as backgrounds
- **Testimonial placeholder:** "Best board since the Black Pearl! – Remote Crew Captain"
- **CTA:** "Sign up free — claim yer treasure map canvas today."

### Layout
- Requires scrollable login page layout (hero + supporting content)

---

## 7. Navigation, Footer & Final Touches

### Top nav
- **Structure:** Logo | Features | Pricing | Log In
- **Placement:** Shared across LoginPage, BoardListPage, and possibly WorkspacePage

### Footer
- **Copy:** "© MeBoard – All hands on deck"
- **Links:** Terms, Privacy, Contact

### Palette
- Navy accents
- Gold CTAs
- Sepia for map borders

### Favicon
- Ship's wheel or "M" on parchment

### SEO
- **Title:** "MeBoard – Pirate-Themed Collaborative Whiteboard with Treasure Map Canvas."

### Files to update
- New shared layout component (nav + footer)
- `index.html` (title, meta, favicon)
- New routes: Features, Pricing (can be placeholders)

---

## 8. Pirate Icons for User Presence (Avatars)

### Goal
Use monochrome pirate overlays/badges on cursor presence indicators.

### Icon options (one per user)
- **Pirate hat:** Tricorn with skull/crossbones or feather — subtle top/side placement
- **Parrot:** Perched on shoulder or corner badge
- **Skull & crossbones:** Small jolly roger badge or bandana accent
- **Ship:** Tiny silhouette for "captain" roles or group indicator

### Assignment
- **Option A:** Random/auto-assign via `hash(userId) % N` — stable per user, no schema
- **Option B:** User-selectable — requires profile/settings and `icon` field in presence or profiles table

### Current state
- `CursorOverlay` shows 10px colored dot + name label. No avatar/initials.
- `presence` table: `user_id`, `x`, `y`, `name`, `color`, `last_active` — no icon.
- Simplest: replace dot with pirate icon (14–18px). No avatar base required for MVP.

### Captain role (ship icon)
- Requires board role (e.g. `owner` = captain). Schema has `owner_id`; no `role` on `board_members` yet.

### Files to update
- `src/features/workspace/components/CursorOverlay.tsx`
- `src/features/workspace/hooks/usePresence.ts` (if adding icon to payload)
- `presence` migration (if user-selectable icon)
- `usePresence` → `writePresence` payload (if adding `icon` field)

---

## 9. Drawable Shapes & Stickers (Pirate Plunder) — ✅ IMPLEMENTED

### Goal
Add "Pirate Plunder" section in toolbar with draggable/stampable pirate-themed shapes.

### Sticker set (implemented with emoji)
| Kind     | Emoji | Label       |
|----------|-------|-------------|
| anchor   | ⚓    | Anchor      |
| skull    | ☠️    | Skull       |
| ship     | ⛵    | Ship        |
| hat      | 🎩    | Pirate Hat  |
| compass  | 🧭    | Compass     |
| parrot   | 🦜    | Parrot      |
| chest    | 💰    | Chest       |
| sword    | 🗡️    | Sword       |
| barrel   | 🛢️    | Barrel      |

### Implementation (current)
- **Fabric representation:** `fabric.Text` with single emoji char — crisp native rendering, non-editable, selects like image
- **Size:** 96×96 scene units (centered at click)
- **Tool type:** `sticker` with `stickerKind` in pirateStickerFactory
- **Creation:** Click-to-place (no drag)
- **Toolbar:** 🏴‍☠️ dropdown "Pirate Plunder" 3-col grid in WorkspaceToolbar
- **Sync:** Same as existing objects — Text toObject/enlivenObjects
- **Files:** `pirateStickerFactory.ts`, `tools.ts`, `WorkspaceToolbar.tsx`, `FabricCanvas.tsx`, `WorkspacePage.tsx`

### AI integration (future)
- Extend ai-interpret / ai-canvas-ops to support "add a treasure chest" etc.

---

## Suggested Implementation Order

1. Hero & copy in `LoginPage`, favicon, `index.html` title
2. Parchment card + background on login
3. Top nav + footer (shared layout)
4. Supporting content ("Why MeBoard?")
5. Map border on canvas + toggle
6. Loading state ("Hoisting the sails…")
7. Welcome animation
8. Pirate presence icons (CursorOverlay)
9. Pirate Plunder stickers
10. Easter eggs (landing animation, empty-canvas X)
11. Demo board (if guest access allowed)

---

## 10. Canvas Features for Map Drawing (Cross-Reference)

For free draw (coastlines, paths), grouping, and multi-scale map content, see **docs/PLANNED_CANVAS_FEATURES.md**. The MeBoard border (§3) frames the canvas; that doc covers tools to draw maps at multiple zoom levels (continents → cities → blocks).

---

## Constraints & Notes

- **PRD v5.0** specifies "clean, flat (tldraw-like)" — this branding is a deliberate aesthetic shift
- **Demo Board:** PRD "No guest access in MVP" — use public demo board or defer
- **"arrr" easter egg:** Needs comments feature; AiPromptBar is not comments
- **Subtlety:** Keep textures and borders low-opacity so the workspace remains comfortable for long sessions
