/**
 * Helpers for font family on text objects (IText).
 * Used by FontControl when selection is text.
 */

import type { FabricObject } from 'fabric'

function hasFontFamily(obj: FabricObject): boolean {
  return obj.type === 'i-text' || obj.type === 'text'
}

function getFirstTextChild(obj: FabricObject): FabricObject | null {
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    return children.find((c) => c.type === 'i-text' || c.type === 'text') ?? null
  }
  return null
}

/** Get fontFamily from a single IText or from the first text child of a group (e.g. sticky). */
export function getFontFamilyFromObject(obj: FabricObject | null): string | null {
  if (!obj) return null
  const textObj = hasFontFamily(obj) ? obj : getFirstTextChild(obj)
  if (!textObj) return null
  return (textObj.get('fontFamily') as string) ?? 'Arial'
}

/** Set fontFamily on IText or on all text children of a group. */
export function setFontFamilyOnObject(obj: FabricObject, fontFamily: string): void {
  if (obj.type === 'group' && 'getObjects' in obj) {
    const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
    children.forEach((child) => {
      if (child.type === 'i-text' || child.type === 'text') {
        child.set('fontFamily', fontFamily)
      }
    })
    return
  }
  if (hasFontFamily(obj)) obj.set('fontFamily', fontFamily)
}

/** True when selection is standalone text (no stroke controls). */
export function isTextOnlySelection(obj: FabricObject | null): boolean {
  return obj != null && (obj.type === 'i-text' || obj.type === 'text')
}

/** True when selection is a sticky note (rect + text group; no stroke controls). */
export function isStickyGroup(obj: FabricObject | null): boolean {
  if (!obj || obj.type !== 'group' || !('getObjects' in obj)) return false
  const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
  if (children.length !== 2) return false
  return children[0]!.type === 'rect' && (children[1]!.type === 'i-text' || children[1]!.type === 'text')
}

/** True when selection has editable text (standalone or in group). */
export function hasEditableText(obj: FabricObject | null): boolean {
  if (!obj) return false
  if (obj.type === 'i-text' || obj.type === 'text') return true
  return getFirstTextChild(obj) != null
}
