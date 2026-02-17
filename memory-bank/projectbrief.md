# Project Brief: CollabBoard

## Source
PRD Version 6.0 | February 16, 2026 (Supabase stack)

## Project Context
Gauntlet AI G4 Week 1 — Real-Time Collaborative Whiteboard with AI Agent

## Goal
Bulletproof multiplayer sync + reliable AI agent in a 7-day sprint. Project completion required for Austin admission.

## Stack Change (v5.0)
- **Canvas:** Fabric.js (replaced tldraw due to v4+ licensing requirements)
- **Why:** tldraw needs trial/hobby/commercial key for prod; Fabric.js BSD-3 is free
- **Trade-off:** Custom sync/presence; mitigated by viewport culling + delta-only
- **Visual style:** Clean, flat (tldraw-like)
- **Viewport culling:** Required; use viewportTransform, object.visible
- **AI agent:** Post-MVP
- **Undo/Redo:** Post-MVP

## Core Requirements

### MVP (24-Hour Hard Gate)
- **Board sharing** — ≥2 users can access same board (prerequisite for testing collaboration)
- Infinite canvas with smooth pan/zoom (zoom range 0.01%–10000%+ for MVP)
- Real-time sync (≥2 users)
- Multiplayer cursors with labels
- Presence awareness
- Full-object locking (dual-layer: client + server)
- Basic selection (single + box-select)
- Authentication required
- Public Vercel deployment

### Definition of Done (MVP)
- Board sharing works — 2+ users can open same board
- Cross-browser real-time sync works
- Dual-layer locking prevents corruption
- Selection enables core operations
- Private access enforced via Supabase RLS
- Public deployment live
- Code follows SRP + file limits (<400 LOC target, 1000 max)

### Application Flow
1. Login (Google / Email)
2. Board List
3. Create / Select Board / Join Board (share link or board ID)
4. Workspace

### Security Model
- Private by default
- Multiple boards per user
- Permanent invite links (revocable post-MVP)
- Supabase RLS denies read/write if not member
- No guest access in MVP

## Scope Boundaries
- **In scope (MVP):** Shapes (rect, circle, triangle, line), sticky notes, standalone text; create/move/resize/color/delete/zIndex; viewport culling; Fabric.js canvas; **minimal board sharing** (share link or join-by-ID)
- **Out of scope (MVP):** Rotation, guest access, **revocable** invites, AI agent, Undo/Redo
- **Post-MVP:** AI agent, Undo/Redo, Rotation
