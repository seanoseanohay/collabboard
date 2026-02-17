/**
 * Creates Fabric.js shapes for the workspace. Uses left/top origin for predictable positioning.
 */

import {
  Rect,
  Circle,
  Triangle,
  Polyline,
  FabricText,
  Group,
  type FabricObject,
} from 'fabric'
import type { ToolType } from '../types/tools'

const STROKE = '#1a1a2e'
const FILL = '#fff'
const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa']

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
    strokeWidth: 2,
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
      }))
    }
    case 'text': {
      return withId(new FabricText('Text', {
        ...baseOpts,
        left,
        top,
        fontSize: 16,
        fill: STROKE,
      }))
    }
    case 'sticky': {
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
      const txt = new FabricText('Note', {
        left: 8,
        top: 8,
        fontSize: 14,
        fill: STROKE,
        originX: 'left',
        originY: 'top',
      })
      return withId(new Group([bg, txt], { left, top, originX: 'left', originY: 'top' }))
    }
    default:
      return null
  }
}
