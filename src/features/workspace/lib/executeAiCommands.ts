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
import { TEMPLATE_REGISTRY } from './templateRegistry'
import { getDocumentsByIds } from '../api/documentsApi'
import type { AiCommand } from '../api/aiInterpretApi'

const VALID_CREATE_TYPES: CreateObjectType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky', 'input-field', 'button']

/** Bounds tracked from in-flight createObject commands (using props, no DB round-trip). */
interface TrackedBounds {
  objectId: string
  left: number
  top: number
  width: number
  height: number
}

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
  // Use the actual top-left corner of the selection as origin, not DB-order first object.
  const originLeft = Math.min(...bounds.map((b) => b.left))
  const originTop = Math.min(...bounds.map((b) => b.top))
  // Sort spatially (reading order: left-to-right, then top-to-bottom) so grid placement
  // matches the visual positions the user expects.
  const sorted = [...bounds].sort((a, b) => {
    const rowA = Math.round(a.top / rowH)
    const rowB = Math.round(b.top / rowH)
    return rowA !== rowB ? rowA - rowB : a.left - b.left
  })
  await Promise.all(
    sorted.map((b, i) => {
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

  // Align all objects to the average center on the perpendicular axis so they
  // form an actual straight line (not just evenly spaced at varying heights/lefts).
  const avgPerp =
    direction === 'horizontal'
      ? sorted.reduce((acc, b) => acc + b.top + b.height / 2, 0) / sorted.length
      : sorted.reduce((acc, b) => acc + b.left + b.width / 2, 0) / sorted.length

  let cursor = direction === 'horizontal' ? first.left : first.top
  await Promise.all(
    sorted.map((b, i) => {
      const perpPos =
        direction === 'horizontal' ? avgPerp - b.height / 2 : avgPerp - b.width / 2

      if (i === 0) {
        cursor += direction === 'horizontal' ? b.width + gap : b.height + gap
        return updateObject(boardId, b.objectId,
          direction === 'horizontal' ? { top: perpPos } : { left: perpPos }
        )
      }
      const mainPos =
        i === sorted.length - 1
          ? direction === 'horizontal' ? last.left : last.top
          : cursor
      cursor += (direction === 'horizontal' ? b.width : b.height) + gap
      return updateObject(boardId, b.objectId,
        direction === 'horizontal'
          ? { left: mainPos, top: perpPos }
          : { top: mainPos, left: perpPos }
      )
    })
  )
}

export interface ExecuteAiOptions {
  /** Creates a frame container on the canvas and returns its objectId. */
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => string
  /** Sets a frame's child object IDs and syncs. Used after template creation. */
  setFrameChildren?: (frameId: string, childIds: string[]) => void
  /** Creates a DataTable on the canvas and returns its objectId. */
  createTable?: (params: {
    left: number
    top: number
    width: number
    height: number
    title: string
    showTitle: boolean
    accentColor?: string
    formSchema: import('../lib/frameFormTypes').FormSchema | null
  }) => string
  /** Returns the current viewport center in scene coordinates. */
  getViewportCenter?: () => { x: number; y: number }
  /** Creates the parrot spiral zoom showcase. */
  createZoomSpiral?: (options?: { count?: number }) => void
}

const FRAME_PADDING = 28
const FRAME_HEADER_EXTRA = 44

export async function executeAiCommands(
  boardId: string,
  commands: AiCommand[],
  options?: ExecuteAiOptions
): Promise<{ ok: boolean; error?: string; createdIds: string[]; shouldGroup: boolean }> {
  let lastQueryResults: { objectId: string; data: Record<string, unknown> }[] = []
  const baseZ = Date.now()
  let createIndex = 0
  const createdIds: string[] = []
  const trackedBounds: TrackedBounds[] = []
  let shouldGroup = false

  for (const cmd of commands) {
    try {
      if (cmd.action === 'createObject') {
        const type = normalizeCreateType(cmd.type)
        const props = toCreateProps(cmd.props ?? {})
        const objectId = await createObject(boardId, type, props, { zIndex: baseZ + createIndex })
        createdIds.push(objectId)
        trackedBounds.push({
          objectId,
          left: props.left,
          top: props.top,
          width: typeof props.width === 'number' ? props.width : 100,
          height: typeof props.height === 'number' ? props.height : 80,
        })
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
      } else if (cmd.action === 'createFrame') {
        if (trackedBounds.length >= 1 && options?.createFrame) {
          const title = cmd.title ?? 'Frame'
          const minLeft = Math.min(...trackedBounds.map((b) => b.left)) - FRAME_PADDING
          const minTop = Math.min(...trackedBounds.map((b) => b.top)) - FRAME_PADDING - FRAME_HEADER_EXTRA
          const maxRight = Math.max(...trackedBounds.map((b) => b.left + b.width)) + FRAME_PADDING
          const maxBottom = Math.max(...trackedBounds.map((b) => b.top + b.height)) + FRAME_PADDING
          options.createFrame({
            title,
            childIds: [...createdIds],
            left: minLeft,
            top: minTop,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
          })
        }
      } else if (cmd.action === 'applyTemplate') {
        const spec = TEMPLATE_REGISTRY[cmd.templateId]
        if (!spec || !options?.createFrame) {
          // Unknown template or no createFrame callback — skip silently
        } else {
          const center = options.getViewportCenter?.() ?? { x: 400, y: 300 }
          const frameLeft = Math.round(center.x - spec.frameWidth / 2)
          const frameTop = Math.round(center.y - spec.frameHeight / 2)

          // Create frame first; childIds are set explicitly after all children are created
          const templateFrameId = options.createFrame({
            title: spec.frameTitle,
            childIds: [],
            left: frameLeft,
            top: frameTop,
            width: spec.frameWidth,
            height: spec.frameHeight,
          })
          const templateChildIds: string[] = []

          // Create all child objects with absolute coords = frameLeft + relLeft
          for (const obj of spec.objects) {
            if (obj.type === 'table') {
              if (!options?.createTable) continue
              const objectId = options.createTable({
                left: frameLeft + obj.relLeft,
                top: frameTop + obj.relTop,
                width: obj.width,
                height: obj.height,
                title: obj.text ?? 'Table',
                showTitle: obj.showTitle ?? false,
                accentColor: obj.accentColor,
                formSchema: obj.formSchema
                  ? { columns: obj.formSchema.columns, rows: obj.formSchema.rows }
                  : null,
              })
              createdIds.push(objectId)
              templateChildIds.push(objectId)
              trackedBounds.push({
                objectId,
                left: frameLeft + obj.relLeft,
                top: frameTop + obj.relTop,
                width: obj.width,
                height: obj.height,
              })
              createIndex++
              continue
            }
            const objectId = await createObject(
              boardId,
              obj.type as CreateObjectType,
              {
                left: frameLeft + obj.relLeft,
                top: frameTop + obj.relTop,
                width: obj.width,
                height: obj.height,
                fill: obj.fill,
                stroke: obj.stroke,
                strokeWeight: obj.strokeWeight,
                text: obj.text,
                fontSize: obj.fontSize,
              },
              { zIndex: baseZ + createIndex }
            )
            createdIds.push(objectId)
            templateChildIds.push(objectId)
            trackedBounds.push({
              objectId,
              left: frameLeft + obj.relLeft,
              top: frameTop + obj.relTop,
              width: obj.width,
              height: obj.height,
            })
            createIndex++
          }
          // Explicitly register all children with the frame so moving the frame moves them too.
          // This is needed because Supabase-inserted objects arrive via realtime with isApplyingRemote=true,
          // which skips the automatic checkAndUpdateFrameMembership path.
          if (templateFrameId && templateChildIds.length > 0 && options?.setFrameChildren) {
            options.setFrameChildren(templateFrameId, templateChildIds)
          }
        }
      } else if (cmd.action === 'createZoomSpiral') {
        options?.createZoomSpiral?.({ count: cmd.count })
      } else if (cmd.action === 'createGrid') {
        const rows = typeof cmd.rows === 'number' ? Math.max(1, cmd.rows) : 2
        const cols = typeof cmd.cols === 'number' ? Math.max(1, cmd.cols) : 3
        const w = typeof cmd.width === 'number' ? cmd.width : 200
        const h = typeof cmd.height === 'number' ? cmd.height : 120
        const GAP = 16
        const center = options?.getViewportCenter?.() ?? { x: 400, y: 300 }
        const totalW = cols * w + (cols - 1) * GAP
        const totalH = rows * h + (rows - 1) * GAP
        const originLeft = Math.round(center.x - totalW / 2)
        const originTop = Math.round(center.y - totalH / 2)
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const objectId = await createObject(
              boardId,
              'sticky',
              {
                left: originLeft + c * (w + GAP),
                top: originTop + r * (h + GAP),
                width: w,
                height: h,
                fill: typeof cmd.fill === 'string' ? cmd.fill : '#fff9c4',
                text: '',
              },
              { zIndex: baseZ + createIndex }
            )
            createdIds.push(objectId)
            createIndex++
          }
        }
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
