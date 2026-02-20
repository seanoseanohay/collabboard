# Tech Context

## Chosen Stack

### Frontend
- **React** + **Fabric.js** (BSD license)
- Infinite canvas with viewport culling, pan/zoom (zoom 0.001%–10000%+)
- Shapes, sticky notes, text (tldraw-like clean/flat visual style)
- Selection (single + box), transforms (move, resize)
- Multiplayer cursors + presence

### Sync / Backend / Persistence
- **Supabase PostgreSQL + Realtime**
- Delta-only object patches; live drag via object:moving/scaling/rotating (80ms throttle)
- Cursor positions via Supabase **Broadcast** (33ms throttle, same path as move-deltas — lowest latency). Online/leave tracking via Supabase **Presence** on the same channel.
- **Critical:** documents, locks in supabase_realtime publication (Migration 00003). Cursors use Broadcast — no DB table needed. Realtime timeout 20s (config).
- **Supabase Storage:** `board-thumbnails` bucket (public) for board preview images. Policies: authenticated INSERT/UPDATE, public SELECT.
- **Applied migrations 20260219000000–000007:** public boards, object count RPC, profiles table, thumbnail column + RPC update, boards_select owner fix, backfill profiles, visibility owner RPC, storage policies.

### Authentication
- **Supabase Auth** (Google + Email)

### AI Integration
- **OpenAI GPT-4o-mini** (primary — ai-interpret Edge Function). `max_tokens: 300`.
- Fallback: Anthropic Claude (post-MVP)
- **Observability:** LangSmith (`wrapOpenAI`) for tracing, token usage, latency, and errors at smith.langchain.com. Required Supabase secrets: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING_BACKGROUND=false`, `LANGSMITH_PROJECT=meboard`. Edge Function also logs via `console.log` (visible in Supabase Dashboard → Edge Functions → ai-interpret → Logs).
- **Performance — three-tier resolution in `invokeAiInterpret`:**
  1. `detectSimpleShape()` — regex match for "draw/add/create/make a [color] [shape] [at X, Y]"; returns instantly, zero network.
  2. `detectTemplateLocally()` — regex match for known template names; returns instantly, zero network.
  3. Edge Function + OpenAI — for all other prompts. System prompt is core (~750 tok) + optional form addendum (~350 tok) appended only when prompt mentions form/field/input/checkout/wizard.

### Deployment
- **Vercel** (frontend)
- **Supabase** (Postgres, Auth, RLS, Edge Functions)

## Development Practices
- Jest + React Testing Library
- ESLint + Prettier + Husky
- AI-first development (Cursor + Claude) with human review

## Technical Constraints
- Object IDs: Client-side UUID v4
- Deterministic IDs for optimistic creation
- Minimal remote updates — no full document resync
- Viewport culling: use Fabric viewportTransform, object.visible = false for off-screen
- Rotation excluded from MVP (post-MVP: throttled ~50ms deltas)
- Undo/Redo excluded from MVP (post-MVP)
- Cursor presence: Broadcast for positions (33ms throttle), Presence for join/leave on same channel; CursorOverlay CSS transition 80ms for interpolation

## Performance Targets
- 60 FPS during pan/zoom
- 500+ objects without degradation
- Stable under 50 kbps throttling
- 5+ concurrent users

## Testing Strategy
- TDD
- Unit: pure utils/services (aim 100%)
- Integration: locking, selection, AI batch flows
- Core scenarios: 2 users editing, refresh mid-edit, rapid creation/movement, 5 concurrent users
- Fabric-specific: 500-object stress with culling → 60 FPS; presence under throttle → <50ms
