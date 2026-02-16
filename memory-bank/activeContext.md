# Active Context

## Current Focus
Sync (RTDB delta sync). Workspace complete.

## Recent Changes
- Workspace: tldraw canvas in WorkspacePage, header + full-height layout
- Board list: boardsApi, useUserBoards, BoardListPage, WorkspacePage
- RTDB structure: boards/{id}, user_boards/{userId}/{boardId}

## Next Steps
1. Implement RTDB delta sync (object-level patches, server timestamps)
5. Implement workspace with tldraw
6. Add RTDB sync (delta-only, object-level)
7. Add multiplayer cursors and presence
8. Implement locking (client + server)
9. Deploy to Vercel

## Active Decisions
- Following PRD exactly for stack and sync strategy
- 7-day sprint with MVP 24-hour gate as internal checkpoint

## Considerations
- Locking is high-risk: dual-layer enforcement required
- AI agent must be server-side for serialization and atomicity
- Test edge cases early: lock races, disconnect mid-lock, AI batch failure
