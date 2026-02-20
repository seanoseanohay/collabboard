# AI Template Redesign — Design Doc
**Date:** 2026-02-19  
**Status:** Approved

---

## Problem

The current AI template system has three structural weaknesses:

1. **Absolute pixel coordinates** — Template objects are hardcoded at `left:100, top:60` in the Edge Function system prompt. Running the same template twice stacks them on top of each other.
2. **Frame is an afterthought** — `createFrame` is the *last* command; it computes a bounding box around whatever was already placed. The frame does not define the layout — it just wraps it.
3. **Layout in the Edge Function** — Template pixel grids live in the AI system prompt and require redeployment to change. They are also brittle: any AI hallucination produces misaligned output.

## Goal

Templates should feel like **structured forms**:
- A frame defines the template container (title, dimensions)
- Inside: labeled section headers (editable text) + blank sticky note fields (editable input areas)
- The whole frame appears at the user's **current viewport center** — never at a hardcoded corner
- Known templates are **client-side** (no edge function redeploy to add/change them)
- Freeform AI prompts still work, but now place objects **near the viewport**

---

## Approach: Hybrid (Client Registry + Simplified AI)

### Known templates → Client-side registry
Four templates (`swot`, `pros-cons`, `user-journey`, `retrospective`) are defined as pure TypeScript data specs. The AI only detects *which* template the user wants and returns `{ action: 'applyTemplate', templateId: '...' }`. The client instantiates the template at viewport center. No layout math in the AI.

### Freeform prompts → AI with viewport anchor
For requests that don't match a known template, the AI still returns `createObject` commands. The user's `viewportCenter` is injected into the user message so the AI can place objects near where the user is looking instead of at pixel 100,100.

---

## Architecture

### New file: `src/features/workspace/lib/templateRegistry.ts`

Defines `TemplateObjectSpec` and `TemplateSpec` interfaces, and exports `TEMPLATE_REGISTRY: Record<string, TemplateSpec>`.

```typescript
interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky'
  relLeft: number      // offset from frame top-left
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string        // label text or hint text for sticky fields
  fontSize?: number
  isLabel?: boolean    // true = non-editable section header label
}

interface TemplateSpec {
  id: string
  frameTitle: string
  frameWidth: number
  frameHeight: number
  objects: TemplateObjectSpec[]
}
```

Each template function is pure — no I/O, no canvas calls. Layout is computed once at definition time.

#### Template: `pros-cons`
- Frame: 540 × 460, title "Pros & Cons"
- 2 section header labels: "Pros" (green), "Cons" (red)
- 2 section background rects
- 3 sticky note fields per column (6 total)

#### Template: `swot`
- Frame: 560 × 500, title "SWOT Analysis"
- 4 section background rects (2×2 grid)
- 4 editable section header text objects (Strengths / Weaknesses / Opportunities / Threats)
- 4 large sticky note fields (one per quadrant)

#### Template: `user-journey`
- Frame: 980 × 380, title "User Journey"
- 5 stage header stickies (horizontal row)
- 5 body sticky note fields below headers

#### Template: `retrospective`
- Frame: 740 × 460, title "Retrospective"
- 3 column header stickies (What Went Well / What Didn't / Action Items)
- 3 body sticky note fields

---

### Modified: `executeAiCommands.ts`

New `applyTemplate` branch in the command loop:

```typescript
} else if (cmd.action === 'applyTemplate') {
  const center = options.getViewportCenter?.() ?? { x: 400, y: 300 }
  const spec = TEMPLATE_REGISTRY[cmd.templateId]
  if (!spec || !options.createFrame) break

  // Frame placed so its center aligns with viewport center
  const frameLeft = center.x - spec.frameWidth / 2
  const frameTop  = center.y - spec.frameHeight / 2

  // 1. Create frame first
  options.createFrame({
    title: spec.frameTitle,
    childIds: [],          // populated after children are created
    left: frameLeft,
    top: frameTop,
    width: spec.frameWidth,
    height: spec.frameHeight,
  })

  // 2. Create all child objects at absolute = frameLeft + relLeft
  for (const obj of spec.objects) {
    const objectId = await createObject(boardId, obj.type, {
      left: frameLeft + obj.relLeft,
      top:  frameTop  + obj.relTop,
      width: obj.width,
      height: obj.height,
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWeight: obj.strokeWeight,
      text: obj.text,
      fontSize: obj.fontSize,
    }, { zIndex: baseZ + createIndex })
    createdIds.push(objectId)
    createIndex++
  }
  // Frame childIds updated via boardSync auto-capture (checkAndUpdateFrameMembership)
}
```

Frame is created **first**, children are positioned relative to `frameLeft`/`frameTop`. The existing `checkAndUpdateFrameMembership` in `boardSync.ts` auto-captures children into the frame's `childIds` when objects are added inside its bounds — no manual wiring needed.

---

### Modified: `aiInterpretApi.ts`

Add to `AiCommand` union:

```typescript
| { action: 'applyTemplate'; templateId: string }
```

---

### Modified: `AiPromptBar.tsx`

New prop:

```typescript
interface AiPromptBarProps {
  // ...existing...
  getViewportCenter?: () => { x: number; y: number }
}
```

Passed into `ExecuteAiOptions` and also forwarded to `invokeAiInterpret` so freeform requests include viewport context.

---

### Modified: `aiInterpretApi.ts` → `invokeAiInterpret`

Pass `viewportCenter` in the request body:

```typescript
export interface AiInterpretOptions {
  selectedObjectIds?: string[]
  viewportCenter?: { x: number; y: number }
}
```

Edge function injects it into the user message:

```
User viewport center: x=1420, y=880. Place any new objects near this point.
```

---

### Modified: `FabricCanvas.tsx` — `FabricCanvasZoomHandle`

New method on the imperative handle:

```typescript
getViewportCenter(): { x: number; y: number }
```

Implementation:

```typescript
getViewportCenter: () => {
  const vpt = fabricCanvas.viewportTransform
  const zoom = fabricCanvas.getZoom()
  return {
    x: (width / 2 - vpt[4]) / zoom,
    y: (height / 2 - vpt[5]) / zoom,
  }
}
```

---

### Modified: `WorkspacePage.tsx`

Pass `getViewportCenter` from canvas ref to `AiPromptBar`:

```tsx
<AiPromptBar
  boardId={boardId}
  getSelectedObjectIds={...}
  createFrame={...}
  getViewportCenter={() => canvasZoomRef.current?.getViewportCenter() ?? { x: 400, y: 300 }}
/>
```

---

### Modified: `supabase/functions/ai-interpret/index.ts`

System prompt simplified — **remove all hardcoded pixel template layouts**. Replace with:

```
TEMPLATE DETECTION — when the user asks for a known template, return a single command:
{ "action": "applyTemplate", "templateId": "swot"|"pros-cons"|"user-journey"|"retrospective" }
The client handles all layout. Do NOT emit createObject commands for template requests.

VIEWPORT — the user message may include "User viewport center: x=N, y=M".
For freeform draw requests, place objects near those coordinates.
```

The system prompt shrinks significantly. Template matching is now just intent detection, not layout generation.

---

## Data Flow (Template Request)

```
User: "Create a SWOT analysis"
  → invokeAiInterpret (viewportCenter: {x:1200, y:650})
    → Edge Function → GPT detects template intent
    → returns { commands: [{ action: 'applyTemplate', templateId: 'swot' }] }
  → executeAiCommands
    → applyTemplate handler
    → looks up TEMPLATE_REGISTRY['swot']
    → calls options.createFrame({ left: 920, top: 400, w:560, h:500, ... })
    → creates 8 child objects with absolute coords = frameLeft + relLeft
    → boardSync auto-captures children into frame.childIds
  → Canvas: frame appears centered on viewport with 4 quadrants + editable fields
```

## Data Flow (Freeform Request)

```
User: "Draw a blue circle"
  → invokeAiInterpret (viewportCenter: {x:1200, y:650})
    → Edge Function user message: "Draw a blue circle\nUser viewport center: x=1200, y=650"
    → GPT returns createObject near (1200, 650)
  → executeAiCommands → createObject at viewport-relative position
```

---

## What Doesn't Change

- Frame architecture (`frameFactory.ts`, `frameUtils.ts`, `boardSync.ts`) — unchanged
- `createFrame` prop/callback on `AiPromptBar` — unchanged
- `groupCreated` / legacy path — unchanged (still supported for backward compat)
- All existing sync, locking, presence — unchanged

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/features/workspace/lib/templateRegistry.ts` | **New** | 4 template specs |
| `src/features/workspace/lib/executeAiCommands.ts` | Modified | `applyTemplate` handler |
| `src/features/workspace/api/aiInterpretApi.ts` | Modified | `applyTemplate` in union; `viewportCenter` in options |
| `src/features/workspace/components/AiPromptBar.tsx` | Modified | `getViewportCenter` prop |
| `src/features/workspace/pages/WorkspacePage.tsx` | Modified | Pass `getViewportCenter` from ref |
| `src/features/workspace/components/FabricCanvas.tsx` | Modified | `getViewportCenter` on handle |
| `supabase/functions/ai-interpret/index.ts` | Modified | Simplified system prompt |

---

## Success Criteria

1. "Create a SWOT analysis" → frame appears centered on current viewport with 4 quadrants, each containing an editable text field
2. Running the same template twice → two separate frames at viewport center (second one slightly offset or stacked, easily moved)
3. "Draw a blue circle" → circle appears near current viewport center, not at pixel 100,100
4. All four templates render correctly with section labels and editable sticky fields
5. Edge function system prompt is ≤ 40 lines (down from ~80)
6. TypeScript compiles clean; no linter errors
