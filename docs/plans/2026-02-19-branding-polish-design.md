# MeBoard Branding Polish — Design

**Date:** 2026-02-19  
**Scope:** Option B — Hero illustration + primary button hover states  
**Status:** Approved by user

---

## What We're Building

Two concrete deliverables for the LoginPage / NavBar:

1. **`HeroIllustration` SVG component** — ship's wheel framing a mini collaborative canvas, with three crew presence circles at spoke positions (representing real-time co-presence). Inline SVG, no image assets, flat MeBoard palette (navy / gold / parchment).

2. **Primary button hover states** — gold buttons (Google sign-in, "Claim yer canvas" CTA, "Sign up free" CTA) get a gold → red (`#b91c1c`) transition on hover. Dark submit button ("Enter the Ship") gets a slight navy lighten. NavBar "Log In" / "Sign out" buttons get a gold tint on hover.

---

## Hero Illustration Design

- **viewBox:** `0 0 420 360`  
- **Main element:** Ship's wheel — outer ring `r=140`, 8 spokes at 45° intervals, hub `r=52` (parchment fill)  
- **Hub content:** 2 emoji-colored sticky notes + 1 outlined rectangle + 1 connector line with arrowhead  
- **Crew presence:** 3 circular avatar badges at spoke positions 270° (top), 135° (lower-left), 45° (lower-right) — each with a pirate emoji (🦜 ⚓ 🧭) and a distinct color  
- **Atmosphere:** Subtle radial glow + ocean ellipse at bottom  
- **Palette:** `#d4a017` gold ring / `#fdf6e3` parchment hub / `#1a1a2e` navy shapes

**Placement:** Rendered inside the existing hero flex layout, next to `heroContent` (same column on mobile, right column on desktop).

---

## Hover States Design

All hover CSS goes into the existing `src/index.css`. No new files needed.

| Class | Rest state | Hover state |
|-------|-----------|-------------|
| `.btn-gold` | `background: #d4a017; color: #0d1117` | `background: #b91c1c; color: #fff` |
| `.btn-dark` | `background: #1a1a2e; color: #d4a017` | `background: #16213e; color: #d4a017` |
| `.btn-nav` | transparent / outlined gold | `background: rgba(212,160,23,0.12); color: #d4a017` |

The `background` and `color` props are removed from the inline style objects for these buttons and owned by CSS classes instead, so no `!important` is needed.

---

## Files Changed

| Action | File |
|--------|------|
| Create | `src/features/auth/components/HeroIllustration.tsx` |
| Create | `src/features/auth/components/HeroIllustration.test.tsx` |
| Modify | `src/index.css` — add `.btn-gold`, `.btn-dark`, `.btn-nav` |
| Modify | `src/features/auth/components/LoginPage.tsx` — add illustration + classNames |
| Modify | `src/shared/components/NavBar.tsx` — add classNames to nav buttons |
