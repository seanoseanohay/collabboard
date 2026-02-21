export interface ScaleBand {
  id: string
  name: string
  emoji: string
  minZoom: number
  maxZoom: number
}

export const SCALE_BANDS: ScaleBand[] = [
  { id: 'ocean',    name: 'Ocean',    emoji: '🌊', minZoom: 0,      maxZoom: 0.0001 },
  { id: 'voyage',   name: 'Voyage',   emoji: '⛵', minZoom: 0.0001, maxZoom: 0.001  },
  { id: 'harbor',   name: 'Harbor',   emoji: '⚓', minZoom: 0.001,  maxZoom: 0.01   },
  { id: 'deck',     name: 'Deck',     emoji: '🏴‍☠️', minZoom: 0.01,   maxZoom: 0.1    },
  { id: 'spyglass', name: 'Spyglass', emoji: '🔭', minZoom: 0.1,    maxZoom: Infinity },
]

export const ALL_SCALES_ID = 'all'

export function getScaleBandForZoom(zoom: number): ScaleBand {
  return SCALE_BANDS.find((b) => zoom >= b.minZoom && zoom < b.maxZoom) ?? SCALE_BANDS[2]!
}

export function isVisibleAtZoom(
  data: { minZoom?: number; maxZoom?: number } | undefined,
  zoom: number,
): boolean {
  if (!data) return true
  const { minZoom: min, maxZoom: max } = data
  if (min == null && max == null) return true
  if (min != null && zoom < min) return false
  if (max != null && max !== Infinity && zoom >= max) return false
  return true
}
