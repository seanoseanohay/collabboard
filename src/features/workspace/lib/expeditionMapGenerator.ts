import type { ExpeditionTheme } from './expeditionThemes'

export interface MapObjectSpec {
  type: 'rect' | 'ellipse' | 'text'
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
}

export interface GeneratedMap {
  objects: MapObjectSpec[]
  viewportCenter: { x: number; y: number }
  initialZoom: number
}

const MAP_WIDTH = 80_000_000
const MAP_HEIGHT = 60_000_000
const MAP_CX = MAP_WIDTH / 2
const MAP_CY = MAP_HEIGHT / 2

export function generateExpeditionMap(theme: ExpeditionTheme, seed?: number): GeneratedMap {
  const rng = seededRandom(seed ?? Date.now())
  const objects: MapObjectSpec[] = []

  // ── Ocean scale: continents (visible zoom 0 to 0.0001) ──
  const continentCount = 3 + Math.floor(rng() * 3)
  const continents: Array<{ x: number; y: number; w: number; h: number }> = []

  for (let i = 0; i < continentCount; i++) {
    const w = 8_000_000 + rng() * 12_000_000
    const h = 6_000_000 + rng() * 10_000_000
    const x = 2_000_000 + rng() * (MAP_WIDTH - w - 4_000_000)
    const y = 2_000_000 + rng() * (MAP_HEIGHT - h - 4_000_000)
    continents.push({ x, y, w, h })

    objects.push({
      type: 'ellipse', left: x, top: y, width: w, height: h,
      fill: theme.landFills[i % theme.landFills.length],
      stroke: '#8b7355', strokeWidth: 100_000,
      minZoom: 0, maxZoom: 0.0001,
    })

    const name = theme.continentNames[i % theme.continentNames.length]
    objects.push({
      type: 'text', left: x + w * 0.2, top: y + h * 0.35,
      width: w * 0.6, height: h * 0.3,
      text: name, fontSize: 2_000_000,
      fill: '#4a3728',
      minZoom: 0, maxZoom: 0.00008,
    })
  }

  // Ocean labels
  for (let i = 0; i < 3; i++) {
    objects.push({
      type: 'text',
      left: 5_000_000 + rng() * (MAP_WIDTH - 10_000_000),
      top: 5_000_000 + rng() * (MAP_HEIGHT - 10_000_000),
      width: 20_000_000, height: 3_000_000,
      text: theme.oceanNames[i % theme.oceanNames.length],
      fontSize: 1_500_000, fill: '#4a86b8',
      minZoom: 0, maxZoom: 0.00008,
    })
  }

  // ── Voyage scale: islands within continents (visible zoom 0.0001 to 0.001) ──
  for (const continent of continents) {
    const islandCount = 3 + Math.floor(rng() * 3)
    for (let i = 0; i < islandCount; i++) {
      const iw = 500_000 + rng() * 1_500_000
      const ih = 400_000 + rng() * 1_200_000
      const ix = continent.x + continent.w * 0.05 + rng() * (continent.w * 0.7)
      const iy = continent.y + continent.h * 0.05 + rng() * (continent.h * 0.7)
      const name = theme.islandNames[Math.floor(rng() * theme.islandNames.length)]

      objects.push({
        type: 'ellipse', left: ix, top: iy, width: iw, height: ih,
        fill: theme.landFills[Math.floor(rng() * theme.landFills.length)],
        stroke: '#8b7355', strokeWidth: 10_000,
        minZoom: 0.00005, maxZoom: 0.001,
      })

      objects.push({
        type: 'text', left: ix + iw * 0.1, top: iy - ih * 0.15,
        width: iw * 0.8, height: ih * 0.2,
        text: name, fontSize: 150_000,
        fill: '#2d1a0e',
        minZoom: 0.0001, maxZoom: 0.0008,
      })
    }
  }

  // ── Harbor scale: towns within continents (visible zoom 0.001 to 0.01) ──
  for (const continent of continents) {
    const townCount = 2 + Math.floor(rng() * 2)
    for (let i = 0; i < townCount; i++) {
      const tw = 30_000 + rng() * 50_000
      const th = 25_000 + rng() * 40_000
      const tx = continent.x + continent.w * 0.15 + rng() * continent.w * 0.7
      const ty = continent.y + continent.h * 0.15 + rng() * continent.h * 0.7
      const name = theme.townNames[Math.floor(rng() * theme.townNames.length)]

      objects.push({
        type: 'rect', left: tx, top: ty, width: tw, height: th,
        fill: '#f5f0e1', stroke: '#8b7355', strokeWidth: 1000,
        minZoom: 0.0005, maxZoom: 0.01,
      })

      objects.push({
        type: 'text', left: tx + tw * 0.05, top: ty + th * 0.1,
        width: tw * 0.9, height: th * 0.3,
        text: name, fontSize: 15_000,
        fill: '#2d1a0e',
        minZoom: 0.001, maxZoom: 0.008,
      })
    }
  }

  // ── Deck scale: landmarks scattered (visible zoom 0.01+) ──
  for (let i = 0; i < 5; i++) {
    const lx = MAP_WIDTH * 0.05 + rng() * MAP_WIDTH * 0.9
    const ly = MAP_HEIGHT * 0.05 + rng() * MAP_HEIGHT * 0.9
    const name = theme.landmarks[i % theme.landmarks.length]

    objects.push({
      type: 'rect', left: lx, top: ly, width: 5000, height: 3000,
      fill: '#fef08a', stroke: '#ca8a04', strokeWidth: 200,
      minZoom: 0.005,
    })

    objects.push({
      type: 'text', left: lx + 200, top: ly + 200,
      width: 4600, height: 2600,
      text: `📍 ${name}`, fontSize: 1500,
      fill: '#1a1a1a',
      minZoom: 0.005,
    })
  }

  return {
    objects,
    viewportCenter: { x: MAP_CX, y: MAP_CY },
    initialZoom: 0.00002,
  }
}

// Mulberry32 seeded PRNG
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
