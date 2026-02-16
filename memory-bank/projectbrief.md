# Project Brief: CollabBoard

## Source
PRD Version 4.7 | February 16, 2026

## Project Context
Gauntlet AI G4 Week 1 — Real-Time Collaborative Whiteboard with AI Agent

## Goal
Bulletproof multiplayer sync + reliable AI agent in a 7-day sprint. Project completion required for Austin admission.

## Core Requirements

### MVP (24-Hour Hard Gate)
- Infinite canvas with smooth pan/zoom
- Real-time sync (≥2 users)
- Multiplayer cursors with labels
- Presence awareness
- Full-object locking (dual-layer: client + server)
- Basic selection (single + box-select)
- Authentication required
- Public Vercel deployment

### Definition of Done (MVP)
- Cross-browser real-time sync works
- Dual-layer locking prevents corruption
- Selection enables core operations
- Private access enforced via RTDB rules
- Public deployment live
- Code follows SRP + file limits (<400 LOC target, 1000 max)

### Application Flow
1. Login (Google / Email)
2. Board List
3. Create / Select Board
4. Workspace

### Security Model
- Private by default
- Multiple boards per user
- Permanent invite links (revocable post-MVP)
- RTDB rules deny read/write if not member
- No guest access in MVP

## Scope Boundaries
- **In scope:** Shapes (rect, circle, triangle, line), sticky notes, standalone text; create/move/resize/color/delete/zIndex; AI agent via Cloud Functions
- **Out of scope (MVP):** Rotation, guest access, revocable invites
