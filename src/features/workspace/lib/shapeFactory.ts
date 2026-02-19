/**
 * Creates Fabric.js shapes for the workspace. Uses left/top origin for predictable positioning.
 */

import {
  Rect,
  Circle,
  Triangle,
  Polyline,
  IText,
  Group,
  type FabricObject,
} from 'fabric'
import type { ToolType } from '../types/tools'

const STROKE = '#1a1a2e'
const FILL = '#fff'
/** Default border thickness (nominal at 100% zoom). Sync stores strokeWidth; strokeWeight can be used for zoom-invariant later. */
export const DEFAULT_STROKE_WEIGHT = 2
const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa']

/** Sticky note text scales with sticky size so it stays readable at any zoom/size. */
export const STICKY_TEXT_SIZE_RATIO = 0.18
export const MIN_STICKY_FONT_SIZE = 10

export function stickyFontSizeFromSize(width: number, height: number): number {
  return Math.max(MIN_STICKY_FONT_SIZE, Math.round(Math.min(width, height) * STICKY_TEXT_SIZE_RATIO))
}

/** Index of main (editable) text in sticky group: last IText. Placeholder is at 1 when 3 children. */
function getStickyTextChildren(group: FabricObject): { placeholder: FabricObject | null; mainText: FabricObject } | null {
  if (group.type !== 'group' || !('getObjects' in group)) return null
  const children = (group as { getObjects: () => FabricObject[] }).getObjects()
  const textChildren = children.filter((c) => c.type === 'i-text')
  if (textChildren.length === 0) return null
  const mainText = textChildren[textChildren.length - 1]
  const placeholder = textChildren.length >= 2 ? textChildren[textChildren.length - 2] : null
  return { placeholder, mainText }
}

/** Update sticky group's text child(ren) fontSize from the group's current effective size (e.g. after resize/sync). */
export function updateStickyTextFontSize(group: FabricObject): void {
  const pair = getStickyTextChildren(group)
  if (!pair) return
  const { placeholder, mainText } = pair
  const w = (group.get('width') as number) ?? 120
  const h = (group.get('height') as number) ?? 80
  const scaleX = (group.get('scaleX') as number) ?? 1
  const scaleY = (group.get('scaleY') as number) ?? 1
  const effectiveW = w * scaleX
  const effectiveH = h * scaleY
  const fontSize = stickyFontSizeFromSize(effectiveW, effectiveH)
  mainText.set('fontSize', fontSize)
  if (placeholder) placeholder.set('fontSize', fontSize)
}

/** Show placeholder when main text is empty; hide when it has content. Call after edit or when applying sync. */
export function updateStickyPlaceholderVisibility(group: FabricObject): void {
  const pair = getStickyTextChildren(group)
  if (!pair || !pair.placeholder) return
  const text = (pair.mainText.get('text') as string) ?? ''
  pair.placeholder.set('visible', !text.trim())
}

/** Hide sticky placeholder before entering edit mode so typed text is visible. Call before enterEditing(). */
export function hideStickyPlaceholderForEditing(obj: FabricObject): void {
  const grp = (obj as { group?: unknown }).group as FabricObject | undefined
  if (!grp) return
  const pair = getStickyTextChildren(grp)
  if (!pair?.placeholder) return
  pair.placeholder.set('visible', false)
}

let stickyColorIndex = 0

function nextStickyColor(): string {
  const c = STICKY_COLORS[stickyColorIndex % STICKY_COLORS.length]
  stickyColorIndex += 1
  return c
}

const OBJ_ID_KEY = 'id'

/** Base text fontSize at 100% zoom. Zoomed out → larger scene units for same apparent size. */
const BASE_TEXT_FONT_SIZE = 16
const MIN_TEXT_FONT_SIZE = 8

export function createShape(
  tool: ToolType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: { assignId?: boolean; zoom?: number }
): FabricObject | null {
  const assignId = options?.assignId !== false
  const zoom = options?.zoom ?? 1
  const id = assignId ? crypto.randomUUID() : ''
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.max(1, Math.abs(x2 - x1))
  const height = Math.max(1, Math.abs(y2 - y1))

  const baseOpts = {
    originX: 'left' as const,
    originY: 'top' as const,
    stroke: STROKE,
    strokeWidth: DEFAULT_STROKE_WEIGHT,
  }

  const withId = (obj: FabricObject) => {
    if (assignId && id) obj.set('data', { ...(obj.get('data') as object), [OBJ_ID_KEY]: id })
    return obj
  }

  switch (tool) {
    case 'rect': {
      return withId(new Rect({ ...baseOpts, left, top, width, height, fill: FILL }))
    }
    case 'circle': {
      const r = Math.min(width, height) / 2
      const cx = left + width / 2
      const cy = top + height / 2
      return withId(new Circle({
        ...baseOpts,
        left: cx - r,
        top: cy - r,
        radius: r,
        fill: FILL,
      }))
    }
    case 'triangle': {
      return withId(new Triangle({
        ...baseOpts,
        left,
        top,
        width,
        height,
        fill: FILL,
      }))
    }
    case 'line': {
      // Use Polyline instead of deprecated Line - Line has transform bugs (bounding box moves, path doesn't)
      return withId(new Polyline([{ x: x1, y: y1 }, { x: x2, y: y2 }], {
        ...baseOpts,
        fill: '',
        stroke: STROKE,
        strokeWidth: DEFAULT_STROKE_WEIGHT,
      }))
    }
    case 'text': {
      const textFontSize = Math.max(MIN_TEXT_FONT_SIZE, BASE_TEXT_FONT_SIZE / zoom)
      return withId(new IText('Text', {
        ...baseOpts,
        stroke: '',
        strokeWidth: 0,
        left,
        top,
        fontSize: textFontSize,
        fill: STROKE,
        editable: true,
      }))
    }
    case 'sticky': {
      // Enforce minimum dimensions in screen-space so tiny drags stay visible when zoomed out
      const minSceneW = 120 / zoom
      const minSceneH = 80 / zoom
      const stickyW = Math.max(width, minSceneW)
      const stickyH = Math.max(height, minSceneH)
      // Create background rect - positioned at 0,0 within group
      const bg = new Rect({
        left: 0,
        top: 0,
        width: stickyW,
        height: stickyH,
        fill: nextStickyColor(),
        stroke: '',
        strokeWidth: 0,
        originX: 'left',
        originY: 'top',
      })
      // Text scales with sticky size so it stays readable at any zoom/size. No placeholder text - just empty, cursor on create.
      const fontSize = stickyFontSizeFromSize(stickyW, stickyH)
      const padding = 8
      const mainText = new IText('', {
        left: padding,
        top: padding,
        fontSize,
        fill: STROKE,
        originX: 'left',
        originY: 'top',
        editable: true,
      })
      const group = new Group([bg, mainText], {
        left,
        top,
        originX: 'left',
        originY: 'top',
      })
      return withId(group)
    }
    default:
      return null
  }
}
