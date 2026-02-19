/**
 * Pirate Plunder sticker factory.
 * Uses emoji IText for crisp, native rendering — no image assets required.
 * Stickers are 96×96 scene units, centered at click point.
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

const STICKER_SIZE = 96

/** Max scene fontSize to avoid huge objects at extreme zoom-out */
const MAX_STICKER_SCENE_SIZE = 2000

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
  const effectiveSize = Math.min(MAX_STICKER_SCENE_SIZE, STICKER_SIZE / zoom)

  const text = new Text(def.icon, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    fontSize: effectiveSize,
    fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
    selectable: true,
    evented: true,
  })

  if (assignId && id) {
    text.set('data', { id })
  }

  return text
}
