# Form Wireframe Builder — Design

**Date:** 2026-02-19  
**Approved by user**

---

## What We're Building

Visual wireframe form elements on the canvas — styled canvas objects that look like inputs and buttons (Figma-style, not functional HTML). Users can say "make me a sign up form with name, email, password" and the AI generates a frame containing label text, input field shapes, and a button — all moveable, editable, and collaborative.

---

## New Object Types

### `input-field`
- Fabric Group: [bg Rect (white fill, `#94a3b8` border, 1.5px, rx=6) + IText (placeholder, `#9ca3af`, 13px)]
- Default: 280 × 40
- `data.subtype = 'input-field'`
- Text prop = placeholder text shown inside the field

### `button`
- Fabric Group: [bg Rect (blue fill `#3b82f6`, no stroke, rx=6) + IText (label, white, 14px bold, centered)]
- Default: 280 × 44
- `data.subtype = 'button'`
- Text prop = button label; fill prop = button color

Both are **AI-only types** — no toolbar tool, no direct drawing. Sync, move, resize exactly like sticky notes (same Group structure).

---

## Static Form Templates (registry)

Three templates added to `templateRegistry.ts`. Trigger phrases for existing static templates:

| Template ID | Trigger |
|-------------|---------|
| `login-form` | "login form", "sign in form" |
| `signup-form` | "signup form", "register form", "sign up form" |
| `contact-form` | "contact form" |

### `login-form` (340 × 360)
Title → Email label+input → Password label+input → Sign In button

### `signup-form` (340 × 450)
Title → Name label+input → Email label+input → Password label+input → Submit button

### `contact-form` (340 × 490)
Title → Name label+input → Email label+input → Message label+tall input (h=80) → Send button

---

## Dynamic Form Generation (AI)

For custom forms ("make me a form with first name, last name, phone, submit"):
- AI emits `createObject` commands for each element (text labels, input-fields, button)
- Ends with `createFrame` — frame auto-sizes around all created objects
- System prompt provides exact layout rules so the AI generates consistent spacing

Layout rules taught to the AI:
- Content width: 280px
- Start: `(viewportCenter.x - 140, viewportCenter.y - estimatedHeight/2)`  
- Title: text, fontSize=20, h=28
- Per field: text label (h=20, fontSize=13, gray) then input-field (h=40), gap=8px between them
- Between fields: 16px gap
- Before button: 24px gap; button h=44

---

## Files Changed

| Action | File | What |
|--------|------|------|
| Modify | `src/features/workspace/types/tools.ts` | Add `'input-field' \| 'button'` to `ToolType` |
| Modify | `src/features/workspace/lib/shapeFactory.ts` | Add `input-field` and `button` switch cases |
| Modify | `src/features/workspace/api/aiClientApi.ts` | Add to `CreateObjectType` and `SHAPE_TYPE` |
| Modify | `src/features/workspace/lib/executeAiCommands.ts` | Add to `VALID_CREATE_TYPES` |
| Modify | `src/features/workspace/lib/boardSync.ts` | Subtype serialization in `emitAdd`/`emitModify`; exclude from `updateStickyTextFontSize` |
| Modify | `src/features/workspace/lib/templateRegistry.ts` | Add `login-form`, `signup-form`, `contact-form` |
| Modify | `supabase/functions/ai-interpret/index.ts` | Update system prompt; add form template trigger phrases; add dynamic form layout rules |
