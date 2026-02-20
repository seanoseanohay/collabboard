/**
 * Pirate Plunder sticker factory.
 * Uses emoji Text for crisp, native rendering — no image assets required.
 * Size is controlled via scaleX/scaleY (not fontSize) so Fabric always measures
 * bounding-box metrics at a fixed fontSize 96, avoiding the inflated/misaligned
 * bounds that occur when emoji are rendered at huge font sizes (e.g. 96 000+).
 */

import { Text, type FabricObject } from 'fabric'

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
}

export const STICKER_DEFS: Record<StickerKind, StickerDef> = {
  anchor: { label: 'Anchor', icon: '⚓' },
  skull: { label: 'Skull', icon: '☠️' },
  ship: { label: 'Ship', icon: '⛵' },
  hat: { label: 'Pirate Hat', icon: '🎩' },
  compass: { label: 'Compass', icon: '🧭' },
  parrot: { label: 'Parrot', icon: '🦜' },
  chest: { label: 'Chest', icon: '💰' },
  sword: { label: 'Sword', icon: '🗡️' },
  barrel: { label: 'Barrel', icon: '🛢️' },
}

export const STICKER_KINDS = Object.keys(STICKER_DEFS) as StickerKind[]

/** Base font size — always fixed so Fabric measures metrics at a consistent size. */
const STICKER_FONT_SIZE = 96
/** Maximum scale factor — covers full zoom range down to 0.001% (zoom=0.00001).
 * At 0.001%: 1/0.00001 = 100 000. */
const MAX_STICKER_SCALE = 100_000

export function createSticker(
  kind: StickerKind,
  centerX: number,
  centerY: number,
  options?: { assignId?: boolean; zoom?: number }
): FabricObject | null {
  const def = STICKER_DEFS[kind]
  if (!def) return null

  const assignId = options?.assignId !== false
  const id = assignId ? crypto.randomUUID() : ''
  const zoom = options?.zoom ?? 1
  // Scale instead of fontSize so Fabric's bounding-box measurements stay
  // based on fontSize 96 (reliable) rather than huge values (broken metrics).
  const scale = Math.min(MAX_STICKER_SCALE, 1 / zoom)

  const text = new Text(def.icon, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    fontSize: STICKER_FONT_SIZE,
    scaleX: scale,
    scaleY: scale,
    fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
    selectable: true,
    evented: true,
  })

  if (assignId && id) {
    text.set('data', { id })
  }

  return text
}
