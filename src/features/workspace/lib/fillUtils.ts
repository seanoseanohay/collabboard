/**
 * Helpers for per-object fill (background) color.
 * Used by FillControl and FabricCanvas; sync uses Fabric's fill in payload.
 */

import type { FabricObject } from 'fabric'

function hasFill(obj: FabricObject): boolean {
  const fill = obj.get('fill')
  return typeof fill === 'string' && fill.length > 0
}

/** Get fill from a single object or group (sticky: first child rect). */
export function getFillFromObject(obj: FabricObject | null): string | null {
  if (!obj) return null
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    const withFill = children.find(hasFill)
    return withFill ? (withFill.get('fill') as string) ?? null : null
  }
  if (!hasFill(obj)) return null
  return (obj.get('fill') as string) ?? null
}

/** Set fill on object or on first fill-bearing child of a group (sticky bg). */
export function setFillOnObject(obj: FabricObject, fill: string): void {
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    const first = children[0]
    if (first && hasFill(first)) first.set('fill', fill)
    return
  }
  if (hasFill(obj)) obj.set('fill', fill)
}
