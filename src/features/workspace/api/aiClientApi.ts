/**
 * AI Client API — programmatic canvas operations (create, update, delete, query).
 * Same operations as the UI; enables AI assistants and server-side Edge Functions.
 */

import type { FabricObject } from 'fabric'
import { writeDocument, getDocument, deleteDocument, fetchDocuments, type DocumentQueryCriteria } from './documentsApi'
import { setObjectId } from '../lib/boardSync'
import { createShape } from '../lib/shapeFactory'
import type { ToolType } from '../types/tools'

const SHAPE_TYPE: ToolType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky']

export type CreateObjectType = 'rect' | 'circle' | 'triangle' | 'line' | 'text' | 'sticky'

export interface CreateObjectProps {
  left: number
  top: number
  width?: number
  height?: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string
  fontSize?: number
}

export interface UpdateObjectProps {
  left?: number
  top?: number
  width?: number
  height?: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  strokeWidth?: number
  text?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  fontSize?: number
}

export interface QueryObjectsCriteria {
  type?: string
  fill?: string
}

function applyCreateProps(shape: FabricObject, props: CreateObjectProps): void {
  if (props.fill != null) shape.set('fill', props.fill)
  if (props.stroke != null) shape.set('stroke', props.stroke)
  if (props.strokeWeight != null) shape.set('strokeWidth', props.strokeWeight)
  if (props.fontSize != null && 'set' in shape) (shape as { set: (k: string, v: number) => void }).set('fontSize', props.fontSize)
  if (props.text != null && 'text' in shape) (shape as { set: (k: string, v: string) => void }).set('text', props.text)
  if (shape.type === 'group' && 'getObjects' in shape) {
    const children = (shape as { getObjects: () => FabricObject[] }).getObjects()
    // children[0] is the bg Rect; apply visual props directly to it
    if (children[0]) {
      if (props.fill != null) children[0].set('fill', props.fill)
      if (props.stroke != null) children[0].set('stroke', props.stroke)
      if (props.strokeWeight != null) children[0].set('strokeWidth', props.strokeWeight)
    }
    // children[1] is the main IText
    if (props.text != null && children[1] && 'set' in children[1]) {
      (children[1] as { set: (k: string, v: string) => void }).set('text', props.text)
    }
  }
}

function shapeToPayload(shape: FabricObject): Record<string, unknown> {
  const payload = shape.toObject(['data', 'objects']) as Record<string, unknown>
  delete payload.data
  delete (payload as { layoutManager?: unknown }).layoutManager
  return payload
}

export interface CreateObjectOptions {
  /** zIndex for stacking order. Higher = on top. Default: Date.now() */
  zIndex?: number
}

/**
 * Create a canvas object. Writes to Supabase; Realtime sync applies it to all clients.
 * @returns objectId (UUID)
 */
export async function createObject(
  boardId: string,
  type: CreateObjectType,
  props: CreateObjectProps,
  options?: CreateObjectOptions
): Promise<string> {
  if (!SHAPE_TYPE.includes(type as ToolType)) {
    throw new Error(`Invalid type: ${type}. Must be one of ${SHAPE_TYPE.join(', ')}`)
  }
  const left = props.left ?? 0
  const top = props.top ?? 0
  const width = Math.max(1, props.width ?? 100)
  const height = Math.max(1, props.height ?? 80)
  const x2 = type === 'line' ? left + width : left + width
  const y2 = type === 'line' ? top + height : top + height

  const shape = createShape(type as ToolType, left, top, x2, y2, { assignId: false })
  if (!shape) throw new Error(`Failed to create shape: ${type}`)

  const objectId = crypto.randomUUID()
  setObjectId(shape, objectId)
  applyCreateProps(shape, props)

  const payload = shapeToPayload(shape)
  payload.zIndex = options?.zIndex ?? Date.now()
  await writeDocument(boardId, objectId, payload)
  return objectId
}

/**
 * Update object properties. Merges partialProps into existing document and writes.
 */
export async function updateObject(
  boardId: string,
  objectId: string,
  partialProps: UpdateObjectProps
): Promise<void> {
  const current = await getDocument(boardId, objectId)
  if (!current) throw new Error(`Object not found: ${objectId}`)
  const merged = { ...current, ...partialProps }
  if (partialProps.strokeWeight != null) (merged as Record<string, unknown>).strokeWidth = partialProps.strokeWeight
  await writeDocument(boardId, objectId, merged as Record<string, unknown>)
}

/**
 * Delete one or more objects.
 */
export async function deleteObjects(boardId: string, objectIds: string[]): Promise<void> {
  await Promise.all(objectIds.map((id) => deleteDocument(boardId, id)))
}

/**
 * Query objects on the board with optional criteria (type, fill).
 * Returns up to 500 documents; filter in-memory for other criteria.
 */
export async function queryObjects(
  boardId: string,
  criteria?: QueryObjectsCriteria
): Promise<{ objectId: string; data: Record<string, unknown> }[]> {
  const docCriteria: DocumentQueryCriteria | undefined = criteria
    ? { type: criteria.type, fill: criteria.fill }
    : undefined
  return fetchDocuments(boardId, docCriteria)
}
