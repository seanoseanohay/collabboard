/**
 * Board API — named convenience wrappers over aiClientApi + documentsApi.
 *
 * These are the canonical verbs for programmatic board manipulation:
 *   createStickyNote, createShape, createFrame, createConnector,
 *   moveObject, resizeObject, updateText, changeColor, getBoardState
 *
 * Every function takes boardId as its first argument. Writes go to Supabase;
 * all connected canvas clients receive the change via Realtime within ~50 ms.
 */

import { createObject, updateObject, queryObjects } from './aiClientApi'
import { getDocumentsByIds, writeDocument } from './documentsApi'
import { createFrameShape } from '../lib/frameFactory'
import { setObjectId, setObjectZIndex } from '../lib/boardSync'
import type { ArrowMode, StrokeDash } from '../lib/connectorFactory'
import type { ConnectorPort } from '../lib/connectorPortUtils'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Center of an object document's bounding box. */
function docCenter(doc: Record<string, unknown>): { x: number; y: number } {
  const left = typeof doc.left === 'number' ? doc.left : 0
  const top = typeof doc.top === 'number' ? doc.top : 0
  const w = typeof doc.width === 'number' ? doc.width : 0
  const h = typeof doc.height === 'number' ? doc.height : 0
  return { x: left + w / 2, y: top + h / 2 }
}

// ─── create ───────────────────────────────────────────────────────────────────

/**
 * Create a sticky note on the board.
 * @returns objectId (UUID)
 */
export async function createStickyNote(
  boardId: string,
  text: string,
  x: number,
  y: number,
  color = '#fef08a'
): Promise<string> {
  return createObject(boardId, 'sticky', { left: x, top: y, fill: color, text })
}

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'line' | 'text'

/**
 * Create a basic shape on the board.
 * @returns objectId (UUID)
 */
export async function createShape(
  boardId: string,
  type: ShapeType,
  x: number,
  y: number,
  width: number,
  height: number,
  color = '#ffffff'
): Promise<string> {
  return createObject(boardId, type, { left: x, top: y, width, height, fill: color })
}

/**
 * Create a frame (labelled container) on the board.
 * The frame is created at z-index 1 so it always sits behind its children.
 * @returns objectId (UUID)
 */
export async function createFrame(
  boardId: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> {
  const frame = createFrameShape(x, y, width, height, title, false)
  const objectId = crypto.randomUUID()
  setObjectId(frame, objectId)
  setObjectZIndex(frame, 1)

  const payload = frame.toObject(['data', 'objects']) as Record<string, unknown>
  delete (payload as Record<string, unknown>).data
  delete (payload as { layoutManager?: unknown }).layoutManager
  payload.zIndex = 1

  await writeDocument(boardId, objectId, payload)
  return objectId
}

export interface ConnectorStyle {
  /** Arrow direction. Default: 'end' (one-way arrow). */
  arrowMode?: ArrowMode
  /** Stroke pattern. Default: 'solid'. */
  strokeDash?: StrokeDash
  /** Port on the source object. Default: 'mb' (middle-bottom). */
  sourcePort?: ConnectorPort
  /** Port on the target object. Default: 'mt' (middle-top). */
  targetPort?: ConnectorPort
}

/**
 * Create a connector (arrow/line) between two existing objects.
 * Fetches both objects' positions to compute the initial endpoints.
 * The canvas will snap the endpoints to the objects' ports via Realtime once rendered.
 * @returns objectId (UUID)
 */
export async function createConnector(
  boardId: string,
  fromId: string,
  toId: string,
  style: ConnectorStyle = {}
): Promise<string> {
  const docs = await getDocumentsByIds(boardId, [fromId, toId])
  const srcDoc = docs.find((d) => d.objectId === fromId)?.data
  const tgtDoc = docs.find((d) => d.objectId === toId)?.data

  const from = srcDoc ? docCenter(srcDoc) : { x: 0, y: 0 }
  const to = tgtDoc ? docCenter(tgtDoc) : { x: 100, y: 100 }

  const arrowMode: ArrowMode = style.arrowMode ?? 'end'
  const strokeDash: StrokeDash = style.strokeDash ?? 'solid'
  const sourcePort: ConnectorPort = style.sourcePort ?? 'mb'
  const targetPort: ConnectorPort = style.targetPort ?? 'mt'

  const strokeDashArray =
    strokeDash === 'dashed' ? [10, 5] : strokeDash === 'dotted' ? [2, 4] : []

  const objectId = crypto.randomUUID()
  const minX = Math.min(from.x, to.x)
  const minY = Math.min(from.y, to.y)
  const maxX = Math.max(from.x, to.x)
  const maxY = Math.max(from.y, to.y)

  const payload: Record<string, unknown> = {
    type: 'polyline',
    left: minX,
    top: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }],
    fill: '',
    stroke: '#1a1a2e',
    strokeWidth: 2,
    strokeDashArray,
    selectable: true,
    evented: true,
    originX: 'left',
    originY: 'top',
    zIndex: Date.now(),
    data: {
      subtype: 'connector',
      id: objectId,
      sourceObjectId: fromId,
      sourcePort,
      targetObjectId: toId,
      targetPort,
      arrowMode,
      strokeDash,
      waypoints: [],
    },
  }

  await writeDocument(boardId, objectId, payload)
  return objectId
}

// ─── update ───────────────────────────────────────────────────────────────────

/**
 * Move an object to a new position.
 */
export async function moveObject(
  boardId: string,
  objectId: string,
  x: number,
  y: number
): Promise<void> {
  return updateObject(boardId, objectId, { left: x, top: y })
}

/**
 * Resize an object.
 */
export async function resizeObject(
  boardId: string,
  objectId: string,
  width: number,
  height: number
): Promise<void> {
  return updateObject(boardId, objectId, { width, height })
}

/**
 * Update the text content of a text, sticky note, or labelled shape.
 */
export async function updateText(
  boardId: string,
  objectId: string,
  newText: string
): Promise<void> {
  return updateObject(boardId, objectId, { text: newText })
}

/**
 * Change the fill color of an object.
 * Accepts any CSS color string (hex, rgb, named).
 */
export async function changeColor(
  boardId: string,
  objectId: string,
  color: string
): Promise<void> {
  return updateObject(boardId, objectId, { fill: color })
}

// ─── query ────────────────────────────────────────────────────────────────────

export interface BoardObject {
  objectId: string
  type: string
  left: number
  top: number
  width: number
  height: number
  fill: string | null
  text: string | null
  data: Record<string, unknown>
}

/**
 * Return all objects currently on the board.
 * Useful for AI context — pass results to the model so it knows what's on the board.
 */
export async function getBoardState(boardId: string): Promise<BoardObject[]> {
  const docs = await queryObjects(boardId)
  return docs.map(({ objectId, data }) => ({
    objectId,
    type: typeof data.type === 'string' ? data.type : 'unknown',
    left: typeof data.left === 'number' ? data.left : 0,
    top: typeof data.top === 'number' ? data.top : 0,
    width: typeof data.width === 'number' ? data.width : 0,
    height: typeof data.height === 'number' ? data.height : 0,
    fill: typeof data.fill === 'string' ? data.fill : null,
    text: typeof data.text === 'string' ? data.text : null,
    data,
  }))
}
