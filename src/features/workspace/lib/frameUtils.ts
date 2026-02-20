/**
 * Frame utility helpers.
 * Provides type-narrowing and data-access functions for Frame objects.
 */

import type { Canvas, FabricObject } from 'fabric'
import type { FormSchema } from './frameFormTypes'

export const HIDE_TITLE_ZOOM_THRESHOLD = 0.4

export interface FrameData {
  id: string
  subtype: 'frame'
  title: string
  childIds: string[]
  formSchema?: FormSchema | null
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

export function getFrameFormSchema(obj: FabricObject): FormSchema | null {
  const data = obj.get('data') as { subtype?: string; formSchema?: FormSchema | null } | undefined
  if (data?.subtype !== 'frame') return null
  return data.formSchema ?? null
}

export function setFrameFormSchema(obj: FabricObject, schema: FormSchema | null): void {
  const data = obj.get('data') as Record<string, unknown> | undefined
  if (!data || data['subtype'] !== 'frame') return
  obj.set('data', { ...data, formSchema: schema })
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
