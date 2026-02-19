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

export async function executeAiCommands(
  boardId: string,
  commands: AiCommand[]
): Promise<{ ok: boolean; error?: string }> {
  let lastQueryResults: { objectId: string; data: Record<string, unknown> }[] = []
  const baseZ = Date.now()
  let createIndex = 0

  for (const cmd of commands) {
    try {
      if (cmd.action === 'createObject') {
        const type = normalizeCreateType(cmd.type)
        const props = toCreateProps(cmd.props ?? {})
        await createObject(boardId, type, props, { zIndex: baseZ + createIndex })
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
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  }

  return { ok: true }
}
