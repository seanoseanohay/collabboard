# Tech Context

## Chosen Stack

### Frontend
- **React** + **tldraw SDK v4.3.2** (latest stable)
- Infinite canvas, pan/zoom, shapes, sticky notes, text
- Selection (single + box), transforms (move, resize)
- Multiplayer cursors + presence

### Sync / Backend / Persistence
- **Firebase Realtime Database (RTDB)**
- Delta-only object patches
- Presence & cursors
- Graceful reconnect

### Authentication
- **Firebase Auth** (Google + Email)

### AI Integration
- **Anthropic Claude** (function calling)
- Fallback: OpenAI GPT-4o-mini

### Deployment
- **Vercel** (frontend)
- **Firebase** (RTDB, Auth, Rules, Cloud Functions)

## Development Practices
- Jest + React Testing Library
- ESLint + Prettier + Husky
- AI-first development (Cursor + Claude) with human review

## Technical Constraints
- Object IDs: Client-side UUID v4
- Deterministic IDs for optimistic creation
- Minimal `tldraw.update()` calls — no full document resync
- Rotation excluded from MVP (post-MVP: throttled ~50ms deltas)

## Performance Targets
- 60 FPS during pan/zoom
- 500+ objects without degradation
- Stable under 50 kbps throttling
- 5+ concurrent users

## Testing Strategy
- TDD
- Unit: pure utils/services (aim 100%)
- Integration: locking, selection, AI batch flows
- Core scenarios: 2 users editing, refresh mid-edit, rapid creation/movement, 5 concurrent users, simultaneous AI commands
