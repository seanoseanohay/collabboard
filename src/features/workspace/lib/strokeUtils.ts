/**
 * Helpers for per-object stroke width (border thickness).
 * Used by StrokeControl and FabricCanvas; sync uses Fabric's strokeWidth in payload.
 */

import type { FabricObject } from 'fabric'
import { DEFAULT_STROKE_WEIGHT } from './shapeFactory'

/** Objects that can have a visible stroke (border). */
function hasStroke(obj: FabricObject): boolean {
  const stroke = obj.get('stroke')
  return typeof stroke === 'string' && stroke.length > 0
}

/** Get effective stroke width from a single object or group (first stroke-bearing child). */
export function getStrokeWidthFromObject(obj: FabricObject | null): number | null {
  if (!obj) return null
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    const withStroke = children.find(hasStroke)
    return withStroke ? (withStroke.get('strokeWidth') as number) ?? DEFAULT_STROKE_WEIGHT : null
  }
  if (!hasStroke(obj)) return null
  return (obj.get('strokeWidth') as number) ?? DEFAULT_STROKE_WEIGHT
}

/** Set stroke width on object or on all stroke-bearing children of a group. */
export function setStrokeWidthOnObject(obj: FabricObject, strokeWidth: number): void {
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    children.forEach((child) => {
      if (hasStroke(child)) child.set('strokeWidth', strokeWidth)
    })
    return
  }
  if (hasStroke(obj)) obj.set('strokeWidth', strokeWidth)
}

export const STROKE_WEIGHT_OPTIONS = [1, 2, 4, 8] as const
