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

/** Update sticky group's text child fontSize from the group's current effective size (e.g. after resize/sync). */
export function updateStickyTextFontSize(group: FabricObject): void {
  if (group.type !== 'group' || !('getObjects' in group)) return
  const children = (group as { getObjects: () => FabricObject[] }).getObjects()
  if (children.length < 2) return
  const txt = children[1]
  if (txt.type !== 'i-text') return
  const w = (group.get('width') as number) ?? 120
  const h = (group.get('height') as number) ?? 80
  const scaleX = (group.get('scaleX') as number) ?? 1
  const scaleY = (group.get('scaleY') as number) ?? 1
  const effectiveW = w * scaleX
  const effectiveH = h * scaleY
  const fontSize = stickyFontSizeFromSize(effectiveW, effectiveH)
  txt.set('fontSize', fontSize)
}

let stickyColorIndex = 0

function nextStickyColor(): string {
  const c = STICKY_COLORS[stickyColorIndex % STICKY_COLORS.length]
  stickyColorIndex += 1
  return c
}

const OBJ_ID_KEY = 'id'

export function createShape(
  tool: ToolType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: { assignId?: boolean }
): FabricObject | null {
  const assignId = options?.assignId !== false
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
      return withId(new IText('Text', {
        ...baseOpts,
        left,
        top,
        fontSize: 16,
        fill: STROKE,
        editable: true,
      }))
    }
    case 'sticky': {
      // Create background rect - positioned at 0,0 within group
      const bg = new Rect({
        left: 0,
        top: 0,
        width,
        height,
        fill: nextStickyColor(),
        stroke: STROKE,
        strokeWidth: 1,
        originX: 'left',
        originY: 'top',
      })
      // Text scales with sticky size so it stays readable at any zoom/size
      const fontSize = stickyFontSizeFromSize(width, height)
      const txt = new IText('Note', {
        left: 8,
        top: 8,
        fontSize,
        fill: STROKE,
        originX: 'left',
        originY: 'top',
        editable: true,
      })
      // Create group - will be selected as a whole unit
      const group = new Group([bg, txt], { 
        left, 
        top,
        originX: 'left',
        originY: 'top',
        // subTargetCheck removed - Groups are atomic units, children cannot be clicked directly
      })
      return withId(group)
    }
    default:
      return null
  }
}
