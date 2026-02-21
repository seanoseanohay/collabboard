# Expedition Map v2 — Rich Multi-Scale Map Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the expedition map from simple ellipses into a rich, immersive pirate world with procedural coastlines (irregular polygons), AI-generated place names, treasure markers, detailed harbor/town layouts, and significantly more content at each zoom level — making the multi-scale zoom experience feel alive and explorable.

**Architecture:** The map generator (`expeditionMapGenerator.ts`) produces `MapObjectSpec[]` that `populateExpeditionMap` in `FabricCanvas.tsx` creates on the Fabric canvas. This plan extends `MapObjectSpec` to support `'polygon'` and `'path'` types, adds a noise-based coastline generator, adds a post-generation AI enrichment call to replace procedural names with creative ones, and fills each scale band with 3–5x more content. The coordinate system is re-centered at (0, 0) spanning roughly -10M to +10M.

**Tech Stack:** TypeScript, Fabric.js v7 (`Polygon`, `Polyline`, `Path`, `Ellipse`, `Rect`, `IText`), seeded Perlin noise for coastlines, Supabase Edge Function (`ai-interpret`) for name enrichment, OpenAI gpt-4o-mini.

---

## Reference Files

Read these before starting each task:

- `src/features/workspace/lib/expeditionMapGenerator.ts` — current generator (to be rewritten)
- `src/features/workspace/lib/expeditionThemes.ts` — theme data (to be extended)
- `src/features/workspace/lib/scaleBands.ts` — scale band definitions (no change)
- `src/features/workspace/components/FabricCanvas.tsx` — `populateExpeditionMap` in `useImperativeHandle` (~line 908)
- `src/features/workspace/components/WorkspacePage.tsx` — trigger useEffect (~line 146)
- `src/features/workspace/api/aiInterpretApi.ts` — `invokeAiInterpret`, `AiInterpretResponse`
- `supabase/functions/ai-interpret/index.ts` — Edge Function system prompt + handler
- `src/features/workspace/lib/fabricCanvasZoom.ts` — `MIN_ZOOM = 0.00001`, `MAX_ZOOM = 10`

---

## Parallel Execution Guide

| Group | Tasks | Notes |
|-------|-------|-------|
| **A** (foundation) | 1, 2 | Re-center coords + extend MapObjectSpec + coastline noise. Must be first. Tasks 1 and 2 can run in parallel. |
| **B** (content richness) | 3, 4, 5 | Treasure markers, harbor detail, voyage detail. All modify `expeditionMapGenerator.ts` — run sequentially. |
| **C** (AI enrichment) | 6 | Background AI name generation. Independent of B. Can run in parallel with B. |
| **D** (polish) | 7 | Final tuning, theme extension, testing. Run last. |

---

## Current Scale Bands (no change)

| Band | Zoom range | What's visible |
|------|-----------|----------------|
| 🌊 Ocean | 0–0.01% | Continents, ocean labels |
| ⛵ Voyage | 0.01–0.1% | Islands, regions, sea routes |
| ⚓ Harbor | 0.1–1% | Towns, docks, harbors, paths |
| 🏴‍☠️ Deck | 1–10% | Landmarks, treasure X's, buildings |
| 🔭 Spyglass | 10%+ | User workspace (stickies, shapes) |

---

## Task 1: Re-Center Coordinate System + Extend MapObjectSpec

**Files:**
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`
- Modify: `src/features/workspace/components/FabricCanvas.tsx`

**Goal:** Center the map world at (0, 0) spanning -10M to +10M on both axes. Extend `MapObjectSpec.type` to support `'polygon'` and `'polyline'` for coastline and path shapes.

**Step 1: Update `MapObjectSpec` in `expeditionMapGenerator.ts`**

```ts
export interface MapObjectSpec {
  type: 'rect' | 'ellipse' | 'text' | 'polygon' | 'polyline'
  left: number
  top: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  text?: string
  fontSize?: number
  minZoom?: number
  maxZoom?: number
  // For polygon/polyline types:
  points?: Array<{ x: number; y: number }>
  strokeDashArray?: number[]
}
```

**Step 2: Update constants**

```ts
const MAP_HALF = 10_000_000      // ±10M
const MAP_WIDTH = MAP_HALF * 2   // 20M total
const MAP_HEIGHT = MAP_HALF * 2  // 20M total
```

All object placement uses coordinates from `-MAP_HALF` to `+MAP_HALF`. The `viewportCenter` becomes `{ x: 0, y: 0 }`.

**Step 3: Update `populateExpeditionMap` in `FabricCanvas.tsx`**

Add polygon and polyline handlers:

```ts
} else if (spec.type === 'polygon' && spec.points) {
  obj = new Polygon(spec.points, {
    fill: spec.fill ?? '#e5e7eb',
    stroke: spec.stroke ?? '#374151',
    strokeWidth: spec.strokeWidth ?? 1,
    originX: 'left',
    originY: 'top',
  })
} else if (spec.type === 'polyline' && spec.points) {
  obj = new Polyline(spec.points, {
    fill: 'transparent',
    stroke: spec.stroke ?? '#374151',
    strokeWidth: spec.strokeWidth ?? 1,
    strokeDashArray: spec.strokeDashArray,
    originX: 'left',
    originY: 'top',
  })
}
```

Add `Polygon` and `Polyline` to Fabric imports if not already imported.

**Acceptance criteria:**
- [ ] Map world centered at (0, 0), extents roughly ±10M
- [ ] MapObjectSpec supports 'polygon' and 'polyline' types with `points` array
- [ ] `populateExpeditionMap` creates Polygon and Polyline Fabric objects from specs
- [ ] Existing ellipse/rect/text types still work
- [ ] TypeScript: 0 errors

---

## Task 2: Procedural Coastline Generator (Perlin Noise)

**Files:**
- New: `src/features/workspace/lib/noiseCoastline.ts`
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`

**Goal:** Replace continent ellipses with irregular polygon coastlines generated using a simple noise function. Each continent looks like a natural landmass with bays, peninsulas, and craggy edges.

**Step 1: Create `noiseCoastline.ts`**

Implement a simple 1D value noise function (seeded, deterministic) and a coastline polygon generator:

```ts
/**
 * Generates an irregular polygon simulating a landmass coastline.
 * Uses radial distortion: starts from an ellipse center, casts rays at
 * equal angles, and varies the radius using layered noise.
 *
 * @param cx - center x
 * @param cy - center y
 * @param baseRx - base horizontal radius
 * @param baseRy - base vertical radius
 * @param rng - seeded random function (0–1)
 * @param vertexCount - number of vertices (more = smoother, 60–120 recommended)
 * @returns Array of {x, y} points forming a closed polygon
 */
export function generateCoastline(
  cx: number,
  cy: number,
  baseRx: number,
  baseRy: number,
  rng: () => number,
  vertexCount = 80,
): Array<{ x: number; y: number }> {
  // Pre-generate noise table for this coastline
  const noiseTable = Array.from({ length: 256 }, () => rng() * 2 - 1)
  const noise = (t: number): number => {
    const i = Math.floor(t) & 255
    const f = t - Math.floor(t)
    const smooth = f * f * (3 - 2 * f) // smoothstep
    return noiseTable[i] * (1 - smooth) + noiseTable[(i + 1) & 255] * smooth
  }

  // Layer multiple octaves for natural look
  const fbm = (t: number): number => {
    return noise(t * 2) * 0.5 + noise(t * 4) * 0.25 + noise(t * 8) * 0.125
  }

  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2
    const noiseVal = fbm(i * 1.7 + rng() * 0.3) // offset per-continent via rng
    const radiusScale = 0.7 + noiseVal * 0.6      // vary radius 40%–100%
    const rx = baseRx * radiusScale
    const ry = baseRy * radiusScale
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    })
  }

  return points
}
```

The key: we cast `vertexCount` rays from the center at equal angles, but each ray's length is modulated by layered noise. This creates natural-looking bays and peninsulas.

**Step 2: Replace continent ellipses in `expeditionMapGenerator.ts`**

Instead of:
```ts
objects.push({ type: 'ellipse', left: x, top: y, width: w, height: h, ... })
```

Do:
```ts
const coastlinePoints = generateCoastline(
  x + w / 2,      // center x
  y + h / 2,      // center y
  w / 2,           // rx
  h / 2,           // ry
  rng,
  80,              // vertex count
)

objects.push({
  type: 'polygon',
  left: x, top: y, width: w, height: h,
  points: coastlinePoints,
  fill: theme.landFills[i % theme.landFills.length],
  stroke: '#8b7355',
  strokeWidth: 100_000,
  minZoom: 0, maxZoom: 0.0001,
})
```

Do the same for islands at Voyage scale (with fewer vertices, ~40–60).

**Acceptance criteria:**
- [ ] Continents render as irregular polygons, not ellipses
- [ ] Islands also render as irregular polygons
- [ ] Coastlines look natural — bays, peninsulas, not perfectly smooth
- [ ] Each continent has a unique shape (different rng sequences)
- [ ] Performance: generating 5 coastlines with 80 vertices each is <10ms
- [ ] TypeScript: 0 errors

---

## Task 3: Treasure Markers + X Marks the Spot

**Files:**
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`
- Modify: `src/features/workspace/lib/expeditionThemes.ts`

**Goal:** Scatter treasure markers across the map at Deck scale. Each treasure is a red "✕" text with a gold parchment rect behind it and a label.

**Step 1: Add treasure names to themes**

Add to `ExpeditionTheme`:

```ts
treasureNames: string[]
```

Add to each theme 6–8 entries, e.g. for Pirate Seas:
```ts
treasureNames: [
  "Blackbeard's Bounty", "The Lost Doubloons", "Captain Kidd's Cache",
  "Chest of the Damned", "The Siren's Gold", "Pieces of Eight Hoard",
  "The Phantom's Fortune", "Dead Man's Stash",
],
```

**Step 2: Generate treasure markers in `expeditionMapGenerator.ts`**

At Deck scale (minZoom: 0.005), per continent, place 2–3 treasures:

```ts
// ── Deck scale: treasure markers (visible zoom 0.005+) ──
for (const continent of continents) {
  const treasureCount = 2 + Math.floor(rng() * 2) // 2–3 per continent
  for (let t = 0; t < treasureCount; t++) {
    const tx = continent.cx + (rng() - 0.5) * continent.w * 0.6
    const ty = continent.cy + (rng() - 0.5) * continent.h * 0.6
    const name = theme.treasureNames[Math.floor(rng() * theme.treasureNames.length)]

    // Parchment background
    objects.push({
      type: 'rect', left: tx - 2000, top: ty - 1500, width: 6000, height: 4000,
      fill: '#f5e6c8', stroke: '#8b6914', strokeWidth: 150,
      minZoom: 0.005,
    })

    // Red X
    objects.push({
      type: 'text', left: tx - 1200, top: ty - 1400,
      width: 2400, height: 2400,
      text: '✕', fontSize: 3000, fill: '#dc2626',
      minZoom: 0.005,
    })

    // Treasure name label
    objects.push({
      type: 'text', left: tx - 1500, top: ty + 1200,
      width: 5000, height: 1500,
      text: name, fontSize: 800, fill: '#4a3728',
      minZoom: 0.008,
    })
  }
}
```

Also generate a dashed polyline "treasure trail" from the nearest town to each treasure:

```ts
// Dashed trail from nearest town to treasure
if (nearestTown) {
  objects.push({
    type: 'polyline',
    left: 0, top: 0, width: 0, height: 0,
    points: [
      { x: nearestTown.x + nearestTown.w / 2, y: nearestTown.y + nearestTown.h / 2 },
      // 2–3 intermediate waypoints with slight randomness
      { x: (nearestTown.x + tx) / 2 + (rng() - 0.5) * 5000, y: (nearestTown.y + ty) / 2 + (rng() - 0.5) * 5000 },
      { x: tx, y: ty },
    ],
    stroke: '#8b6914', strokeWidth: 100,
    strokeDashArray: [500, 300],
    minZoom: 0.005,
  })
}
```

**Acceptance criteria:**
- [ ] 2–3 treasure markers per continent at Deck scale
- [ ] Each treasure: gold parchment rect + red ✕ + name label
- [ ] Dashed trail polylines connecting towns to treasures
- [ ] Treasure names from theme data
- [ ] TypeScript: 0 errors

---

## Task 4: Rich Harbor-Scale Detail (Towns, Docks, Paths)

**Files:**
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`

**Goal:** When zoomed to Harbor scale (0.1%–1%), towns should feel like actual places — a central rect, surrounding buildings, a dock extending into "water", connecting paths between towns, and a compass rose.

**Step 1: Replace simple town rects with town layouts**

Each town becomes a cluster of 5–10 objects:

```ts
function generateTownLayout(
  cx: number, cy: number,
  name: string,
  rng: () => number,
  theme: ExpeditionTheme,
): MapObjectSpec[] {
  const specs: MapObjectSpec[] = []
  const tw = 40_000 + rng() * 30_000
  const th = 35_000 + rng() * 25_000

  // Town wall / boundary
  specs.push({
    type: 'rect', left: cx - tw / 2, top: cy - th / 2, width: tw, height: th,
    fill: '#f5f0e1', stroke: '#8b7355', strokeWidth: 800,
    minZoom: 0.0005, maxZoom: 0.01,
  })

  // Town name (large, visible from further out)
  specs.push({
    type: 'text', left: cx - tw * 0.4, top: cy - th * 0.6,
    width: tw * 0.8, height: th * 0.15,
    text: name, fontSize: 20_000, fill: '#2d1a0e',
    minZoom: 0.0005, maxZoom: 0.01,
  })

  // 3–6 building rects inside the town
  const buildingCount = 3 + Math.floor(rng() * 4)
  for (let b = 0; b < buildingCount; b++) {
    const bw = 3000 + rng() * 5000
    const bh = 2500 + rng() * 4000
    const bx = cx - tw * 0.35 + rng() * tw * 0.6
    const by = cy - th * 0.3 + rng() * th * 0.5
    specs.push({
      type: 'rect', left: bx, top: by, width: bw, height: bh,
      fill: '#e8dcc8', stroke: '#6b5b47', strokeWidth: 200,
      minZoom: 0.001, maxZoom: 0.01,
    })
  }

  // Dock extending from town edge (thin rect)
  const dockSide = rng() > 0.5 ? 1 : -1
  specs.push({
    type: 'rect',
    left: cx + (dockSide > 0 ? tw / 2 : -tw / 2 - 15_000),
    top: cy - 2000,
    width: 15_000, height: 4000,
    fill: '#c4a882', stroke: '#6b5b47', strokeWidth: 300,
    minZoom: 0.0008, maxZoom: 0.01,
  })

  // Dock label
  specs.push({
    type: 'text',
    left: cx + (dockSide > 0 ? tw / 2 + 1000 : -tw / 2 - 14_000),
    top: cy + 3000,
    width: 12_000, height: 3000,
    text: '⚓ Docks', fontSize: 3000, fill: '#4a86b8',
    minZoom: 0.001, maxZoom: 0.008,
  })

  return specs
}
```

**Step 2: Add paths between towns**

After all towns are generated for a continent, connect adjacent towns with path polylines:

```ts
// Paths between towns (visible at Harbor scale)
for (let i = 0; i < towns.length - 1; i++) {
  const a = towns[i]
  const b = towns[i + 1]
  const midX = (a.cx + b.cx) / 2 + (rng() - 0.5) * 20_000
  const midY = (a.cy + b.cy) / 2 + (rng() - 0.5) * 20_000
  objects.push({
    type: 'polyline',
    left: 0, top: 0, width: 0, height: 0,
    points: [
      { x: a.cx, y: a.cy },
      { x: midX, y: midY },
      { x: b.cx, y: b.cy },
    ],
    stroke: '#a08060', strokeWidth: 500,
    strokeDashArray: [2000, 1000],
    minZoom: 0.0008, maxZoom: 0.01,
  })
}
```

**Step 3: Add a compass rose at Harbor scale**

Place one compass rose per map (a text "🧭" + directional labels):

```ts
objects.push({
  type: 'text', left: 0, top: 0,
  width: 10_000, height: 10_000,
  text: '🧭', fontSize: 8000,
  minZoom: 0.001, maxZoom: 0.008,
})
// N/S/E/W labels around it
```

**Acceptance criteria:**
- [ ] Towns are clusters of 5–10 objects (wall, buildings, dock, labels)
- [ ] Dashed paths connect adjacent towns within a continent
- [ ] Compass rose visible at Harbor scale
- [ ] ~3–4 towns per continent (bumped from 2–3)
- [ ] Object count at Harbor scale: ~50–80 objects total across all continents
- [ ] TypeScript: 0 errors

---

## Task 5: Rich Voyage-Scale Detail (Sea Routes, Region Labels)

**Files:**
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`

**Goal:** At Voyage scale (0.01%–0.1%), beyond just islands, add sea route lines between continents, "Here Be Dragons" warning labels, sea creature emoji markers, and coastal fortress outposts.

**Step 1: Sea routes between continents**

```ts
// ── Voyage scale: sea routes between continents ──
for (let i = 0; i < continents.length - 1; i++) {
  const a = continents[i]
  const b = continents[i + 1]
  // Dashed blue polyline from continent center to continent center
  // With 2–3 waypoints for a curved route
  objects.push({
    type: 'polyline',
    left: 0, top: 0, width: 0, height: 0,
    points: [
      { x: a.cx, y: a.cy },
      { x: (a.cx + b.cx) / 2 + (rng() - 0.5) * 2_000_000, y: (a.cy + b.cy) / 2 + (rng() - 0.5) * 2_000_000 },
      { x: b.cx, y: b.cy },
    ],
    stroke: '#4a86b8', strokeWidth: 20_000,
    strokeDashArray: [100_000, 60_000],
    minZoom: 0.00005, maxZoom: 0.001,
  })
}
```

**Step 2: Sea creature / warning markers**

Scatter 4–6 emoji text markers in open ocean areas:

```ts
const SEA_CREATURES = ['🐙', '🦑', '🐋', '🦈', '🐉', '⚠️']
for (let i = 0; i < 5; i++) {
  objects.push({
    type: 'text',
    left: -MAP_HALF * 0.8 + rng() * MAP_WIDTH * 0.8,
    top: -MAP_HALF * 0.8 + rng() * MAP_HEIGHT * 0.8,
    width: 500_000, height: 500_000,
    text: SEA_CREATURES[i % SEA_CREATURES.length],
    fontSize: 400_000,
    minZoom: 0.00008, maxZoom: 0.0005,
  })
}
```

**Step 3: Coastal outposts on islands**

For 30% of islands, add a small fortress marker:

```ts
if (rng() < 0.3) {
  objects.push({
    type: 'rect', left: ix + iw * 0.3, top: iy + ih * 0.3,
    width: iw * 0.2, height: ih * 0.2,
    fill: '#d4c5a0', stroke: '#6b5b47', strokeWidth: 5000,
    minZoom: 0.0002, maxZoom: 0.001,
  })
  objects.push({
    type: 'text', left: ix + iw * 0.3, top: iy + ih * 0.55,
    width: iw * 0.4, height: ih * 0.1,
    text: '🏰 Outpost', fontSize: 60_000, fill: '#4a3728',
    minZoom: 0.0002, maxZoom: 0.0008,
  })
}
```

**Acceptance criteria:**
- [ ] Dashed sea routes connect adjacent continents
- [ ] 4–6 sea creature / warning emoji scattered in open ocean
- [ ] ~30% of islands have fortress outposts
- [ ] Object count at Voyage scale: ~30–50 additional objects
- [ ] TypeScript: 0 errors

---

## Task 6: AI Name Enrichment (Background)

**Files:**
- Modify: `src/features/workspace/components/WorkspacePage.tsx`
- Modify: `src/features/workspace/api/aiInterpretApi.ts`

**Goal:** After the procedural map is generated, fire a background AI call to generate unique creative names. Then update the text objects on the canvas with those names. Fire-and-forget — the map is already usable with procedural names.

**Step 1: Add `enrichExpeditionNames` function**

In a new file or in `WorkspacePage.tsx`:

```ts
async function enrichExpeditionNames(
  boardId: string,
  themeName: string,
  canvasRef: React.RefObject<FabricCanvasZoomHandle>,
): Promise<void> {
  try {
    const response = await invokeAiInterpret(boardId, `
Generate unique pirate-themed place names for an expedition map (theme: ${themeName}).
Return ONLY valid JSON, no markdown:
{
  "continents": ["name1", "name2", "name3", "name4", "name5"],
  "islands": ["name1", "name2", "name3", "name4", "name5", "name6", "name7", "name8"],
  "oceans": ["name1", "name2", "name3"],
  "towns": ["name1", "name2", "name3", "name4", "name5", "name6"],
  "landmarks": ["name1", "name2", "name3", "name4", "name5"],
  "treasures": ["name1", "name2", "name3", "name4", "name5", "name6"]
}
Each name should be evocative and unique. Mix English with invented words.
    `.trim())

    if (response.source !== 'api') return
    // Parse the JSON from the first command's response or from the raw text
    // Then iterate canvas objects and update text where data.mapRole matches
  } catch {
    // Silently fail — procedural names are fine
  }
}
```

**Step 2: Tag generated text objects with `data.mapRole`**

In `expeditionMapGenerator.ts`, add a `mapRole` field to `MapObjectSpec`:

```ts
mapRole?: 'continent-name' | 'island-name' | 'ocean-name' | 'town-name' | 'landmark-name' | 'treasure-name'
```

Set it on each text label so the AI enrichment can find and replace them.

In `populateExpeditionMap`, copy `mapRole` into the object's `data`.

**Step 3: Apply AI names to canvas objects**

After the AI response returns, iterate all canvas objects, find ones with matching `data.mapRole`, and update their text:

```ts
const canvas = canvasRef.current?.getCanvas?.() // or iterate via Fabric methods
for (const obj of canvas.getObjects()) {
  const data = obj.get('data') as Record<string, unknown>
  if (data?.mapRole === 'continent-name' && aiNames.continents.length > 0) {
    (obj as IText).set('text', aiNames.continents.shift()!)
  }
  // ... same for island-name, ocean-name, town-name, etc.
}
canvas.requestRenderAll()
```

**Step 4: Trigger in WorkspacePage**

After `populateExpeditionMap(map)`, fire the enrichment:

```ts
mapGeneratedRef.current = true
const theme = EXPEDITION_THEMES[0]
const map = generateExpeditionMap(theme)
canvasZoomRef.current.populateExpeditionMap(map)

// Background AI enrichment (fire-and-forget)
enrichExpeditionNames(board.id, theme.name, canvasZoomRef).catch(() => {})
```

**Acceptance criteria:**
- [ ] After map generation, a background AI call generates creative names
- [ ] AI names replace procedural names on the canvas (~2–5s after generation)
- [ ] If AI call fails, procedural names remain (no error shown to user)
- [ ] Text objects are tagged with `data.mapRole` for matching
- [ ] No UI loading state needed — it's fire-and-forget
- [ ] TypeScript: 0 errors

---

## Task 7: Polish, Theme Extension, Testing

**Files:**
- Modify: `src/features/workspace/lib/expeditionThemes.ts`
- Modify: `src/features/workspace/lib/expeditionMapGenerator.ts`
- Modify: `src/features/workspace/components/WorkspacePage.tsx`

**Goal:** Add `treasureNames` to all 3 themes. Verify the full experience works end-to-end. Tune object visibility ranges so transitions between scale bands feel smooth (objects from adjacent bands overlap slightly). Update memory bank.

**Step 1: Extend all themes with `treasureNames`**

Add 6–8 treasure names per theme (if not done in Task 3).

**Step 2: Visibility range tuning**

Objects should slightly overlap between adjacent bands so there's never a "dead zone" where nothing is visible. Each layer's objects should fade in slightly before the band starts and fade out slightly after:

- Ocean objects: minZoom 0, maxZoom 0.00012 (slight overlap into Voyage)
- Voyage objects: minZoom 0.00008, maxZoom 0.0012 (overlap into both)
- Harbor objects: minZoom 0.0008, maxZoom 0.012
- Deck objects: minZoom 0.008, no maxZoom

**Step 3: Final object count audit**

Target total object count per generated map:

| Scale | Objects | Content |
|-------|---------|---------|
| Ocean | 12–20 | Continent polygons + labels, ocean labels |
| Voyage | 30–50 | Island polygons + labels, sea routes, sea creatures, outposts |
| Harbor | 50–80 | Town layouts (wall + buildings + dock + labels), paths, compass |
| Deck | 20–40 | Landmarks, treasure markers (rect + ✕ + label + trail) |
| **Total** | **~120–190** | |

**Step 4: Update memory bank**

Update `NEXT_AGENT_START_HERE.md`, `activeContext.md`, and `progress.md` with:
- Expedition Map v2 complete
- Procedural coastlines (noise-based polygon generation)
- AI name enrichment (background, fire-and-forget)
- Rich multi-scale content (~120–190 objects)
- Treasure markers with dashed trails
- Town layouts with buildings and docks
- Sea routes and creature markers

**Acceptance criteria:**
- [ ] All 3 themes have `treasureNames` populated
- [ ] No dead zones between scale bands (overlap tuned)
- [ ] Total object count per map: ~120–190
- [ ] Full experience: zoom from 0.002% to 10%+ with content at every level
- [ ] Memory bank updated
- [ ] TypeScript: 0 errors, all tests pass

---

## Summary

| Task | What | Effort | Group |
|------|------|--------|-------|
| 1 | Re-center coords + extend MapObjectSpec (polygon/polyline) | ~2 hrs | A |
| 2 | Procedural coastline generator (noise polygons) | ~3 hrs | A |
| 3 | Treasure markers + X marks the spot + dashed trails | ~2 hrs | B |
| 4 | Rich Harbor-scale detail (town layouts, docks, paths) | ~3 hrs | B |
| 5 | Rich Voyage-scale detail (sea routes, creatures, outposts) | ~2 hrs | B |
| 6 | AI name enrichment (background Edge Function call) | ~3 hrs | C |
| 7 | Polish, theme extension, testing, memory bank | ~2 hrs | D |
| **Total** | | **~17 hrs** | |
