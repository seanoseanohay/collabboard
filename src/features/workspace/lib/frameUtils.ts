/**
 * Frame utility helpers.
 * Provides type-narrowing and data-access functions for Frame objects.
 */

import type { FabricObject } from 'fabric'

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
