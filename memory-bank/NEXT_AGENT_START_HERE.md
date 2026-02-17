# START HERE - Next Agent Context

**Date:** 2026-02-17

## Current State

**Locking, document sync, and Google Auth are fully working.** ✅

### What Was Fixed (Previous Session)
1. **Locking + document sync** — Split FabricCanvas effect so document sync persists when auth loads; lock sync in separate effect.
2. **boardSync:** setupDocumentSync + setupLockSync; applyLockStateCallbackRef for re-applying locks after remote updates.

### Completed
- Google Auth ✅ — User can log in with Google

## Next Item: Presence Awareness — "Who's on Board"

**Goal:** Show a **list of names** of who's currently viewing the board (in header or sidebar), per systemPatterns.md.

**Current state:**
- ✅ Cursor dots with name labels (CursorOverlay) — shows names when cursors are on canvas
- ✅ Count in header — "X other(s) viewing" when others.length > 0
- ❌ **Missing:** Persistent list of names (e.g. "Alice, Bob") so users see who's online at a glance, regardless of cursor position

**PRD:** MVP requirement "Presence awareness" (PRD v5.0 line 109). systemPatterns.md: "Who's on board: Subscribe to presence node → show list of names in header or sidebar."

**Implementation:** `others` from usePresence already has `{ userId, userName, color, ... }`. Enhance WorkspacePage header to show names (e.g. "Alice, Bob" or a compact list) instead of or in addition to "X others viewing". Consider: dropdown, inline list, or sidebar panel.

## Quick Reference
- **Presence:** usePresence (boardId, userId, userName) → others, updatePresence
- **WorkspacePage:** Header shows `{others.length} other(s) viewing` (lines 76-79)
- **CursorOverlay:** Renders cursor dots + name labels from others
- **presenceApi:** subscribeToPresence, writePresence, setupPresenceDisconnect
