# Form Wireframe Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `input-field` and `button` visual canvas types + three static form templates + AI dynamic form generation so users can say "make me a sign up form with X" and get a properly laid-out wireframe frame.

**Architecture:** New types piggyback on the existing Group (sticky-note) pattern in shapeFactory. boardSync gets two small additions: subtype serialization for the new types in emitAdd/emitModify, and exclusion from updateStickyTextFontSize. The AI system prompt gains form layout rules + three new static template IDs. Edge Function is redeployed.

**Tech Stack:** React + TypeScript, Fabric.js v7, Supabase Edge Functions (Deno), existing aiClientApi/boardSync/shapeFactory patterns.

---

## Task 1: Register new types in `tools.ts`, `aiClientApi.ts`, `executeAiCommands.ts`

**Files:**
- Modify: `src/features/workspace/types/tools.ts`
- Modify: `src/features/workspace/api/aiClientApi.ts`
- Modify: `src/features/workspace/lib/executeAiCommands.ts`

### Step 1: `tools.ts` — add to ToolType union

In `src/features/workspace/types/tools.ts`, add `'input-field'` and `'button'` to the `ToolType` union. Do NOT add them to `SHAPE_TOOLS` (they are AI-only, not toolbar tools).

```ts
export type ToolType =
  | 'select'
  | 'hand'
  | 'lasso'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'sticker'
  | 'draw'
  | 'input-field'
  | 'button'
```

### Step 2: `aiClientApi.ts` — add to CreateObjectType and SHAPE_TYPE

Replace:
```ts
const SHAPE_TYPE: ToolType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky']
export type CreateObjectType = 'rect' | 'circle' | 'triangle' | 'line' | 'text' | 'sticky'
```

With:
```ts
const SHAPE_TYPE: ToolType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky', 'input-field', 'button']
export type CreateObjectType = 'rect' | 'circle' | 'triangle' | 'line' | 'text' | 'sticky' | 'input-field' | 'button'
```

### Step 3: `executeAiCommands.ts` — add to VALID_CREATE_TYPES

Replace:
```ts
const VALID_CREATE_TYPES: CreateObjectType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky']
```

With:
```ts
const VALID_CREATE_TYPES: CreateObjectType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky', 'input-field', 'button']
```

### Step 4: Run linter

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard && npx eslint src/features/workspace/types/tools.ts src/features/workspace/api/aiClientApi.ts src/features/workspace/lib/executeAiCommands.ts --max-warnings 0
```

Expected: no errors.

### Step 5: Commit

```bash
git add src/features/workspace/types/tools.ts src/features/workspace/api/aiClientApi.ts src/features/workspace/lib/executeAiCommands.ts
git commit -m "feat: register input-field and button as AI-only canvas types"
```

---

## Task 2: Add shape factories in `shapeFactory.ts`

**Files:**
- Modify: `src/features/workspace/lib/shapeFactory.ts`

### Step 1: Add `input-field` case to createShape switch

Add this case before the `default` case:

```ts
case 'input-field': {
  const inputW = Math.max(1, width)
  const inputH = Math.max(1, height)
  const bg = new Rect({
    left: 0,
    top: 0,
    width: inputW,
    height: inputH,
    fill: '#ffffff',
    stroke: '#94a3b8',
    strokeWidth: 1.5,
    rx: 6,
    ry: 6,
    originX: 'left',
    originY: 'top',
  })
  const placeholderText = new IText('Enter value...', {
    left: 10,
    top: Math.max(0, Math.round((inputH - 13) / 2)),
    fontSize: 13,
    fill: '#9ca3af',
    originX: 'left',
    originY: 'top',
    editable: true,
  })
  const group = new Group([bg, placeholderText], {
    left,
    top,
    originX: 'left',
    originY: 'top',
  })
  group.set('data', { subtype: 'input-field' })
  return withId(group)
}
```

### Step 2: Add `button` case

Add after `input-field`, before `default`:

```ts
case 'button': {
  const btnW = Math.max(1, width)
  const btnH = Math.max(1, height)
  const bg = new Rect({
    left: 0,
    top: 0,
    width: btnW,
    height: btnH,
    fill: '#3b82f6',
    stroke: '',
    strokeWidth: 0,
    rx: 6,
    ry: 6,
    originX: 'left',
    originY: 'top',
  })
  const label = new IText('Button', {
    left: 0,
    top: Math.max(0, Math.round((btnH - 14) / 2)),
    width: btnW,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    fill: '#ffffff',
    originX: 'left',
    originY: 'top',
    editable: true,
  })
  const group = new Group([bg, label], {
    left,
    top,
    originX: 'left',
    originY: 'top',
  })
  group.set('data', { subtype: 'button' })
  return withId(group)
}
```

### Step 3: Run linter

```bash
npx eslint src/features/workspace/lib/shapeFactory.ts --max-warnings 0
```

### Step 4: Run tests

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 34 tests pass.

### Step 5: Commit

```bash
git add src/features/workspace/lib/shapeFactory.ts
git commit -m "feat: input-field and button shape factories"
```

---

## Task 3: Fix `boardSync.ts` for new subtypes

**Files:**
- Modify: `src/features/workspace/lib/boardSync.ts`

Two changes needed:

### Change A — Serialize subtype in emitAdd and emitModify

Both `emitAdd` (around line 392) and `emitModify` (around line 452) have this pattern:
```ts
if (obj.type === 'group' && data?.subtype === 'container') {
  payload.subtype = 'container'
}
if (obj.type === 'group' && data?.subtype === 'frame') {
  // ...
}
if (data?.subtype === 'connector') {
  // ...
}
```

After each of those blocks, before `delete payload.data`, add:
```ts
if (obj.type === 'group' && data?.subtype === 'input-field') {
  payload.subtype = 'input-field'
}
if (obj.type === 'group' && data?.subtype === 'button') {
  payload.subtype = 'button'
}
```

Add this in BOTH `emitAdd` and `emitModify` — they have identical serialization code. Find both occurrences of `if (data?.subtype === 'connector')` and add the two new blocks directly after each.

### Change B — Exclude new subtypes from updateStickyTextFontSize

There are two call sites that call `updateStickyTextFontSize` on all non-container, non-frame groups. Add the new subtypes to those exclusion checks.

**Call site 1** (around line 275 — in the applyRemote `object:added` handler for existing objects):

Current:
```ts
if (!isContainerGroup(existing) && !isFrameGroup(existing)) {
  updateStickyTextFontSize(existing)
}
```

Replace with:
```ts
const existingSubtype = (existing.get('data') as { subtype?: string } | undefined)?.subtype
if (!isContainerGroup(existing) && !isFrameGroup(existing)
    && existingSubtype !== 'input-field' && existingSubtype !== 'button') {
  updateStickyTextFontSize(existing)
}
```

**Call site 2** (around line 351 — in the `applyRemote` revived object path):

Current:
```ts
const revivedData = revived.get('data') as { subtype?: string } | undefined
if (revivedData?.subtype !== 'container' && revivedData?.subtype !== 'frame') {
  updateStickyTextFontSize(revived)
}
```

Replace with:
```ts
const revivedData = revived.get('data') as { subtype?: string } | undefined
if (revivedData?.subtype !== 'container' && revivedData?.subtype !== 'frame'
    && revivedData?.subtype !== 'input-field' && revivedData?.subtype !== 'button') {
  updateStickyTextFontSize(revived)
}
```

### Step 4: Run linter + tests

```bash
npx eslint src/features/workspace/lib/boardSync.ts --max-warnings 0
npx jest --no-coverage 2>&1 | tail -8
```

Expected: no lint errors, 34 tests pass.

### Step 5: Commit

```bash
git add src/features/workspace/lib/boardSync.ts
git commit -m "fix: serialize input-field/button subtypes; exclude from sticky font resize"
```

---

## Task 4: Add form templates to `templateRegistry.ts`

**Files:**
- Modify: `src/features/workspace/lib/templateRegistry.ts`

### Step 1: Extend TemplateObjectSpec type

Change:
```ts
export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky'
  ...
}
```

To:
```ts
export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky' | 'input-field' | 'button'
  ...
}
```

### Step 2: Add LOGIN_FORM template

```ts
const LOGIN_FORM: TemplateSpec = {
  id: 'login-form',
  frameTitle: 'Login',
  frameWidth: 340,
  frameHeight: 360,
  objects: [
    // Title
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Log In', fontSize: 20, fill: '#1e293b' },
    // Email
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'you@example.com' },
    // Password
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Password', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: '••••••••' },
    // Button
    { type: 'button', relLeft: 28, relTop: 268, width: 284, height: 44,
      fill: '#3b82f6', text: 'Sign In' },
  ],
}
```

### Step 3: Add SIGNUP_FORM template

```ts
const SIGNUP_FORM: TemplateSpec = {
  id: 'signup-form',
  frameTitle: 'Sign Up',
  frameWidth: 340,
  frameHeight: 450,
  objects: [
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Sign Up', fontSize: 20, fill: '#1e293b' },
    // Name
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Full Name', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'Jane Doe' },
    // Email
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: 'you@example.com' },
    // Password
    { type: 'text', relLeft: 28, relTop: 260, width: 284, height: 20,
      text: 'Password', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 282, width: 284, height: 40,
      text: '••••••••' },
    // Button
    { type: 'button', relLeft: 28, relTop: 346, width: 284, height: 44,
      fill: '#3b82f6', text: 'Create Account' },
  ],
}
```

### Step 4: Add CONTACT_FORM template

```ts
const CONTACT_FORM: TemplateSpec = {
  id: 'contact-form',
  frameTitle: 'Contact Us',
  frameWidth: 340,
  frameHeight: 490,
  objects: [
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Contact Us', fontSize: 20, fill: '#1e293b' },
    // Name
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Name', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'Your name' },
    // Email
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: 'you@example.com' },
    // Message (tall)
    { type: 'text', relLeft: 28, relTop: 260, width: 284, height: 20,
      text: 'Message', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 282, width: 284, height: 80,
      text: 'Write your message…' },
    // Button
    { type: 'button', relLeft: 28, relTop: 386, width: 284, height: 44,
      fill: '#0d9488', text: 'Send Message' },
  ],
}
```

### Step 5: Register new templates

In `TEMPLATE_REGISTRY`:
```ts
export const TEMPLATE_REGISTRY: Record<string, TemplateSpec> = {
  'pros-cons': PROS_CONS,
  swot: SWOT,
  'user-journey': USER_JOURNEY,
  retrospective: RETROSPECTIVE,
  'login-form': LOGIN_FORM,
  'signup-form': SIGNUP_FORM,
  'contact-form': CONTACT_FORM,
}
```

### Step 6: Run linter + tests

```bash
npx eslint src/features/workspace/lib/templateRegistry.ts --max-warnings 0
npx jest --no-coverage 2>&1 | tail -8
```

Expected: no errors, 34 tests pass.

### Step 7: Commit

```bash
git add src/features/workspace/lib/templateRegistry.ts
git commit -m "feat: login-form, signup-form, contact-form templates"
```

---

## Task 5: Update AI system prompt + deploy Edge Function

**Files:**
- Modify: `supabase/functions/ai-interpret/index.ts`

### Step 1: Replace SYSTEM_PROMPT

Replace the entire `const SYSTEM_PROMPT = \`...\`` string with:

```
You are a canvas assistant for MeBoard. The user gives natural language instructions about drawing objects or creating templates on a whiteboard.

You respond with a JSON object: { "commands": [...] }. Each command is executed in order.

PRIMARY: createObject — For requests like "draw X", "add a Y", "create Z" (non-template):
{ "action": "createObject", "type": "rect"|"circle"|"triangle"|"line"|"text"|"sticky"|"input-field"|"button", "props": { "left": number, "top": number, "width"?: number, "height"?: number, "fill"?: string, "stroke"?: string, "strokeWeight"?: number, "text"?: string, "fontSize"?: number } }
- type: rect, circle, triangle, line, text, sticky, input-field, or button (lowercase)
- left, top: position in pixels. If viewport center is provided, place objects near it. Otherwise default to 100,100.
- fill: hex color. Common: blue #3b82f6, red #ef4444, green #10b981, yellow #fef08a, purple #8b5cf6

FORM ELEMENT TYPES:
- input-field: visual text input box (white bg, gray border, rounded corners). text prop = placeholder text shown inside. Default size 280×40.
- button: clickable button shape. text prop = button label. fill prop = button color (default #3b82f6 blue). Default size 280×44.

OTHER: queryObjects finds objects; deleteObjects removes by id; updateObject changes properties.

LAYOUT COMMANDS — use when the user asks to rearrange or space existing objects:
{ "action": "arrangeInGrid", "objectIds": string[], "cols": number }
{ "action": "spaceEvenly", "objectIds": string[], "direction": "horizontal"|"vertical" }

SELECTION CONTEXT — when the user says "these", "them", "selected", etc., they mean the selected objects. Their IDs will be provided as selectedObjectIds in the request.

TEMPLATE DETECTION — when the user asks for any of these known templates, return a SINGLE command:
{ "action": "applyTemplate", "templateId": "swot"|"pros-cons"|"user-journey"|"retrospective"|"login-form"|"signup-form"|"contact-form" }
The client handles ALL layout and placement. Do NOT emit createObject commands for template requests.

Template trigger phrases:
- "pros and cons" / "pros cons" → templateId: "pros-cons"
- "SWOT" / "SWOT analysis" / "4 quadrant" → templateId: "swot"
- "user journey" / "journey map" → templateId: "user-journey"
- "retrospective" / "retro" / "what went well" → templateId: "retrospective"
- "login form" / "sign in form" / "log in form" → templateId: "login-form"
- "signup form" / "sign up form" / "register form" / "registration form" → templateId: "signup-form"
- "contact form" / "contact us form" → templateId: "contact-form"

DYNAMIC FORM GENERATION — when the user asks for a custom form NOT matching the templates above (e.g. "make a checkout form with card number, expiry, cvv"):
Generate createObject commands for each element, then end with createFrame.

Layout rules (start at viewportCenter.x - 140, viewportCenter.y - 200 and stack downward):
1. Title: type=text, width=280, height=28, fontSize=20, fill="#1e293b"
2. Per field (repeat for each field):
   - Label: type=text, width=280, height=20, fontSize=12, fill="#64748b", text=field name
   - Input: type=input-field, width=280, height=40 (use height=80 for textarea/message fields), text=placeholder
   - Gap between label and input: 8px (label bottom + 8 = input top)
   - Gap between fields: 16px (previous input bottom + 16 = next label top)
3. Submit button: type=button, width=280, height=44, fill="#3b82f6", text=action label
   - Gap before button: 24px (last input bottom + 24 = button top)
4. End with: { "action": "createFrame", "title": "Form Name" }

Title-to-first-field gap: 16px. Add 28px bottom padding after button for frame sizing.

Return only valid JSON. No markdown. Example: { "commands": [{ "action": "createObject", "type": "rect", "props": { "left": 150, "top": 100, "width": 80, "height": 60, "fill": "#3b82f6" } }] }
```

### Step 2: Deploy the Edge Function

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard
supabase functions deploy ai-interpret --no-verify-jwt
```

Expected output: `Deployed Functions ai-interpret` (or similar success message).

### Step 3: Commit

```bash
git add supabase/functions/ai-interpret/index.ts
git commit -m "feat: form types + dynamic form generation in ai-interpret prompt; deploy"
```

---

## Final verification

```bash
npx jest --no-coverage 2>&1 | tail -8
npx eslint src/features/workspace/lib/shapeFactory.ts src/features/workspace/lib/boardSync.ts src/features/workspace/lib/templateRegistry.ts src/features/workspace/api/aiClientApi.ts src/features/workspace/lib/executeAiCommands.ts
```

All 34+ tests pass. No lint errors.
