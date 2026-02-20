/**
 * DataTable utility helpers.
 * Provides type-narrowing and data-access functions for DataTable canvas objects.
 */

import type { Canvas, FabricObject } from 'fabric'
import type { FormSchema } from './frameFormTypes'

export const HIDE_TABLE_TITLE_ZOOM_THRESHOLD = 0.4

export interface DataTableData {
  id: string
  subtype: 'table'
  title: string
  showTitle: boolean        // false = no title bar rendered
  accentColor?: string      // drives border + column header tint
  formSchema: FormSchema | null
}

export function isDataTable(obj: FabricObject): boolean {
  const data = obj.get('data') as { subtype?: string } | undefined
  return data?.subtype === 'table'
}

export function getTableData(obj: FabricObject): DataTableData | null {
  const data = obj.get('data') as Partial<DataTableData> | undefined
  if (data?.subtype !== 'table') return null
  return {
    id: data.id ?? '',
    subtype: 'table',
    title: data.title ?? 'Untitled Table',
    showTitle: data.showTitle ?? false,
    accentColor: data.accentColor,
    formSchema: data.formSchema ?? null,
  }
}

export function getTableFormSchema(obj: FabricObject): FormSchema | null {
  const data = obj.get('data') as { subtype?: string; formSchema?: FormSchema | null } | undefined
  if (data?.subtype !== 'table') return null
  return data.formSchema ?? null
}

export function setTableFormSchema(obj: FabricObject, schema: FormSchema | null): void {
  const data = obj.get('data') as Record<string, unknown> | undefined
  if (!data || data['subtype'] !== 'table') return
  obj.set('data', { ...data, formSchema: schema })
}

export function setTableTitle(obj: FabricObject, title: string): void {
  const data = obj.get('data') as Record<string, unknown> | undefined
  if (!data || data['subtype'] !== 'table') return
  obj.set('data', { ...data, title })
}

/**
 * Hides/shows the title IText inside each DataTable Group based on current canvas zoom.
 * Called on every viewport change.
 */
export function updateTableTitleVisibility(canvas: Canvas): void {
  const zoom = canvas.getZoom()
  const showTitle = zoom >= HIDE_TABLE_TITLE_ZOOM_THRESHOLD
  for (const obj of canvas.getObjects()) {
    if (!isDataTable(obj)) continue
    const children = (obj as unknown as { getObjects(): FabricObject[] }).getObjects?.()
    if (!children) continue
    const titleText = children.find((c) => c.type === 'i-text')
    if (titleText && titleText.visible !== showTitle) {
      titleText.set('visible', showTitle)
    }
  }
}
