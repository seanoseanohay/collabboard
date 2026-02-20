# AI Template Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded absolute-coordinate AI templates with a client-side template registry that places form-like frame containers at the viewport center, and simplify the Edge Function system prompt to pure intent detection.

**Architecture:** Known templates (SWOT, Pros/Cons, Retro, User Journey) are defined as TypeScript data specs in `templateRegistry.ts`. The AI edge function detects which template the user wants and returns `{ action: 'applyTemplate', templateId }`. `executeAiCommands` looks up the spec, creates the frame first at viewport center, then creates child objects at `frameLeft + relLeft`. Freeform prompts still use `createObject` but with viewport center injected into the user message.

**Tech Stack:** React + TypeScript, Fabric.js, Supabase Edge Functions (Deno), OpenAI gpt-4o-mini

---

## Context: Key Files

Before starting, read these files to understand the existing patterns:
- `src/features/workspace/lib/executeAiCommands.ts` — command loop, `ExecuteAiOptions`, `createObject` calls
- `src/features/workspace/api/aiInterpretApi.ts` — `AiCommand` union type, `AiInterpretOptions`
- `src/features/workspace/components/AiPromptBar.tsx` — `AiPromptBarProps`, how `createFrame` is called
- `src/features/workspace/components/FabricCanvas.tsx` — `FabricCanvasZoomHandle` interface and `useImperativeHandle` block (search for `getViewportCenter` after Task 4 to verify)
- `src/features/workspace/pages/WorkspacePage.tsx` — how `canvasZoomRef` is used; how `AiPromptBar` is rendered
- `supabase/functions/ai-interpret/index.ts` — current `SYSTEM_PROMPT` constant

---

## Task 1: Template Registry

**Files:**
- Create: `src/features/workspace/lib/templateRegistry.ts`

### Step 1: Create the file

```typescript
/**
 * Client-side template registry for AI-generated canvas templates.
 * Each template spec defines the frame dimensions and all child objects
 * as offsets (relLeft, relTop) from the frame's top-left corner.
 * No AI, no I/O — pure data.
 */

export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky'
  relLeft: number
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string
  fontSize?: number
}

export interface TemplateSpec {
  id: string
  frameTitle: string
  frameWidth: number
  frameHeight: number
  objects: TemplateObjectSpec[]
}

// ─── Pros & Cons ──────────────────────────────────────────────────────────────

const PROS_CONS: TemplateSpec = {
  id: 'pros-cons',
  frameTitle: 'Pros & Cons',
  frameWidth: 540,
  frameHeight: 460,
  objects: [
    // Section header labels
    { type: 'text', relLeft: 20, relTop: 52, width: 240, height: 40,
      text: 'Pros', fill: '#166534', fontSize: 16 },
    { type: 'text', relLeft: 280, relTop: 52, width: 240, height: 40,
      text: 'Cons', fill: '#991b1b', fontSize: 16 },
    // Section background rects
    { type: 'rect', relLeft: 20, relTop: 100, width: 240, height: 340,
      fill: '#f0fdf4', stroke: '#16a34a', strokeWeight: 2 },
    { type: 'rect', relLeft: 280, relTop: 100, width: 240, height: 340,
      fill: '#fef2f2', stroke: '#dc2626', strokeWeight: 2 },
    // Sticky note fields (3 per column)
    { type: 'sticky', relLeft: 30, relTop: 110, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 220, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 330, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 110, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 220, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 330, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
  ],
}

// ─── SWOT Analysis ────────────────────────────────────────────────────────────

const SWOT: TemplateSpec = {
  id: 'swot',
  frameTitle: 'SWOT Analysis',
  frameWidth: 560,
  frameHeight: 500,
  objects: [
    // Section background rects (2×2 grid)
    { type: 'rect', relLeft: 20, relTop: 52, width: 240, height: 210,
      fill: '#dcfce7', stroke: '#16a34a', strokeWeight: 2 },
    { type: 'rect', relLeft: 300, relTop: 52, width: 240, height: 210,
      fill: '#fee2e2', stroke: '#dc2626', strokeWeight: 2 },
    { type: 'rect', relLeft: 20, relTop: 278, width: 240, height: 210,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2 },
    { type: 'rect', relLeft: 300, relTop: 278, width: 240, height: 210,
      fill: '#fef9c3', stroke: '#ca8a04', strokeWeight: 2 },
    // Editable section header labels
    { type: 'text', relLeft: 30, relTop: 60, width: 220, height: 28,
      text: 'Strengths', fill: '#166534', fontSize: 14 },
    { type: 'text', relLeft: 310, relTop: 60, width: 220, height: 28,
      text: 'Weaknesses', fill: '#991b1b', fontSize: 14 },
    { type: 'text', relLeft: 30, relTop: 286, width: 220, height: 28,
      text: 'Opportunities', fill: '#1d4ed8', fontSize: 14 },
    { type: 'text', relLeft: 310, relTop: 286, width: 220, height: 28,
      text: 'Threats', fill: '#92400e', fontSize: 14 },
    // Sticky note fields (one per quadrant)
    { type: 'sticky', relLeft: 30, relTop: 96, width: 220, height: 156,
      fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 310, relTop: 96, width: 220, height: 156,
      fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 316, width: 220, height: 162,
      fill: '#eff6ff', text: '' },
    { type: 'sticky', relLeft: 310, relTop: 316, width: 220, height: 162,
      fill: '#fefce8', text: '' },
  ],
}

// ─── User Journey ─────────────────────────────────────────────────────────────

const USER_JOURNEY: TemplateSpec = {
  id: 'user-journey',
  frameTitle: 'User Journey',
  frameWidth: 980,
  frameHeight: 380,
  objects: [
    // Stage header stickies (horizontal row)
    { type: 'sticky', relLeft: 20, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Awareness' },
    { type: 'sticky', relLeft: 210, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Consideration' },
    { type: 'sticky', relLeft: 400, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Decision' },
    { type: 'sticky', relLeft: 590, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Retention' },
    { type: 'sticky', relLeft: 780, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Advocacy' },
    // Body sticky note fields
    { type: 'sticky', relLeft: 20, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do users discover us?' },
    { type: 'sticky', relLeft: 210, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'What influences their decision?' },
    { type: 'sticky', relLeft: 400, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'What drives conversion?' },
    { type: 'sticky', relLeft: 590, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do we keep them engaged?' },
    { type: 'sticky', relLeft: 780, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do they spread the word?' },
  ],
}

// ─── Retrospective ────────────────────────────────────────────────────────────

const RETROSPECTIVE: TemplateSpec = {
  id: 'retrospective',
  frameTitle: 'Retrospective',
  frameWidth: 740,
  frameHeight: 460,
  objects: [
    // Column header stickies
    { type: 'sticky', relLeft: 20, relTop: 52, width: 220, height: 44,
      fill: '#dcfce7', stroke: '#16a34a', strokeWeight: 2, text: 'What Went Well' },
    { type: 'sticky', relLeft: 260, relTop: 52, width: 220, height: 44,
      fill: '#fee2e2', stroke: '#dc2626', strokeWeight: 2, text: "What Didn't" },
    { type: 'sticky', relLeft: 500, relTop: 52, width: 220, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Action Items' },
    // Body sticky note fields
    { type: 'sticky', relLeft: 20, relTop: 110, width: 220, height: 340,
      fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 260, relTop: 110, width: 220, height: 340,
      fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 500, relTop: 110, width: 220, height: 340,
      fill: '#eff6ff', text: '' },
  ],
}

export const TEMPLATE_REGISTRY: Record<string, TemplateSpec> = {
  'pros-cons': PROS_CONS,
  swot: SWOT,
  'user-journey': USER_JOURNEY,
  retrospective: RETROSPECTIVE,
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard
npx tsc --noEmit
```

Expected: no errors.

### Step 3: Commit

```bash
git add src/features/workspace/lib/templateRegistry.ts
git commit -m "feat: add client-side template registry with 4 frame-based templates"
```

---

## Task 2: Add `applyTemplate` to the AiCommand union

**Files:**
- Modify: `src/features/workspace/api/aiInterpretApi.ts`
- Modify: `src/features/workspace/api/aiInterpretApi.ts` (also add `viewportCenter` to options)

### Step 1: Open `aiInterpretApi.ts` and find the `AiCommand` type union

It currently ends with `| { action: 'groupCreated' }`. Add one more member:

```typescript
| { action: 'applyTemplate'; templateId: string }
```

### Step 2: Add `viewportCenter` to `AiInterpretOptions`

Find:
```typescript
export interface AiInterpretOptions {
  selectedObjectIds?: string[]
}
```

Replace with:
```typescript
export interface AiInterpretOptions {
  selectedObjectIds?: string[]
  viewportCenter?: { x: number; y: number }
}
```

### Step 3: Pass `viewportCenter` in the request body

Find the `supabase.functions.invoke` call body:
```typescript
{ body: { boardId, prompt, selectedObjectIds: options?.selectedObjectIds } }
```

Replace with:
```typescript
{ body: { boardId, prompt, selectedObjectIds: options?.selectedObjectIds, viewportCenter: options?.viewportCenter } }
```

### Step 4: Verify TypeScript compiles

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 5: Commit

```bash
git add src/features/workspace/api/aiInterpretApi.ts
git commit -m "feat: add applyTemplate to AiCommand union; viewportCenter to AiInterpretOptions"
```

---

## Task 3: Handle `applyTemplate` in `executeAiCommands`

**Files:**
- Modify: `src/features/workspace/lib/executeAiCommands.ts`

### Step 1: Import `TEMPLATE_REGISTRY` at the top of the file

Add to the import block:
```typescript
import { TEMPLATE_REGISTRY } from './templateRegistry'
```

### Step 2: Add `getViewportCenter` to `ExecuteAiOptions`

Find:
```typescript
export interface ExecuteAiOptions {
  /** Called after createFrame command: creates a frame container around all created objects. */
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => void
}
```

Replace with:
```typescript
export interface ExecuteAiOptions {
  /** Creates a frame container on the canvas. */
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => void
  /** Returns the current viewport center in scene coordinates. */
  getViewportCenter?: () => { x: number; y: number }
}
```

### Step 3: Add the `applyTemplate` branch inside the command loop

Find the `} else if (cmd.action === 'groupCreated') {` block. **Before** it, add:

```typescript
} else if (cmd.action === 'applyTemplate') {
  const spec = TEMPLATE_REGISTRY[cmd.templateId]
  if (!spec || !options?.createFrame) {
    // Unknown template or no createFrame callback — skip silently
  } else {
    const center = options.getViewportCenter?.() ?? { x: 400, y: 300 }
    const frameLeft = Math.round(center.x - spec.frameWidth / 2)
    const frameTop = Math.round(center.y - spec.frameHeight / 2)

    // Create frame first (no childIds yet — boardSync auto-captures via checkAndUpdateFrameMembership)
    options.createFrame({
      title: spec.frameTitle,
      childIds: [],
      left: frameLeft,
      top: frameTop,
      width: spec.frameWidth,
      height: spec.frameHeight,
    })

    // Create all child objects with absolute coords = frameLeft + relLeft
    for (const obj of spec.objects) {
      const objectId = await createObject(
        boardId,
        obj.type as import('../api/aiClientApi').CreateObjectType,
        {
          left: frameLeft + obj.relLeft,
          top: frameTop + obj.relTop,
          width: obj.width,
          height: obj.height,
          fill: obj.fill,
          stroke: obj.stroke,
          strokeWeight: obj.strokeWeight,
          text: obj.text,
          fontSize: obj.fontSize,
        },
        { zIndex: baseZ + createIndex }
      )
      createdIds.push(objectId)
      createIndex++
    }
  }
```

### Step 4: Verify TypeScript compiles

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 5: Commit

```bash
git add src/features/workspace/lib/executeAiCommands.ts
git commit -m "feat: executeAiCommands handles applyTemplate via client-side registry"
```

---

## Task 4: Expose `getViewportCenter` on `FabricCanvasZoomHandle`

**Files:**
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

### Step 1: Add `getViewportCenter` to the `FabricCanvasZoomHandle` interface

Search for the `FabricCanvasZoomHandle` interface (near the top of `FabricCanvas.tsx`). Add:

```typescript
getViewportCenter: () => { x: number; y: number }
```

### Step 2: Implement it in `useImperativeHandle`

Search for the `useImperativeHandle` block. Add alongside the other imperative methods:

```typescript
getViewportCenter: () => {
  const vpt = fabricCanvas.viewportTransform
  const zoom = fabricCanvas.getZoom()
  return {
    x: Math.round((width / 2 - vpt[4]) / zoom),
    y: Math.round((height / 2 - vpt[5]) / zoom),
  }
},
```

Where `width` and `height` are the canvas element dimensions already available in that closure (used by other handle methods).

### Step 3: Verify TypeScript compiles

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 4: Commit

```bash
git add src/features/workspace/components/FabricCanvas.tsx
git commit -m "feat: expose getViewportCenter on FabricCanvasZoomHandle"
```

---

## Task 5: Wire `getViewportCenter` through `AiPromptBar` and `WorkspacePage`

**Files:**
- Modify: `src/features/workspace/components/AiPromptBar.tsx`
- Modify: `src/features/workspace/pages/WorkspacePage.tsx`

### Step 1: Add `getViewportCenter` prop to `AiPromptBarProps`

In `AiPromptBar.tsx`, find:
```typescript
interface AiPromptBarProps {
  boardId: string
  getSelectedObjectIds?: () => string[]
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => void
  /** @deprecated Use createFrame instead. Kept for backward compatibility. */
  groupObjectIds?: (ids: string[]) => Promise<void>
}
```

Add the new prop:
```typescript
  getViewportCenter?: () => { x: number; y: number }
```

### Step 2: Destructure `getViewportCenter` in the component function

Find:
```typescript
export function AiPromptBar({ boardId, getSelectedObjectIds, createFrame, groupObjectIds }: AiPromptBarProps) {
```

Replace with:
```typescript
export function AiPromptBar({ boardId, getSelectedObjectIds, createFrame, groupObjectIds, getViewportCenter }: AiPromptBarProps) {
```

### Step 3: Pass `getViewportCenter` into `executeAiCommands` and `invokeAiInterpret`

Find the `runPrompt` callback. It calls:
```typescript
const { commands } = await invokeAiInterpret(boardId, text, { selectedObjectIds })
const result = await executeAiCommands(boardId, commands, {
  createFrame: createFrame ?? undefined,
})
```

Replace with:
```typescript
const viewportCenter = getViewportCenter?.()
const { commands } = await invokeAiInterpret(boardId, text, {
  selectedObjectIds,
  viewportCenter,
})
const result = await executeAiCommands(boardId, commands, {
  createFrame: createFrame ?? undefined,
  getViewportCenter,
})
```

### Step 4: Add `getViewportCenter` to the `useCallback` dependency array

Find the `useCallback` deps array for `runPrompt`:
```typescript
[boardId, loading, createFrame, groupObjectIds]
```

Replace with:
```typescript
[boardId, loading, createFrame, groupObjectIds, getViewportCenter]
```

### Step 5: Pass `getViewportCenter` from `WorkspacePage`

In `WorkspacePage.tsx`, find the `<AiPromptBar` JSX. Add:
```tsx
getViewportCenter={() => canvasZoomRef.current?.getViewportCenter() ?? { x: 400, y: 300 }}
```

### Step 6: Verify TypeScript compiles

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 7: Commit

```bash
git add src/features/workspace/components/AiPromptBar.tsx src/features/workspace/pages/WorkspacePage.tsx
git commit -m "feat: wire getViewportCenter through AiPromptBar and WorkspacePage"
```

---

## Task 6: Simplify the Edge Function System Prompt

**Files:**
- Modify: `supabase/functions/ai-interpret/index.ts`

### Step 1: Replace `SYSTEM_PROMPT` constant

Open `supabase/functions/ai-interpret/index.ts`. Replace the entire `SYSTEM_PROMPT` string with:

```typescript
const SYSTEM_PROMPT = `You are a canvas assistant for CollabBoard. The user gives natural language instructions about drawing objects or creating templates on a whiteboard.

You respond with a JSON object: { "commands": [...] }. Each command is executed in order.

PRIMARY: createObject — For requests like "draw X", "add a Y", "create Z" (non-template):
{ "action": "createObject", "type": "rect"|"circle"|"triangle"|"line"|"text"|"sticky", "props": { "left": number, "top": number, "width"?: number, "height"?: number, "fill"?: string, "stroke"?: string, "strokeWeight"?: number, "text"?: string, "fontSize"?: number } }
- type: rect, circle, triangle, line, text, or sticky (lowercase)
- left, top: position in pixels. If viewport center is provided, place objects near it. Otherwise default to 100,100.
- width, height: optional, default ~80x60 for shapes
- fill: hex color. Common: blue #3b82f6, red #ef4444, green #10b981, yellow #fef08a, purple #8b5cf6
- text: for "text" and "sticky" types
- strokeWeight: 1-8

OTHER: queryObjects finds objects; deleteObjects removes by id; updateObject changes properties.

LAYOUT COMMANDS — use when the user asks to rearrange or space existing objects:
{ "action": "arrangeInGrid", "objectIds": string[], "cols": number }
{ "action": "spaceEvenly", "objectIds": string[], "direction": "horizontal"|"vertical" }

SELECTION CONTEXT — when the user says "these", "them", "selected", etc., they mean the selected objects. Their IDs will be provided as selectedObjectIds in the request.

TEMPLATE DETECTION — when the user asks for any of these known templates, return a SINGLE command:
{ "action": "applyTemplate", "templateId": "swot"|"pros-cons"|"user-journey"|"retrospective" }
The client handles ALL layout and placement. Do NOT emit createObject commands for template requests.

Template trigger phrases:
- "pros and cons" / "pros cons" → templateId: "pros-cons"
- "SWOT" / "SWOT analysis" / "4 quadrant" → templateId: "swot"
- "user journey" / "journey map" → templateId: "user-journey"
- "retrospective" / "retro" / "what went well" → templateId: "retrospective"

Return only valid JSON. No markdown. Example: { "commands": [{ "action": "createObject", "type": "rect", "props": { "left": 150, "top": 100, "width": 80, "height": 60, "fill": "#3b82f6" } }] }`
```

### Step 2: Update the user message construction to inject viewport center

Find:
```typescript
content: selectedObjectIds && selectedObjectIds.length > 0
  ? `${prompt}\n\nSelectedObjectIds: ${JSON.stringify(selectedObjectIds)}`
  : prompt,
```

Replace with:
```typescript
content: (() => {
  let msg = prompt
  if (selectedObjectIds && selectedObjectIds.length > 0) {
    msg += `\n\nSelectedObjectIds: ${JSON.stringify(selectedObjectIds)}`
  }
  if (viewportCenter) {
    msg += `\n\nUser viewport center: x=${Math.round(viewportCenter.x)}, y=${Math.round(viewportCenter.y)}. Place any new objects near this point.`
  }
  return msg
})(),
```

### Step 3: Extract `viewportCenter` from the request body

Find:
```typescript
const body = (await req.json()) as { boardId?: string; prompt?: string; selectedObjectIds?: string[] }
const { boardId, prompt, selectedObjectIds } = body
```

Replace with:
```typescript
const body = (await req.json()) as { boardId?: string; prompt?: string; selectedObjectIds?: string[]; viewportCenter?: { x: number; y: number } }
const { boardId, prompt, selectedObjectIds, viewportCenter } = body
```

### Step 4: Verify the Deno function is valid (TypeScript check)

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard
npx tsc --noEmit
```

(Full Deno type-check not available locally but TS errors in the function body will be caught by the project tsconfig for the function file if configured, otherwise the deploy step in Task 7 will surface errors.)

### Step 5: Commit

```bash
git add supabase/functions/ai-interpret/index.ts
git commit -m "feat: simplify ai-interpret system prompt; applyTemplate detection; viewport center injection"
```

---

## Task 7: Deploy the Edge Function

### Step 1: Deploy

```bash
cd /Users/lawrencekeener/Desktop/gauntlet/labs/week1/collabboard
supabase functions deploy ai-interpret --no-verify-jwt
```

Expected output: `Deployed Functions ai-interpret`

If deployment fails, check the error — most likely a syntax error in `index.ts`.

### Step 2: Commit (deploy receipt, no code change needed)

Nothing to commit here — the deploy is tracked by Supabase, not git.

---

## Task 8: Manual Smoke Test

Start the dev server:

```bash
npm run dev
```

### Test A — Template via quick-pick button
1. Open a board, zoom to an interesting area (not 0,0)
2. Click the AI button in the toolbar
3. Click "SWOT analysis" in the Templates section
4. Expected: A SWOT frame appears **centered on your current viewport**, with 4 colored quadrants, editable section labels, and blank sticky notes as input fields

### Test B — Template via typed prompt
1. Type "Create a retrospective board" in the AI prompt input and press Draw
2. Expected: A Retrospective frame appears at viewport center with 3 columns (What Went Well, What Didn't, Action Items), each with a blank sticky note field

### Test C — Second template doesn't overlap
1. Create a SWOT analysis
2. Pan to a different area of the canvas
3. Create another SWOT analysis
4. Expected: The second one appears at the new viewport center — no overlap with the first

### Test D — Freeform still works
1. Type "Draw a red circle"
2. Expected: A red circle appears near the current viewport center (not at pixel 100,100 if you've panned)

### Test E — Editable fields
1. Double-click any sticky note field inside a template
2. Expected: Text cursor appears, you can type freely

### Test F — Frame moves children
1. Click the frame border (not a child object)
2. Drag the frame
3. Expected: All children move with the frame

---

## Task 9: Update memory bank

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

### Step 1: Update `activeContext.md`

Add a new "Recent Changes" section at the top (above the existing ones):

```markdown
## Recent Changes (2026-02-19 — AI Template Redesign)

### AI Template Redesign
- **templateRegistry.ts** — 4 client-side template specs (pros-cons, swot, user-journey, retrospective). Pure data, no I/O.
- **executeAiCommands.ts** — `applyTemplate` branch: looks up spec, creates frame first at viewport center, creates children at `frameLeft + relLeft`.
- **FabricCanvas.tsx** — `getViewportCenter()` added to `FabricCanvasZoomHandle`.
- **AiPromptBar.tsx** — `getViewportCenter` prop; passed to `executeAiCommands` + `invokeAiInterpret`.
- **WorkspacePage.tsx** — passes `getViewportCenter` from `canvasZoomRef`.
- **ai-interpret/index.ts** — System prompt simplified: template detection returns `applyTemplate` command; viewport center injected into freeform user messages.
- Templates are now frame-first (frame created before children), viewport-centered, and defined entirely in TypeScript (no edge function redeploy needed to change layouts).
```

### Step 2: Update `progress.md`

Find the line about AI templates. Update to mark the redesign complete:

```markdown
- ~~**AI Template Redesign**~~ ✅ — Client-side template registry (4 templates); frame-first creation at viewport center; simplified AI system prompt (intent detection only). 2026-02-19.
```

### Step 3: Commit

```bash
git add memory-bank/activeContext.md memory-bank/progress.md
git commit -m "docs: update memory bank after AI template redesign"
```

---

## Done

All 9 tasks complete. The AI template system now:
- Places templates at the current viewport center
- Creates the frame first, then populates children relative to it
- Uses client-side TypeScript definitions for all 4 known templates
- Falls back to AI `createObject` for freeform requests, with viewport context injected
- Has a simplified Edge Function system prompt (~40 lines vs ~80 before)
