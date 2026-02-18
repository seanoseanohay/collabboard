/**
 * Pirate Plunder sticker factory.
 * Uses emoji IText for crisp, native rendering — no image assets required.
 * Stickers are 96×96 scene units, centered at click point.
 */

import { IText, type FabricObject } from 'fabric'

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
  sword: { label: 'Sword', icon: '⚔️' },
  barrel: { label: 'Barrel', icon: '🛢️' },
}

export const STICKER_KINDS = Object.keys(STICKER_DEFS) as StickerKind[]

const STICKER_SIZE = 96

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

  const itext = new IText(def.icon, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    fontSize: STICKER_SIZE,
    fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
    editable: false,
    selectable: true,
    evented: true,
  })

  if (assignId && id) {
    itext.set('data', { id })
  }

  return itext
}
