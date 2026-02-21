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

const MAP_WIDTH = 20000
const MAP_HEIGHT = 15000

export function generateExpeditionMap(theme: ExpeditionTheme, seed?: number): GeneratedMap {
  const rng = seededRandom(seed ?? Date.now())
  const objects: MapObjectSpec[] = []

  // Ocean scale: large landmasses (visible 0–25% zoom)
  const continentCount = 3 + Math.floor(rng() * 3) // 3–5
  const continents: Array<{ x: number; y: number; w: number; h: number }> = []

  for (let i = 0; i < continentCount; i++) {
    const w = 2000 + rng() * 3000
    const h = 1500 + rng() * 2500
    const x = 500 + rng() * (MAP_WIDTH - w - 1000)
    const y = 500 + rng() * (MAP_HEIGHT - h - 1000)
    continents.push({ x, y, w, h })

    objects.push({
      type: 'ellipse', left: x, top: y, width: w, height: h,
      fill: theme.landFills[i % theme.landFills.length],
      stroke: '#8b7355', strokeWidth: 2,
      minZoom: 0, maxZoom: 0.25,
    })

    // Continent label (ocean scale only)
    const name = theme.continentNames[i % theme.continentNames.length]
    objects.push({
      type: 'text', left: x + w / 2 - 300, top: y + h / 2 - 60,
      width: 600, height: 120,
      text: name, fontSize: 100,
      fill: '#4a3728',
      minZoom: 0, maxZoom: 0.08,
    })
  }

  // Ocean labels (ocean scale)
  for (let i = 0; i < 3; i++) {
    objects.push({
      type: 'text',
      left: 1000 + rng() * (MAP_WIDTH - 2000),
      top: 1000 + rng() * (MAP_HEIGHT - 2000),
      width: 600, height: 60,
      text: theme.oceanNames[i % theme.oceanNames.length],
      fontSize: 48, fill: '#4a86b8',
      minZoom: 0, maxZoom: 0.1,
    })
  }

  // Voyage scale: islands (visible 3%–100% zoom)
  for (const continent of continents) {
    const islandCount = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < islandCount; i++) {
      const iw = 300 + rng() * 600
      const ih = 200 + rng() * 400
      const ix = continent.x + rng() * continent.w * 0.8
      const iy = continent.y + rng() * continent.h * 0.8
      const name = theme.islandNames[Math.floor(rng() * theme.islandNames.length)]

      objects.push({
        type: 'ellipse', left: ix, top: iy, width: iw, height: ih,
        fill: theme.landFills[Math.floor(rng() * theme.landFills.length)],
        stroke: '#8b7355', strokeWidth: 1,
        minZoom: 0.03, maxZoom: 1.0,
      })

      objects.push({
        type: 'text', left: ix + iw / 2 - 150, top: iy - 40,
        width: 300, height: 30,
        text: name, fontSize: 22,
        fill: '#2d1a0e',
        minZoom: 0.05, maxZoom: 0.5,
      })
    }
  }

  // Harbor scale: towns (visible 15%–400% zoom)
  for (const continent of continents) {
    const townCount = 1 + Math.floor(rng() * 2)
    for (let i = 0; i < townCount; i++) {
      const tx = continent.x + continent.w * 0.2 + rng() * continent.w * 0.6
      const ty = continent.y + continent.h * 0.2 + rng() * continent.h * 0.6
      const name = theme.townNames[Math.floor(rng() * theme.townNames.length)]

      objects.push({
        type: 'rect', left: tx, top: ty, width: 200, height: 150,
        fill: '#f5f0e1', stroke: '#8b7355', strokeWidth: 2,
        minZoom: 0.15, maxZoom: 4.0,
      })

      objects.push({
        type: 'text', left: tx + 10, top: ty + 10,
        width: 180, height: 20,
        text: name, fontSize: 14, fill: '#2d1a0e',
        minZoom: 0.15, maxZoom: 4.0,
      })
    }
  }

  // Deck scale: landmarks (visible 50%+)
  for (let i = 0; i < 4; i++) {
    const lx = MAP_WIDTH * 0.1 + rng() * MAP_WIDTH * 0.8
    const ly = MAP_HEIGHT * 0.1 + rng() * MAP_HEIGHT * 0.8
    const name = theme.landmarks[i % theme.landmarks.length]

    objects.push({
      type: 'rect', left: lx, top: ly, width: 160, height: 80,
      fill: '#fef08a', stroke: '#ca8a04', strokeWidth: 2,
      minZoom: 0.5,
    })

    objects.push({
      type: 'text', left: lx + 8, top: ly + 8,
      width: 144, height: 64,
      text: `📍 ${name}`, fontSize: 12, fill: '#1a1a1a',
      minZoom: 0.5,
    })
  }

  return {
    objects,
    viewportCenter: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    initialZoom: 0.03,
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
