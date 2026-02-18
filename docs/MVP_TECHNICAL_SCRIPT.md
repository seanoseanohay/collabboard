# CollabBoard MVP — Technical Rundown Script (Video)

**Use this for a concise technical walkthrough of how the product is built.**

---

## 1. What We Built (30 sec)

CollabBoard is a **real-time collaborative whiteboard**. Multiple users share an infinite canvas: they see each other’s cursors, add shapes and sticky notes, move and resize objects, and edit text — all in real time. We use **Fabric.js** for the canvas and **Supabase** (Postgres + Realtime + Auth) for the backend. Sync is **object-level** (we never send the whole board, only per-object add/change/delete), and we use **dual-layer locking** so two people can’t edit the same object at once — same locking we’ll detail in the Locking section and summarize at the end.

---

## 2. Why Fabric.js? (45 sec)

We use **Fabric.js** for the canvas. The main reason we didn’t use tldraw is **licensing**: tldraw v4+ requires a trial, hobby, or commercial license for production apps. Fabric is **BSD-licensed**, so we can ship without that. The **benefits** of Fabric for us: we get full control over the canvas (pan, zoom, hit-testing, viewport); built-in **serialization** (`toObject` / `enlivenObjects`) that maps cleanly to our JSONB `documents` rows; a clear **event model** (`object:added`, `object:modified`, `object:removed`, plus `object:moving` / `object:scaling` for live drag) so we can hook sync and locking in one place; and we can enable **viewport culling** (`skipOffscreen: true`) for 500+ objects. The trade-off is we own the sync and presence logic ourselves — we kept that manageable with object-level deltas and a single Realtime subscription per board.

---

## 3. Object-Level Sync — What It Means (30 sec)

**Object-level sync** means we never send or replace the **entire board**. Every sync operation is about **one object**: “add this object,” “update this object,” or “remove this object.” So we have one row per object in the `documents` table, and we only ever upsert or delete by `(board_id, object_id)`. We never do a single “here’s the full board JSON” write. That keeps payloads small, avoids merge conflicts on the whole document, and scales better when many users are editing different parts of the canvas at once.

---

## 4. Dual-Layer Locking — What It Means (30 sec)

**Dual-layer locking** is one concept with two layers — the same one we mention in the intro and wrap.

- **Layer 1 — Client:** When you select an object we acquire a lock (write to the `locks` table). When you deselect we release it. Objects locked by someone else are made **non-selectable and non-evented** in Fabric, so you can’t click or drag them. The client also subscribes to lock changes so it always knows who’s editing what.
- **Layer 2 — Server:** Row Level Security (RLS) on the `locks` table ensures only the lock owner can update or delete their lock row. So even if a buggy or malicious client tried to steal or overwrite another user’s lock, Postgres rejects it.

There’s **no difference** between “locking” in bullet one, the Locking section (bullet six), and “RLS + locking” in the wrap: they all refer to this **same** dual-layer design — client-side disable plus server-side RLS on locks. RLS on the `locks` table *is* the server layer of locking.

---

## 5. Stack Change: Firebase → Supabase (45 sec)

The original PRD used **Firebase** — Realtime Database for sync and Firebase Auth. We moved to **Supabase** for the MVP: **PostgreSQL** as the source of truth, **Supabase Realtime** (Postgres change stream) for live updates, and **Supabase Auth** (Google + Email). That gives us one backend, SQL, RLS for security, and Edge Functions for things like invites. We also switched the canvas from tldraw to Fabric.js (licensing and control, as above). The trade-off of owning sync is mitigated by object-level deltas and viewport culling.

---

## 6. How We Keep Objects — The Database (1 min)

**In plain language:** We have **boards**. Each board has **members** (the users who can open it). For each board we store **who those members are** in one table and a **denormalized “my boards” list** in another so loading the board list is cheap. The actual **stuff on the canvas** — every shape, sticky note, and text box — lives in **documents**: one row per object, with the object’s data in a JSON blob. So: one board → many members, one board → many documents. Separately we have **locks** — one row per object that someone is currently editing (who has it, so we can block others). And **presence** — one row per user per board for their **cursor position** and name/color. So boards own members, documents, locks, and presence; documents are the canvas objects; locks and presence are the live collaboration state.

The database has six tables:

- **boards** — One row per board (id, title, owner_id).
- **board_members** — Who can access each board (board_id, user_id). All access is gated by this.
- **user_boards** — Denormalized list for “my boards” (user_id, board_id, title) so we can show the board list without heavy joins.
- **documents** — This is where canvas objects live. One row per object: `(board_id, object_id, data JSONB, updated_at)`. The `data` column holds the Fabric serialization (type, left, top, scaleX, scaleY, fill, text, etc.). Object IDs are **client-generated UUIDs** so we can create optimistically. This is the table that backs **object-level sync**.
- **locks** — Who is editing which object: `(board_id, object_id, user_id, user_name, last_active)`. One lock per object; we acquire on selection and release on deselection. RLS on this table is the **server layer** of dual-layer locking.
- **presence** — Cursors: `(board_id, user_id, x, y, name, color, last_active)`.

Every table has **Row Level Security (RLS)**. For documents, locks, and presence you can only read/write if you’re in `board_members` for that board. Locks and presence are further restricted so you can only update or delete your own row.

---

## 7. “Caching” and Sync — How Objects Flow (1 min)

We don’t use a separate cache layer. **Postgres is the source of truth**; the “cache” is the in-memory Fabric canvas plus a **single Realtime subscription** per board.

- **On open:** We run one query: `select object_id, data from documents where board_id = ?` and apply each row to the canvas (Fabric’s `enlivenObjects`). That’s the initial load.
- **Live updates:** We subscribe to Postgres changes on `documents` with `filter: board_id=eq.<boardId>` and `event: '*'` (INSERT, UPDATE, DELETE). One subscription handles all three. When a change comes in we either add a new object, patch an existing one (e.g. left, top, scale, text), or remove it. We strip server-only fields like `updatedAt` before applying so Fabric state stays clean.
- **Outbound:** Fabric events drive writes. On `object:added` we upsert that object into `documents`. On `object:modified` we upsert again. On `object:removed` we delete the row. For drag/resize we throttle (e.g. 80 ms) so we don’t flood the server; on `object:modified` (mouse up) we send a final write. We **never** send the full board — only object-level upserts or deletes.

So “caching” is: **initial fetch + Realtime stream + in-memory canvas**. No Redis, no local DB; Supabase is the only persistence.

---

## 8. Viewport Culling and Performance (20 sec)

We keep the canvas fast with **viewport culling**. Fabric is initialized with `skipOffscreen: true`, so objects outside the current pan/zoom view aren’t drawn. That lets us target **500+ objects** at 60 FPS. Cursors are transformed from world coordinates to screen space using the same viewport transform so they stay in sync with the canvas.

---

## 9. Locking — The Full Picture (20 sec)

This is the same **dual-layer locking** we defined earlier. In code: on selection we call the locks API to acquire; on deselection we release. We subscribe to lock changes and call `applyLockState` so objects locked by others get `selectable: false` and `evented: false`. On the server, RLS on `locks` guarantees only the owner can update or delete their row. So: one mechanism, two layers — client UX and server enforcement.

---

## 10. Wrap (15 sec)

In short: **Supabase Postgres** holds boards, membership, and every canvas object as a row; **Realtime** streams changes so everyone sees the same state; **object-level sync** (per-object add/update/delete only) keeps traffic and conflicts low; **viewport culling** keeps the canvas smooth; and **dual-layer locking** — client-side disable plus RLS on the locks table — keeps collaboration safe and consistent. That’s the technical backbone of the MVP.
