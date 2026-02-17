# Tech Context

## Chosen Stack

### Frontend
- **React** + **Fabric.js** (BSD license)
- Infinite canvas with viewport culling, pan/zoom
- Shapes, sticky notes, text (tldraw-like clean/flat visual style)
- Selection (single + box), transforms (move, resize)
- Multiplayer cursors + presence

### Sync / Backend / Persistence
- **Supabase PostgreSQL + Realtime**
- Delta-only object patches; live drag via object:moving/scaling/rotating (80ms throttle)
- Presence & cursors (50ms debounce, payload-based)
- **Critical:** documents, locks, presence in supabase_realtime publication (Migration 00003). Realtime timeout 20s (config).

### Authentication
- **Supabase Auth** (Google + Email)

### AI Integration
- **Anthropic Claude** (function calling)
- Fallback: OpenAI GPT-4o-mini

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
- Presence: Supabase `presence` table, 50ms debounce; payload-based updates (no refetch)

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
