/**
 * Execute AI commands returned by ai-interpret.
 * Uses aiClientApi for create/update/delete/query; client applies via Realtime.
 */

import {
  createObject,
  updateObject,
  deleteObjects,
  queryObjects,
  type CreateObjectType,
  type CreateObjectProps,
  type UpdateObjectProps,
  type QueryObjectsCriteria,
} from '../api/aiClientApi'
import { getDocumentsByIds } from '../api/documentsApi'
import type { AiCommand } from '../api/aiInterpretApi'

const VALID_CREATE_TYPES: CreateObjectType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky']

function normalizeCreateType(type: string): CreateObjectType {
  const lower = type?.toLowerCase() ?? 'rect'
  if (VALID_CREATE_TYPES.includes(lower as CreateObjectType)) {
    return lower as CreateObjectType
  }
  return 'rect'
}

function toCreateProps(props: Record<string, unknown>): CreateObjectProps {
  const left = typeof props.left === 'number' ? props.left : 0
  const top = typeof props.top === 'number' ? props.top : 0
  const result: CreateObjectProps = { left, top }
  if (typeof props.width === 'number') result.width = props.width
  if (typeof props.height === 'number') result.height = props.height
  if (typeof props.fill === 'string') result.fill = props.fill
  if (typeof props.stroke === 'string') result.stroke = props.stroke
  if (typeof props.strokeWeight === 'number') result.strokeWeight = props.strokeWeight
  if (typeof props.text === 'string') result.text = props.text
  if (typeof props.fontSize === 'number') result.fontSize = props.fontSize
  return result
}

function toUpdateProps(partialProps: Record<string, unknown>): UpdateObjectProps {
  const result: UpdateObjectProps = {}
  if (typeof partialProps.left === 'number') result.left = partialProps.left
  if (typeof partialProps.top === 'number') result.top = partialProps.top
  if (typeof partialProps.width === 'number') result.width = partialProps.width
  if (typeof partialProps.height === 'number') result.height = partialProps.height
  if (typeof partialProps.fill === 'string') result.fill = partialProps.fill
  if (typeof partialProps.stroke === 'string') result.stroke = partialProps.stroke
  if (typeof partialProps.strokeWeight === 'number') result.strokeWeight = partialProps.strokeWeight
  if (typeof partialProps.text === 'string') result.text = partialProps.text
  if (typeof partialProps.fontSize === 'number') result.fontSize = partialProps.fontSize
  return result
}

interface ObjectBounds {
  objectId: string
  left: number
  top: number
  width: number
  height: number
}

async function fetchBounds(boardId: string, objectIds: string[]): Promise<ObjectBounds[]> {
  const docs = await getDocumentsByIds(boardId, objectIds)
  return docs.map((d) => ({
    objectId: d.objectId,
    left: typeof d.data.left === 'number' ? d.data.left : 0,
    top: typeof d.data.top === 'number' ? d.data.top : 0,
    width: typeof d.data.width === 'number' ? d.data.width : 100,
    height: typeof d.data.height === 'number' ? d.data.height : 80,
  }))
}

async function arrangeInGrid(boardId: string, objectIds: string[], cols: number): Promise<void> {
  const bounds = await fetchBounds(boardId, objectIds)
  if (bounds.length === 0) return
  const GAP = 16
  const colW = Math.max(...bounds.map((b) => b.width)) + GAP
  const rowH = Math.max(...bounds.map((b) => b.height)) + GAP
  const originLeft = bounds[0].left
  const originTop = bounds[0].top
  await Promise.all(
    bounds.map((b, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      return updateObject(boardId, b.objectId, {
        left: originLeft + col * colW,
        top: originTop + row * rowH,
      })
    })
  )
}

async function spaceEvenly(
  boardId: string,
  objectIds: string[],
  direction: 'horizontal' | 'vertical'
): Promise<void> {
  const bounds = await fetchBounds(boardId, objectIds)
  if (bounds.length < 2) return
  const sorted = [...bounds].sort((a, b) =>
    direction === 'horizontal' ? a.left - b.left : a.top - b.top
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalSpan =
    direction === 'horizontal'
      ? last.left + last.width - first.left
      : last.top + last.height - first.top
  const totalSize = sorted.reduce(
    (acc, b) => acc + (direction === 'horizontal' ? b.width : b.height),
    0
  )
  const gap = (totalSpan - totalSize) / (sorted.length - 1)
  let cursor = direction === 'horizontal' ? first.left : first.top
  await Promise.all(
    sorted.map((b, i) => {
      if (i === 0) {
        cursor += direction === 'horizontal' ? b.width + gap : b.height + gap
        return Promise.resolve()
      }
      const pos = i === sorted.length - 1
        ? direction === 'horizontal' ? last.left : last.top
        : cursor
      const update =
        direction === 'horizontal' ? { left: pos } : { top: pos }
      cursor += (direction === 'horizontal' ? b.width : b.height) + gap
      return updateObject(boardId, b.objectId, update)
    })
  )
}

export async function executeAiCommands(
  boardId: string,
  commands: AiCommand[]
): Promise<{ ok: boolean; error?: string; createdIds: string[]; shouldGroup: boolean }> {
  let lastQueryResults: { objectId: string; data: Record<string, unknown> }[] = []
  const baseZ = Date.now()
  let createIndex = 0
  const createdIds: string[] = []
  let shouldGroup = false

  for (const cmd of commands) {
    try {
      if (cmd.action === 'createObject') {
        const type = normalizeCreateType(cmd.type)
        const props = toCreateProps(cmd.props ?? {})
        const objectId = await createObject(boardId, type, props, { zIndex: baseZ + createIndex })
        createdIds.push(objectId)
        createIndex++
      } else if (cmd.action === 'queryObjects') {
        const criteria: QueryObjectsCriteria | undefined = cmd.criteria
          ? { type: cmd.criteria.type, fill: cmd.criteria.fill }
          : undefined
        lastQueryResults = await queryObjects(boardId, criteria)
      } else if (cmd.action === 'deleteObjects') {
        let objectIds = cmd.objectIds ?? []
        if (cmd.objectIdsFromPreviousQuery) {
          objectIds = lastQueryResults.map((r) => r.objectId)
        }
        if (objectIds.length > 0) {
          await deleteObjects(boardId, objectIds)
        }
      } else if (cmd.action === 'updateObject') {
        const partialProps = toUpdateProps(cmd.partialProps ?? {})
        await updateObject(boardId, cmd.objectId, partialProps)
      } else if (cmd.action === 'arrangeInGrid') {
        const ids = Array.isArray(cmd.objectIds) ? cmd.objectIds : []
        const cols = typeof cmd.cols === 'number' && cmd.cols > 0 ? cmd.cols : 3
        await arrangeInGrid(boardId, ids, cols)
      } else if (cmd.action === 'spaceEvenly') {
        const ids = Array.isArray(cmd.objectIds) ? cmd.objectIds : []
        const dir = cmd.direction === 'vertical' ? 'vertical' : 'horizontal'
        await spaceEvenly(boardId, ids, dir)
      } else if (cmd.action === 'groupCreated') {
        shouldGroup = true
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg, createdIds, shouldGroup }
    }
  }

  return { ok: true, createdIds, shouldGroup }
}
