# Boards Page Cleanup — Figma-Inspired Scope

**Context:** BoardListPage is where users see their boards (list + New Board + Join). This doc frames scope using Figma’s file/home experience and gives a recommendation per question.

---

## 1. Layout: list vs grid?

**Figma:** Grid of file cards with thumbnails; dense but scannable.

**Question:** Keep a single list, or move to a grid of cards?

**Recommendation:** **Keep a single-column list for MVP.** Use **card-style rows** (one row per board, clear padding, subtle border/shadow) so it feels like Figma’s file rows even without thumbnails. A grid of cards can come later if we add canvas previews or placeholders.

---

## 2. Visual consistency with Workspace

**Figma:** Home and editor share the same header height, borders, shadows, and button style.

**Question:** Should the boards page match the workspace look and feel?

**Recommendation:** **Yes.** Align BoardListPage with WorkspacePage: same header (border, shadow, ~32px actions), same palette (#e5e7eb borders, #374151 text), same primary/secondary button treatment. Use the same header component or shared styles so the app feels like one product.

---

## 3. Loading and empty states

**Figma:** Skeletons or spinner while loading; empty state is friendly and has one clear CTA.

**Question:** Add explicit loading and empty states?

**Recommendation:** **Yes.**  
- **Loading:** Show skeleton rows (e.g. 3–5 placeholder cards) or a centered spinner while `useUserBoards` is loading.  
- **Empty:** Keep “No boards yet. Create one to get started.” and make **+ New Board** the single primary CTA (already there; consider slightly larger or more prominent so it reads like Figma’s “New design file”).

---

## 4. Per-board actions (Figma: open, share, duplicate, move, delete)

**Figma:** Each file card has hover actions or a menu: open, share, duplicate, move to project, delete.

**Question:** Which actions do we add on each board row?

**Recommendation:**  
- **Open** — Already (click row). Keep.  
- **Copy share link** — Add. Use existing `getShareUrl(boardId)` from `@/shared/lib/shareLinks`; show “Copy link” or icon on hover or in a row menu.  
- **Delete** — Add. Require confirmation (e.g. “Delete this board? This can’t be undone.”). Needs `boardsApi.deleteBoard` (and RLS).  
- **Rename** — Add. Inline edit (click title) or “Rename” in menu; needs `boardsApi.updateBoardTitle` (or update `boards.title` + `user_boards.title`).  
- **Duplicate** — Post-MVP; requires cloning board + documents.

Show actions via **hover** (icon bar) or a **kebab menu** (⋮) on each row to avoid clutter.

---

## 5. Sort order

**Figma:** Recent first (by last opened or last modified).

**Question:** How should boards be ordered?

**Recommendation:** **Newest first by `createdAt`** with current API. If we add `updated_at` (or last-opened) to boards later, switch to **last modified (or last opened) first** to match Figma. Document sort in `useUserBoards` or in the API (e.g. `order('created_at', { ascending: false })`).

---

## 6. Search or filter

**Figma:** Search over file names; filters by project/recency.

**Question:** Add search or filter on the boards page?

**Recommendation:** **Optional for MVP.** Add a **simple title search** (client-side filter on `board.title`) once the list feels long (e.g. 10+ boards), or when we have “projects.” Skip filters until we have project/folder structure.

---

## 7. Rename board

**Figma:** Rename from file card (click name) or context menu.

**Question:** Support renaming from the board list?

**Recommendation:** **Yes.** Inline rename (click title → edit → blur/Enter to save) or “Rename” in the row menu. Backend: update `boards.title` (and `user_boards.title` if denormalized). Keep title unique per board; no need for global uniqueness.

---

## Summary for implementation

| Area              | Recommendation                                      |
|-------------------|-----------------------------------------------------|
| Layout            | Single-column list, card-style rows                 |
| Visual consistency| Match Workspace header and palette                  |
| Loading           | Skeleton rows or spinner                            |
| Empty state       | Clear “No boards yet” + prominent New Board         |
| Row actions       | Copy share link, Delete (with confirm), Rename      |
| Sort              | Newest first (createdAt desc)                      |
| Search            | Optional; client-side title filter when needed      |
| Rename            | Inline or menu; add updateBoardTitle in boardsApi   |

**Key files:** `BoardListPage.tsx`, `boardsApi.ts` (add `deleteBoard`, `updateBoardTitle` if missing), `shareLinks.getShareUrl`, shared header/layout if extracted.
