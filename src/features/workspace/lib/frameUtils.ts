/**
 * Frame utility helpers.
 * Provides type-narrowing and data-access functions for Frame objects.
 * Frames are spatial containers for canvas objects only — form/data functionality
 * lives in DataTable objects (see dataTableUtils.ts).
 */

import type { Canvas, FabricObject } from 'fabric'

export const HIDE_TITLE_ZOOM_THRESHOLD = 0.4

export interface FrameData {
  id: string
  subtype: 'frame'
  title: string
  childIds: string[]
}

export function isFrame(obj: FabricObject): boolean {
  const data = obj.get('data') as { subtype?: string } | undefined
  return data?.subtype === 'frame'
}

export function getFrameData(obj: FabricObject): FrameData | null {
  const data = obj.get('data') as Partial<FrameData> | undefined
  if (data?.subtype !== 'frame') return null
  return {
    id: data.id ?? '',
    subtype: 'frame',
    title: data.title ?? 'Frame',
    childIds: data.childIds ?? [],
  }
}

export function getFrameChildIds(obj: FabricObject): string[] {
  const data = obj.get('data') as { subtype?: string; childIds?: string[] } | undefined
  if (data?.subtype !== 'frame') return []
  return data.childIds ?? []
}

export function setFrameChildIds(obj: FabricObject, childIds: string[]): void {
  const data = obj.get('data') as Record<string, unknown> | undefined
  if (!data || data['subtype'] !== 'frame') return
  obj.set('data', { ...data, childIds })
}

export function setFrameTitle(obj: FabricObject, title: string): void {
  const data = obj.get('data') as Record<string, unknown> | undefined
  if (!data || data['subtype'] !== 'frame') return
  obj.set('data', { ...data, title })
}

/** True if obj is a frame or table Group (same [bg, title] structure). */
export function isFrameOrTableGroup(obj: FabricObject): boolean {
  const data = obj.get('data') as { subtype?: string } | undefined
  return data?.subtype === 'frame' || data?.subtype === 'table'
}

function counterScaleFrameOrTableTitleSingle(group: FabricObject): void {
  if (!isFrameOrTableGroup(group) || group.type !== 'group' || !('getObjects' in group)) return
  const scaleX = (group.scaleX as number) ?? 1
  const scaleY = (group.scaleY as number) ?? 1
  if (scaleX === 1 && scaleY === 1) return
  const children = (group as { getObjects: () => FabricObject[] }).getObjects()
  const title = children.find((c) => c.type === 'i-text')
  if (title) {
    title.set('scaleX', 1 / scaleX)
    title.set('scaleY', 1 / scaleY)
  }
}

/**
 * Counter-scale the title IText so it stays fixed size during frame/table resize.
 * Call on object:scaling. Handles single frame/table or ActiveSelection of multiple objects.
 */
export function counterScaleFrameOrTableTitle(target: FabricObject): void {
  if (target.type === 'activeselection' && 'getObjects' in target) {
    ;(target as { getObjects: () => FabricObject[] }).getObjects().forEach(counterScaleFrameOrTableTitleSingle)
    return
  }
  counterScaleFrameOrTableTitleSingle(target)
}

/**
 * Bake group scale into bg rect dimensions and reset scales to 1.
 * Keeps frame/table title at nominal size for sync and prevents title blow-up on reload.
 * Call at object:modified before sync.
 */
export function bakeFrameOrTableGroupScale(group: FabricObject): void {
  if (!isFrameOrTableGroup(group) || group.type !== 'group' || !('getObjects' in group)) return
  const scaleX = (group.scaleX as number) ?? 1
  const scaleY = (group.scaleY as number) ?? 1
  if (scaleX === 1 && scaleY === 1) return
  const children = (group as { getObjects: () => FabricObject[] }).getObjects()
  const rect = children[0]
  const title = children.find((c) => c.type === 'i-text')
  if (rect) {
    const w = (rect.get('width') as number) ?? 0
    const h = (rect.get('height') as number) ?? 0
    rect.set('width', w * scaleX)
    rect.set('height', h * scaleY)
  }
  if (title) {
    title.set('scaleX', 1)
    title.set('scaleY', 1)
  }
  group.set('scaleX', 1)
  group.set('scaleY', 1)
  group.setCoords()
}

/**
 * Hides/shows the title IText inside each frame Group based on current canvas zoom.
 * Frame titles are the second child (index 1) of the Group: [bgRect, titleIText].
 * Called on every viewport change to keep titles readable.
 */
export function updateFrameTitleVisibility(canvas: Canvas): void {
  const zoom = canvas.getZoom()
  const showTitle = zoom >= HIDE_TITLE_ZOOM_THRESHOLD
  for (const obj of canvas.getObjects()) {
    if (!isFrame(obj)) continue
    const children = (obj as unknown as { getObjects(): FabricObject[] }).getObjects?.()
    if (!children) continue
    const titleText = children.find((c) => c.type === 'i-text')
    if (titleText && titleText.visible !== showTitle) {
      titleText.set('visible', showTitle)
    }
  }
}
