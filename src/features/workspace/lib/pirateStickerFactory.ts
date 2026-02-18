/**
 * Pirate Plunder sticker factory.
 * Each sticker is a Fabric.js Path (SVG path data) placed by click at 48×48 scene units.
 * Paths are defined in a ~0–100 coordinate space and scaled down to STICKER_SIZE.
 * Uses originX:'left', originY:'top' for consistency with all other canvas objects.
 */

import { Path, type FabricObject } from 'fabric'

export type StickerKind =
  | 'anchor'
  | 'skull'
  | 'ship'
  | 'hat'
  | 'compass'
  | 'parrot'
  | 'chest'
  | 'sword'
  | 'barrel'

export interface StickerDef {
  label: string
  icon: string
  path: string
}

export const STICKER_DEFS: Record<StickerKind, StickerDef> = {
  anchor: {
    label: 'Anchor',
    icon: '⚓',
    path: 'M50,5 A18,18 0 1,1 50,41 L50,90 M28,52 Q8,52 8,68 Q8,88 28,82 M72,52 Q92,52 92,68 Q92,88 72,82 M25,5 L75,5',
  },
  skull: {
    label: 'Skull',
    icon: '☠️',
    path: 'M22,50 A28,25 0 1,1 78,50 A28,25 0 1,1 22,50 M35,42 A6,6 0 1,0 35,30 A6,6 0 1,0 35,42 M65,42 A6,6 0 1,0 65,30 A6,6 0 1,0 65,42 M41,52 L46,60 L54,60 L59,52 M46,60 L46,70 M54,60 L54,70 M18,72 L82,98 M18,98 L82,72',
  },
  ship: {
    label: 'Ship',
    icon: '⛵',
    path: 'M50,8 L50,62 M50,8 L82,34 M50,8 L18,34 M8,72 Q50,88 92,72 Q72,54 50,60 Q28,54 8,72 Z',
  },
  hat: {
    label: 'Pirate Hat',
    icon: '🎩',
    path: 'M10,68 L90,68 M20,68 Q20,42 50,37 Q80,42 80,68 M35,37 Q35,12 50,8 Q65,12 65,37 M20,68 Q30,83 50,85 Q70,83 80,68 M44,53 L56,53',
  },
  compass: {
    label: 'Compass',
    icon: '🧭',
    path: 'M50,5 L57,44 L95,50 L57,56 L50,95 L43,56 L5,50 L43,44 Z M50,5 L50,18 M50,82 L50,95 M5,50 L18,50 M82,50 L95,50',
  },
  parrot: {
    label: 'Parrot',
    icon: '🦜',
    path: 'M46,14 Q60,10 68,22 Q74,34 64,42 Q57,47 50,43 L48,65 Q47,80 40,84 Q30,88 26,78 Q22,68 32,64 L36,60 Q39,52 42,44 Q32,38 32,26 Q36,12 46,14 M62,25 Q68,28 65,33',
  },
  chest: {
    label: 'Chest',
    icon: '💰',
    path: 'M15,52 L15,85 L85,85 L85,52 Z M10,35 L10,52 L90,52 L90,35 Q90,28 82,28 L18,28 Q10,28 10,35 Z M38,65 A12,10 0 1,0 62,65 A12,10 0 1,0 38,65 M50,55 L50,75',
  },
  sword: {
    label: 'Sword',
    icon: '⚔️',
    path: 'M22,88 L80,30 M80,30 L88,18 L96,26 L88,34 Z M16,92 L24,82 M22,88 L32,84',
  },
  barrel: {
    label: 'Barrel',
    icon: '🛢️',
    path: 'M28,12 Q16,12 16,50 Q16,88 28,88 L72,88 Q84,88 84,50 Q84,12 72,12 Z M16,35 Q50,42 84,35 M16,65 Q50,72 84,65 M38,12 Q35,50 38,88 M62,12 Q65,50 62,88',
  },
}

export const STICKER_KINDS = Object.keys(STICKER_DEFS) as StickerKind[]

const STICKER_SIZE = 48  // target width/height in scene units

export function createSticker(
  kind: StickerKind,
  centerX: number,
  centerY: number,
  options?: { assignId?: boolean }
): FabricObject | null {
  const def = STICKER_DEFS[kind]
  if (!def) return null

  const assignId = options?.assignId !== false
  const id = assignId ? crypto.randomUUID() : ''

  const path = new Path(def.path, {
    originX: 'left',
    originY: 'top',
    fill: '',
    stroke: '#1a1a2e',
    strokeWidth: 3,
    strokeLineCap: 'round' as const,
    strokeLineJoin: 'round' as const,
  })

  const w = path.width ?? 100
  const h = path.height ?? 100
  const scale = STICKER_SIZE / Math.max(w, h, 1)

  path.set({
    scaleX: scale,
    scaleY: scale,
    left: centerX - (w * scale) / 2,
    top: centerY - (h * scale) / 2,
  })

  if (assignId && id) {
    path.set('data', { id })
  }

  return path
}
