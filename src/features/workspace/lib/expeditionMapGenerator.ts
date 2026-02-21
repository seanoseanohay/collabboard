import type { ExpeditionTheme } from './expeditionThemes'
import { generateCoastline } from './noiseCoastline'

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
  // For polygon / polyline types:
  points?: Array<{ x: number; y: number }>
  strokeDashArray?: number[]
  // Semantic role for AI name enrichment:
  mapRole?: 'continent-name' | 'island-name' | 'ocean-name' | 'town-name' | 'landmark-name' | 'treasure-name'
}

export interface GeneratedMap {
  objects: MapObjectSpec[]
  viewportCenter: { x: number; y: number }
  initialZoom: number
}

// Map world centered at (0,0), ±10M on each axis
const MAP_HALF = 10_000_000
const MAP_WIDTH = MAP_HALF * 2
const MAP_HEIGHT = MAP_HALF * 2

export function generateExpeditionMap(theme: ExpeditionTheme, seed?: number): GeneratedMap {
  const rng = seededRandom(seed ?? Date.now())
  const objects: MapObjectSpec[] = []

  // ── Ocean scale: continents (visible zoom 0 → 0.00012) ──
  const continentCount = 3 + Math.floor(rng() * 3)
  const continents: Array<{ cx: number; cy: number; w: number; h: number }> = []

  for (let i = 0; i < continentCount; i++) {
    const w = 3_000_000 + rng() * 5_000_000
    const h = 2_500_000 + rng() * 4_000_000
    const cx = -MAP_HALF * 0.7 + rng() * MAP_WIDTH * 0.7
    const cy = -MAP_HALF * 0.7 + rng() * MAP_HEIGHT * 0.7
    continents.push({ cx, cy, w, h })

    // Continent shape — irregular coastline polygon
    const coastlinePoints = generateCoastline(cx, cy, w / 2, h / 2, rng, 80)
    objects.push({
      type: 'polygon',
      left: cx - w / 2, top: cy - h / 2,
      width: w, height: h,
      points: coastlinePoints,
      fill: theme.landFills[i % theme.landFills.length],
      stroke: '#8b7355', strokeWidth: 30_000,
      minZoom: 0, maxZoom: 0.00012,
    })

    // Continent name
    objects.push({
      type: 'text',
      left: cx - w * 0.3, top: cy - h * 0.1,
      width: w * 0.6, height: h * 0.25,
      text: theme.continentNames[i % theme.continentNames.length],
      fontSize: 700_000, fill: '#4a3728',
      minZoom: 0, maxZoom: 0.00010,
      mapRole: 'continent-name',
    })
  }

  // Ocean labels (3 scattered in open water)
  for (let i = 0; i < 3; i++) {
    objects.push({
      type: 'text',
      left: -MAP_HALF * 0.8 + rng() * MAP_WIDTH * 0.8,
      top: -MAP_HALF * 0.8 + rng() * MAP_HEIGHT * 0.8,
      width: 6_000_000, height: 1_000_000,
      text: theme.oceanNames[i % theme.oceanNames.length],
      fontSize: 500_000, fill: '#4a86b8',
      minZoom: 0, maxZoom: 0.00010,
      mapRole: 'ocean-name',
    })
  }

  // ── Voyage scale: islands within continents (visible zoom 0.00008 → 0.0012) ──
  const allTowns: Array<{ cx: number; cy: number; continentIdx: number }> = []

  for (let ci = 0; ci < continents.length; ci++) {
    const continent = continents[ci]
    const islandCount = 3 + Math.floor(rng() * 4)

    for (let i = 0; i < islandCount; i++) {
      const iw = 150_000 + rng() * 500_000
      const ih = 120_000 + rng() * 400_000
      const ix = continent.cx + (rng() - 0.5) * continent.w * 0.7
      const iy = continent.cy + (rng() - 0.5) * continent.h * 0.7
      const name = theme.islandNames[Math.floor(rng() * theme.islandNames.length)]

      const islandPoints = generateCoastline(ix, iy, iw / 2, ih / 2, rng, 50)
      objects.push({
        type: 'polygon',
        left: ix - iw / 2, top: iy - ih / 2,
        width: iw, height: ih,
        points: islandPoints,
        fill: theme.landFills[Math.floor(rng() * theme.landFills.length)],
        stroke: '#8b7355', strokeWidth: 1_500,
        minZoom: 0.00008, maxZoom: 0.0012,
      })

      objects.push({
        type: 'text',
        left: ix - iw * 0.4, top: iy - ih * 0.7,
        width: iw * 0.8, height: ih * 0.25,
        text: name, fontSize: 80_000, fill: '#2d1a0e',
        minZoom: 0.00008, maxZoom: 0.0012,
        mapRole: 'island-name',
      })

      // Coastal outpost on ~30% of islands
      if (rng() < 0.3) {
        const ox = ix + iw * 0.1
        const oy = iy + ih * 0.1
        objects.push({
          type: 'rect',
          left: ox, top: oy,
          width: iw * 0.18, height: ih * 0.18,
          fill: '#d4c5a0', stroke: '#6b5b47', strokeWidth: 2_000,
          minZoom: 0.0002, maxZoom: 0.001,
        })
        objects.push({
          type: 'text',
          left: ox, top: oy + ih * 0.21,
          width: iw * 0.4, height: ih * 0.12,
          text: '🏰 Outpost', fontSize: 35_000, fill: '#4a3728',
          minZoom: 0.0002, maxZoom: 0.0008,
        })
      }

      // Town placement stored for later (harbor scale)
      allTowns.push({ cx: ix, cy: iy, continentIdx: ci })
    }
  }

  // ── Voyage scale: sea routes between continents ──
  for (let i = 0; i < continents.length - 1; i++) {
    const a = continents[i]
    const b = continents[i + 1]
    const midX = (a.cx + b.cx) / 2 + (rng() - 0.5) * 1_000_000
    const midY = (a.cy + b.cy) / 2 + (rng() - 0.5) * 1_000_000
    objects.push({
      type: 'polyline',
      left: 0, top: 0, width: 0, height: 0,
      points: [
        { x: a.cx, y: a.cy },
        { x: midX, y: midY },
        { x: b.cx, y: b.cy },
      ],
      stroke: '#4a86b8', strokeWidth: 10_000,
      strokeDashArray: [60_000, 35_000],
      minZoom: 0.00005, maxZoom: 0.001,
    })
  }

  // ── Voyage scale: sea creature / warning markers ──
  const SEA_CREATURES = ['🐙', '🦑', '🐋', '🦈', '🐉', '⚠️']
  for (let i = 0; i < 5; i++) {
    objects.push({
      type: 'text',
      left: -MAP_HALF * 0.75 + rng() * MAP_WIDTH * 0.75,
      top: -MAP_HALF * 0.75 + rng() * MAP_HEIGHT * 0.75,
      width: 300_000, height: 300_000,
      text: SEA_CREATURES[i % SEA_CREATURES.length],
      fontSize: 250_000,
      minZoom: 0.00008, maxZoom: 0.0005,
    })
  }

  // ── Harbor scale: town layouts (visible zoom 0.0008 → 0.012) ──
  // Pick 3–4 towns per continent from the island positions
  const usedTowns: Array<{ cx: number; cy: number; w: number; h: number }> = []

  for (let ci = 0; ci < continents.length; ci++) {
    const continentTowns = allTowns.filter((t) => t.continentIdx === ci)
    const townCount = Math.min(continentTowns.length, 2 + Math.floor(rng() * 2))

    for (let ti = 0; ti < townCount; ti++) {
      const town = continentTowns[ti]
      const name = theme.townNames[Math.floor(rng() * theme.townNames.length)]
      const tw = 20_000 + rng() * 20_000
      const th = 15_000 + rng() * 15_000

      usedTowns.push({ cx: town.cx, cy: town.cy, w: tw, h: th })

      // Town boundary wall
      objects.push({
        type: 'rect',
        left: town.cx - tw / 2, top: town.cy - th / 2,
        width: tw, height: th,
        fill: '#f5f0e1', stroke: '#8b7355', strokeWidth: 400,
        minZoom: 0.0008, maxZoom: 0.012,
      })

      // Town name
      objects.push({
        type: 'text',
        left: town.cx - tw * 0.4, top: town.cy - th * 0.65,
        width: tw * 0.8, height: th * 0.2,
        text: name, fontSize: 8_000, fill: '#2d1a0e',
        minZoom: 0.0008, maxZoom: 0.012,
        mapRole: 'town-name',
      })

      // 3–5 small building rects inside the town
      const buildingCount = 3 + Math.floor(rng() * 3)
      for (let b = 0; b < buildingCount; b++) {
        const bw = 1_500 + rng() * 2_500
        const bh = 1_200 + rng() * 2_000
        const bx = town.cx - tw * 0.35 + rng() * tw * 0.6
        const by = town.cy - th * 0.3 + rng() * th * 0.5
        objects.push({
          type: 'rect',
          left: bx, top: by, width: bw, height: bh,
          fill: '#e8dcc8', stroke: '#6b5b47', strokeWidth: 100,
          minZoom: 0.001, maxZoom: 0.012,
        })
      }

      // Dock extending from one side of the town
      const dockRight = rng() > 0.5
      objects.push({
        type: 'rect',
        left: dockRight ? town.cx + tw / 2 : town.cx - tw / 2 - 10_000,
        top: town.cy - 1_000,
        width: 10_000, height: 2_000,
        fill: '#c4a882', stroke: '#6b5b47', strokeWidth: 150,
        minZoom: 0.001, maxZoom: 0.012,
      })

      // Dock label
      objects.push({
        type: 'text',
        left: dockRight ? town.cx + tw / 2 + 500 : town.cx - tw / 2 - 9_500,
        top: town.cy + 2_000,
        width: 9_000, height: 2_500,
        text: '⚓ Docks', fontSize: 1_800, fill: '#4a86b8',
        minZoom: 0.002, maxZoom: 0.010,
      })
    }

    // Dashed paths between adjacent towns in this continent
    const contTownsList = usedTowns.slice(-townCount)
    for (let ti = 0; ti < contTownsList.length - 1; ti++) {
      const a = contTownsList[ti]
      const b = contTownsList[ti + 1]
      const midX = (a.cx + b.cx) / 2 + (rng() - 0.5) * 15_000
      const midY = (a.cy + b.cy) / 2 + (rng() - 0.5) * 15_000
      objects.push({
        type: 'polyline',
        left: 0, top: 0, width: 0, height: 0,
        points: [
          { x: a.cx, y: a.cy },
          { x: midX, y: midY },
          { x: b.cx, y: b.cy },
        ],
        stroke: '#a08060', strokeWidth: 300,
        strokeDashArray: [1_200, 600],
        minZoom: 0.001, maxZoom: 0.012,
      })
    }
  }

  // Compass rose at Harbor scale (centered near map origin)
  objects.push({
    type: 'text',
    left: -MAP_HALF * 0.4, top: MAP_HALF * 0.3,
    width: 6_000, height: 6_000,
    text: '🧭', fontSize: 4_000,
    minZoom: 0.001, maxZoom: 0.008,
  })

  // ── Deck scale: landmarks + treasure markers (visible zoom 0.008+) ──

  // Place landmarks within continent bounds
  for (let i = 0; i < Math.min(theme.landmarks.length, 5); i++) {
    const continent = continents[i % continents.length]
    const lx = continent.cx + (rng() - 0.5) * continent.w * 0.5
    const ly = continent.cy + (rng() - 0.5) * continent.h * 0.5
    const name = theme.landmarks[i]

    objects.push({
      type: 'rect',
      left: lx - 1_500, top: ly - 800,
      width: 4_000, height: 2_500,
      fill: '#fef08a', stroke: '#ca8a04', strokeWidth: 100,
      minZoom: 0.005,
    })

    objects.push({
      type: 'text',
      left: lx - 1_200, top: ly - 600,
      width: 3_400, height: 2_000,
      text: `📍 ${name}`, fontSize: 1_200, fill: '#1a1a1a',
      minZoom: 0.005,
      mapRole: 'landmark-name',
    })
  }

  // ── Deck scale: treasure markers per continent ──
  for (let ci = 0; ci < continents.length; ci++) {
    const continent = continents[ci]
    const treasureCount = 2 + Math.floor(rng() * 2)
    const contTreasureNames = theme.treasureNames ?? theme.landmarks

    for (let t = 0; t < treasureCount; t++) {
      const tx = continent.cx + (rng() - 0.5) * continent.w * 0.6
      const ty = continent.cy + (rng() - 0.5) * continent.h * 0.6
      const name = contTreasureNames[Math.floor(rng() * contTreasureNames.length)]

      // Parchment background
      objects.push({
        type: 'rect',
        left: tx - 1_500, top: ty - 1_000,
        width: 5_000, height: 3_000,
        fill: '#f5e6c8', stroke: '#8b6914', strokeWidth: 80,
        minZoom: 0.005,
      })

      // Red X mark
      objects.push({
        type: 'text',
        left: tx - 800, top: ty - 900,
        width: 1_600, height: 1_600,
        text: '✕', fontSize: 1_800, fill: '#dc2626',
        minZoom: 0.005,
      })

      // Treasure name label
      objects.push({
        type: 'text',
        left: tx - 1_400, top: ty + 1_200,
        width: 4_800, height: 1_200,
        text: name, fontSize: 600, fill: '#4a3728',
        minZoom: 0.008,
        mapRole: 'treasure-name',
      })

      // Dashed trail from nearest town to treasure
      const nearestTown = findNearest(usedTowns.map((tw) => ({ x: tw.cx, y: tw.cy })), tx, ty)
      if (nearestTown) {
        const midX = (nearestTown.x + tx) / 2 + (rng() - 0.5) * 4_000
        const midY = (nearestTown.y + ty) / 2 + (rng() - 0.5) * 4_000
        objects.push({
          type: 'polyline',
          left: 0, top: 0, width: 0, height: 0,
          points: [
            { x: nearestTown.x, y: nearestTown.y },
            { x: midX, y: midY },
            { x: tx, y: ty },
          ],
          stroke: '#8b6914', strokeWidth: 70,
          strokeDashArray: [400, 250],
          minZoom: 0.005,
        })
      }
    }
  }

  return {
    objects,
    viewportCenter: { x: 0, y: 0 },
    initialZoom: 0.00002,
  }
}

function findNearest(
  points: Array<{ x: number; y: number }>,
  tx: number,
  ty: number,
): { x: number; y: number } | null {
  if (points.length === 0) return null
  let best = points[0]
  let bestDist = dist2(best.x, best.y, tx, ty)
  for (const p of points) {
    const d = dist2(p.x, p.y, tx, ty)
    if (d < bestDist) { best = p; bestDist = d }
  }
  return best
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

// Mulberry32 seeded PRNG
export function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
