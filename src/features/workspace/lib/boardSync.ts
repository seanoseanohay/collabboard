/**
 * Connects Fabric canvas to Supabase for delta sync.
 * Document sync: always runs for position/add/remove updates.
 * Lock sync: optional, acquire on selection, release on deselection.
 * Split so document sync is NOT torn down when auth (lock options) changes.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'

/** When object is inside a group/ActiveSelection, left/top/angle/scale are relative. Override with scene (absolute) transform.
 * Uses Fabric's addTransformToObject + setPositionByOrigin so the conversion correctly respects the object's originX/originY.
 * (calcTransformMatrix gives the scene CENTER, but left/top are the ORIGIN which differs when originX/Y != 'center'.) */
function payloadWithSceneCoords(
  obj: FabricObject,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const group = (obj as unknown as { group?: FabricObject & { calcOwnMatrix: () => number[] } }).group
  if (!group) return payload
  const origProps = {
    left: obj.left, top: obj.top, angle: obj.angle,
    scaleX: obj.scaleX, scaleY: obj.scaleY,
    skewX: obj.skewX, skewY: obj.skewY,
    flipX: obj.flipX, flipY: obj.flipY,
  }
  util.addTransformToObject(obj, group.calcOwnMatrix())
  const result = {
    ...payload,
    left: obj.left, top: obj.top, angle: obj.angle,
    scaleX: obj.scaleX, scaleY: obj.scaleY,
    skewX: obj.skewX, skewY: obj.skewY,
    flipX: obj.flipX, flipY: obj.flipY,
  }
  obj.set(origProps)
  return result
}

/** Scene position of the event target (single object or ActiveSelection). Used for move-delta so we never use selection-relative (0,0) as base.
 * For multi-selection (ActiveSelection), use the centroid of children's scene positions so the delta matches actual movement; the selection's
 * own transform can be stale or use a different origin during drag, which caused other clients to see continuous drift down/right. */
function getTargetSceneCenter(target: FabricObject): { x: number; y: number } {
  if ('getObjects' in target) {
    const children = (target as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o))
    if (children.length > 0) {
      let sx = 0
      let sy = 0
      for (const obj of children) {
        const matrix = obj.calcTransformMatrix()
        const d = util.qrDecompose(matrix)
        sx += d.translateX
        sy += d.translateY
      }
      return { x: sx / children.length, y: sy / children.length }
    }
  }
  const matrix = target.calcTransformMatrix()
  const d = util.qrDecompose(matrix)
  return { x: d.translateX, y: d.translateY }
}

export type MoveDeltaPayload = {
  userId: string
  objectIds: string[]
  dx: number
  dy: number
}
import { getSupabaseClient } from '@/shared/lib/supabase/config'
import {
  subscribeToDocuments,
  writeDocument,
  writeDocumentsBatch,
  deleteDocument,
} from '../api/documentsApi'
import {
  subscribeToLocks,
  acquireLocksBatch,
  releaseLocksBatch,
  setupLockDisconnect,
  type LockEntry,
} from '../api/locksApi'
import { updateStickyTextFontSize, updateStickyPlaceholderVisibility } from './shapeFactory'
import { isFrame, getFrameChildIds, setFrameChildIds } from './frameUtils'
import { isDataTable } from './dataTableUtils'
import {
  updateConnectorEndpoints,
  syncConnectorMoveLock,
  getConnectorData,
  isConnector,
  getStrokeDashArray,
  type StrokeDash,
} from './connectorFactory'

/** Fire a custom (non-typed) Fabric canvas event. */
const fireCanvasCustom = (canvas: Canvas, event: string, payload: object) =>
  (canvas as unknown as { fire: (e: string, p: object) => void }).fire(event, payload)

/** Register a handler for a custom (non-typed) Fabric canvas event. */
const onCanvasCustom = (canvas: Canvas, event: string, handler: (e: object) => void) =>
  (canvas as unknown as { on: (e: string, h: (p: object) => void) => void }).on(event, handler)

/** Remove a handler for a custom (non-typed) Fabric canvas event. */
const offCanvasCustom = (canvas: Canvas, event: string, handler: (e: object) => void) =>
  (canvas as unknown as { off: (e: string, h: (p: object) => void) => void }).off(event, handler)

const OBJ_ID_KEY = 'id'

export function getObjectId(obj: FabricObject): string | null {
  const data = obj.get('data') as { id?: string } | undefined
  return (data?.id ?? null) as string | null
}

export function setObjectId(obj: FabricObject, id: string): void {
  obj.set('data', { ...(obj.get('data') as object), [OBJ_ID_KEY]: id })
}

const ZINDEX_KEY = 'zIndex'

export function getObjectZIndex(obj: FabricObject): number {
  const z = obj.get(ZINDEX_KEY) as number | undefined
  return typeof z === 'number' && !Number.isNaN(z) ? z : 0
}

export function setObjectZIndex(obj: FabricObject, z: number): void {
  obj.set(ZINDEX_KEY, z)
}

/** Sort canvas objects by zIndex (ascending); reorder so lowest is at back.
 * Sorts Fabric's internal _objects array directly (O(N log N)) instead of calling
 * bringObjectToFront N times (O(N²)) — critical for boards with many objects. */
export function sortCanvasByZIndex(canvas: Canvas): void {
  const internal = canvas as unknown as { _objects: FabricObject[] }
  if (internal._objects) {
    internal._objects.sort((a: FabricObject, b: FabricObject) => getObjectZIndex(a) - getObjectZIndex(b))
  } else {
    // Fallback for unexpected Fabric API change
    const objects = canvas.getObjects().slice()
    objects.sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
    objects.forEach((obj) => canvas.bringObjectToFront(obj))
  }
  canvas.requestRenderAll()
}

export interface BoardSyncLockOptions {
  userId: string
  userName: string
}

/** Mutable ref so lock sync can register callback for re-applying lock state after remote updates. */
export type LockStateCallbackRef = { current: (() => void) | null }

export function applyLockState(
  canvas: Canvas,
  locks: LockEntry[],
  currentUserId: string
): void {
  const lockedByOthers = new Set(
    locks.filter((l) => l.userId !== currentUserId).map((l) => l.objectId)
  )

  for (const obj of canvas.getObjects()) {
    const id = getObjectId(obj)
    if (!id) continue
    const locked = lockedByOthers.has(id)
    
    obj.set({
      selectable: !locked,
      evented: !locked,  // Prevent all mouse events on locked objects
      hoverCursor: locked ? 'not-allowed' : undefined,
    })
    
    // Ensure Group children remain non-selectable regardless of lock state
    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => unknown[] }).getObjects()
      children.forEach((child: unknown) => {
        if (child && typeof child === 'object' && 'set' in child) {
          (child as { set: (props: { selectable: boolean; evented: boolean }) => void }).set({
            selectable: false,
            evented: false,
          })
        }
      })
    }
  }

  canvas.requestRenderAll()
}

/**
 * Sets up document sync only. Never depends on auth.
 * Call applyLockStateCallbackRef.current?.() after remote updates if lock sync is active.
 * getCurrentUserId: optional; used to ignore our own move-delta broadcasts and avoid applying them locally.
 * remoteChangeRef: optional mutable ref toggled true while canvas is mutated by remote events — lets history manager skip recording.
 * onSyncLatency: optional; called with round-trip ms when our own write echoes back via postgres_changes.
 */
export function setupDocumentSync(
  canvas: Canvas,
  boardId: string,
  applyLockStateCallbackRef: LockStateCallbackRef,
  getCurrentUserId?: () => string,
  remoteChangeRef?: { current: boolean },
  onSyncLatency?: (ms: number) => void,
  connectorCacheRef?: { current: Set<FabricObject> },
  onBoardReady?: () => void
): () => void {
  const pendingWriteTimestamps = new Map<string, number>()
  let isApplyingRemote = false
  // During initial bulk load, skip per-object sort+render; do one pass at the end
  let isBulkLoading = false

  // Object ID → FabricObject index for O(1) lookups instead of O(N) canvas.getObjects().find()
  const objectIndex = new Map<string, FabricObject>()

  const stripSyncFields = (d: Record<string, unknown>) => {
    const { updatedAt, ...rest } = d
    return rest
  }

  const ensureGroupChildrenNotSelectable = (obj: FabricObject) => {
    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
      children.forEach((child) => {
        child.set({ selectable: false, evented: false })
      })
    }
  }

  const ensureTextEditable = (obj: FabricObject) => {
    if (obj.type === 'i-text' && 'editable' in obj) obj.set('editable', true)
    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
      children.forEach(ensureTextEditable)
    }
  }

  const applyZIndex = (obj: FabricObject, data: Record<string, unknown>) => {
    const z = (data.zIndex as number) ?? Date.now()
    setObjectZIndex(obj, z)
  }

  const applyRemote = async (objectId: string, data: Record<string, unknown>) => {
    const writeSentAt = pendingWriteTimestamps.get(objectId)
    if (writeSentAt !== undefined) {
      pendingWriteTimestamps.delete(objectId)
      onSyncLatency?.(Date.now() - writeSentAt)
    }
    if (remoteChangeRef) remoteChangeRef.current = true
    try {
      const clean = stripSyncFields(data)
      const existing = objectIndex.get(objectId)
      if (existing) {
        // Skip objects that we are currently transforming. Our own document writes echo back
        // via postgres_changes; applying stale data would overwrite the in-progress transform
        // and cause flicker (especially during scale flip). Single selection: existing === active.
        // Multi-select: existing is a child of active (existing.group === active).
        const active = canvas.getActiveObject()
        if (existing === active) return
        if (existing.group && existing.group === active) return
        if (existing.type === 'group') {
          try {
            const isContainerGroup = (obj: FabricObject) => {
              const d = obj.get('data') as { subtype?: string } | undefined
              return d?.subtype === 'container'
            }
            const isFrameGroup = (obj: FabricObject) => {
              const d = obj.get('data') as { subtype?: string } | undefined
              return d?.subtype === 'frame'
            }
            const isTableGroup = (obj: FabricObject) => {
              const d = obj.get('data') as { subtype?: string } | undefined
              return d?.subtype === 'table'
            }
            const objData = { ...clean, data: { id: objectId } }
            const [revived] = await util.enlivenObjects<FabricObject>([objData])
            if (revived) {
              existing.set({
                left: revived.left,
                top: revived.top,
                angle: revived.angle,
                scaleX: revived.scaleX,
                scaleY: revived.scaleY,
                flipX: revived.flipX,
                flipY: revived.flipY,
              })
              existing.setCoords()
              // Sync frame childIds/title from remote
              if (isFrameGroup(existing)) {
                const existingData = existing.get('data') as Record<string, unknown>
                existing.set('data', {
                  ...existingData,
                  title: (clean.frameTitle as string) ?? existingData['title'],
                  childIds: (clean.childIds as string[]) ?? existingData['childIds'] ?? [],
                })
                fireCanvasCustom(canvas, 'frame:data:changed', { frameId: objectId })
              }
              // Sync table title/formSchema from remote
              if (isTableGroup(existing)) {
                const existingData = existing.get('data') as Record<string, unknown>
                existing.set('data', {
                  ...existingData,
                  title: (clean.tableTitle as string) ?? existingData['title'],
                  formSchema: Object.prototype.hasOwnProperty.call(clean, 'formSchema')
                    ? (clean.formSchema ?? null)
                    : (existingData['formSchema'] ?? null),
                })
                fireCanvasCustom(canvas, 'table:data:changed', { tableId: objectId })
              }
              // Only sync text content for sticky groups (not container, frame, or table groups)
              if (!isContainerGroup(existing) && !isFrameGroup(existing) && !isTableGroup(existing) && 'getObjects' in existing && 'getObjects' in revived) {
                const existingChildren = (existing as { getObjects: () => FabricObject[] }).getObjects()
                const revivedChildren = (revived as { getObjects: () => FabricObject[] }).getObjects()
                const existingTexts = existingChildren.filter((c) => c.type === 'i-text')
                const revivedTexts = revivedChildren.filter((c) => c.type === 'i-text')
                if (existingTexts.length && revivedTexts.length) {
                  existingTexts[existingTexts.length - 1].set(
                    'text',
                    (revivedTexts[revivedTexts.length - 1].get('text') as string) ?? ''
                  )
                }
              }
              applyZIndex(existing, clean)
              const existingSubtype = (existing.get('data') as { subtype?: string } | undefined)?.subtype
              if (!isContainerGroup(existing) && !isFrameGroup(existing) && !isTableGroup(existing)
                  && existingSubtype !== 'input-field' && existingSubtype !== 'button') {
                updateStickyTextFontSize(existing)
                updateStickyPlaceholderVisibility(existing)
              }
              ensureGroupChildrenNotSelectable(existing)
              ensureTextEditable(existing)
              applyLockStateCallbackRef.current?.()
              sortCanvasByZIndex(canvas)
              updateConnectorsForObjects(new Set([objectId]))
              canvas.requestRenderAll()
            }
          } catch {
            /* ignore */
          }
          return
        }
        try {
          const objData = { ...clean, data: { id: objectId } }
          const [revived] = await util.enlivenObjects<FabricObject>([objData])
          if (revived) {
            const serialized = revived.toObject(['data']) as Record<string, unknown>
            delete serialized.data
            delete serialized.type
            delete (serialized as { layoutManager?: unknown }).layoutManager
            existing.set(serialized)
            existing.setCoords()
            applyZIndex(existing, clean)
            ensureTextEditable(existing)
            if (isConnector(existing)) {
              updateConnectorEndpoints(existing, canvas)
              syncConnectorMoveLock(existing)
            } else {
              updateConnectorsForObjects(new Set([objectId]))
            }
            applyLockStateCallbackRef.current?.()
            sortCanvasByZIndex(canvas)
            canvas.requestRenderAll()
          }
        } catch {
          /* ignore */
        }
        return
      }
      try {
        const subtype = (clean.subtype as string | undefined) ?? undefined
        const frameData =
          subtype === 'frame'
            ? {
                title: (clean.frameTitle as string) ?? 'Frame',
                childIds: (clean.childIds as string[]) ?? [],
              }
            : {}
        const tableData =
          subtype === 'table'
            ? {
                title: (clean.tableTitle as string) ?? 'Untitled Table',
                formSchema: (clean.formSchema ?? null) as unknown,
              }
            : {}
        const connectorData =
          subtype === 'connector'
            ? {
                sourceObjectId: (clean.sourceObjectId as string | null) ?? null,
                sourcePort: (clean.sourcePort as string) ?? 'mt',
                targetObjectId: (clean.targetObjectId as string | null) ?? null,
                targetPort: (clean.targetPort as string) ?? 'mt',
                arrowMode: (clean.arrowMode as string) ?? 'end',
                strokeDash: (clean.strokeDash as string) ?? 'solid',
                waypoints: (clean.waypoints as { x: number; y: number }[]) ?? [],
                ...(clean.sourceFloatPoint ? { sourceFloatPoint: clean.sourceFloatPoint } : {}),
                ...(clean.targetFloatPoint ? { targetFloatPoint: clean.targetFloatPoint } : {}),
              }
            : {}
        const objData = {
          ...clean,
          data: { id: objectId, ...(subtype && { subtype }), ...frameData, ...tableData, ...connectorData },
        }
        const [revived] = await util.enlivenObjects<FabricObject>([objData])
        if (revived) {
          revived.set('data', { id: objectId, ...(subtype && { subtype }), ...frameData, ...tableData, ...connectorData })
          applyZIndex(revived, clean)
          if (revived.type === 'group') {
            const revivedData = revived.get('data') as { subtype?: string } | undefined
            if (revivedData?.subtype !== 'container' && revivedData?.subtype !== 'frame'
                && revivedData?.subtype !== 'table'
                && revivedData?.subtype !== 'input-field' && revivedData?.subtype !== 'button') {
              updateStickyTextFontSize(revived)
              updateStickyPlaceholderVisibility(revived)
            }
          }
          ensureGroupChildrenNotSelectable(revived)
          ensureTextEditable(revived)
          if (subtype === 'connector') {
            updateConnectorEndpoints(revived, canvas)
            syncConnectorMoveLock(revived)
            const cDash = (connectorData as { strokeDash?: string }).strokeDash
            if (cDash) revived.set('strokeDashArray', getStrokeDashArray(cDash as StrokeDash))
          }
          isApplyingRemote = true
          canvas.add(revived)
          revived.setCoords()
          applyLockStateCallbackRef.current?.()
          if (!isBulkLoading) {
            sortCanvasByZIndex(canvas)
            canvas.requestRenderAll()
          }
          isApplyingRemote = false
          if (subtype === 'frame') fireCanvasCustom(canvas, 'frame:data:changed', { frameId: objectId })
          if (subtype === 'table') fireCanvasCustom(canvas, 'table:data:changed', { tableId: objectId })
        }
      } catch {
        /* ignore */
      }
    } finally {
      if (remoteChangeRef) remoteChangeRef.current = false
    }
  }

  const removeRemote = (objectId: string) => {
    const obj = objectIndex.get(objectId)
    if (obj) {
      isApplyingRemote = true
      if (remoteChangeRef) remoteChangeRef.current = true
      canvas.remove(obj)
      canvas.requestRenderAll()
      isApplyingRemote = false
      if (remoteChangeRef) remoteChangeRef.current = false
    }
  }

  const emitAdd = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    let payload = obj.toObject(['data', 'objects', 'zIndex']) as Record<string, unknown>
    payload = payloadWithSceneCoords(obj, payload)
    const data = payload.data as { subtype?: string; sourceObjectId?: string | null; sourcePort?: string; targetObjectId?: string | null; targetPort?: string; hasArrow?: boolean; arrowMode?: string; strokeDash?: string; waypoints?: unknown[]; sourceFloatPoint?: unknown; targetFloatPoint?: unknown } | undefined
    if (obj.type === 'group' && data?.subtype === 'container') {
      payload.subtype = 'container'
    }
    if (obj.type === 'group' && data?.subtype === 'frame') {
      payload.subtype = 'frame'
      payload.frameTitle = (data as unknown as { title?: string }).title ?? 'Frame'
      payload.childIds = (data as unknown as { childIds?: string[] }).childIds ?? []
    }
    if (obj.type === 'group' && data?.subtype === 'table') {
      payload.subtype = 'table'
      payload.tableTitle = (data as unknown as { title?: string }).title ?? 'Untitled Table'
      payload.formSchema = (data as unknown as { formSchema?: unknown }).formSchema ?? null
    }
    if (data?.subtype === 'connector') {
      payload.subtype = 'connector'
      payload.sourceObjectId = data.sourceObjectId ?? null
      payload.sourcePort = data.sourcePort
      payload.targetObjectId = data.targetObjectId ?? null
      payload.targetPort = data.targetPort
      payload.arrowMode = data.arrowMode ?? 'end'
      payload.strokeDash = data.strokeDash ?? 'solid'
      payload.waypoints = data.waypoints ?? []
      if (data.sourceFloatPoint) payload.sourceFloatPoint = data.sourceFloatPoint
      if (data.targetFloatPoint) payload.targetFloatPoint = data.targetFloatPoint
    }
    if (obj.type === 'group' && data?.subtype === 'input-field') {
      payload.subtype = 'input-field'
    }
    if (obj.type === 'group' && data?.subtype === 'button') {
      payload.subtype = 'button'
    }
    delete payload.data
    delete (payload as { layoutManager?: unknown }).layoutManager
    const z = (payload.zIndex as number) ?? Date.now()
    payload.zIndex = z
    setObjectZIndex(obj, z)
    pendingWriteTimestamps.set(id, Date.now())
    writeDocument(boardId, id, payload).catch(console.error)
  }

  /** Resolve event target to objects to sync: single object with id, or each object in ActiveSelection (multi-selection).
   * For frame objects, also includes all associated child canvas objects so their positions are written to DB on drop. */
  const getObjectsToSync = (target: FabricObject): FabricObject[] => {
    if (getObjectId(target)) {
      if (isFrame(target)) {
        const childIds = getFrameChildIds(target)
        const children = childIds
          .map((id) => objectIndex.get(id))
          .filter((o): o is FabricObject => !!o)
        return [target, ...children]
      }
      return [target]
    }
    if ('getObjects' in target) {
      const children = (target as { getObjects: () => FabricObject[] }).getObjects()
      return children.filter((o) => !!getObjectId(o))
    }
    return []
  }

  const MOVE_THROTTLE_MS = 80
  let moveThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let lastMoveEmit = 0
  let pendingMoveIds = new Set<string>()

  const buildPayload = (obj: FabricObject): Record<string, unknown> | null => {
    let payload = obj.toObject(['data', 'objects', 'zIndex']) as Record<string, unknown>
    payload = payloadWithSceneCoords(obj, payload)
    const data = payload.data as { subtype?: string; sourceObjectId?: string | null; sourcePort?: string; targetObjectId?: string | null; targetPort?: string; hasArrow?: boolean; arrowMode?: string; strokeDash?: string; waypoints?: unknown[]; sourceFloatPoint?: unknown; targetFloatPoint?: unknown } | undefined
    if (obj.type === 'group' && data?.subtype === 'container') {
      payload.subtype = 'container'
    }
    if (obj.type === 'group' && data?.subtype === 'frame') {
      payload.subtype = 'frame'
      payload.frameTitle = (data as unknown as { title?: string }).title ?? 'Frame'
      payload.childIds = (data as unknown as { childIds?: string[] }).childIds ?? []
    }
    if (obj.type === 'group' && data?.subtype === 'table') {
      payload.subtype = 'table'
      payload.tableTitle = (data as unknown as { title?: string }).title ?? 'Untitled Table'
      payload.formSchema = (data as unknown as { formSchema?: unknown }).formSchema ?? null
    }
    if (data?.subtype === 'connector') {
      payload.subtype = 'connector'
      payload.sourceObjectId = data.sourceObjectId ?? null
      payload.sourcePort = data.sourcePort
      payload.targetObjectId = data.targetObjectId ?? null
      payload.targetPort = data.targetPort
      payload.arrowMode = data.arrowMode ?? 'end'
      payload.strokeDash = data.strokeDash ?? 'solid'
      payload.waypoints = data.waypoints ?? []
      if (data.sourceFloatPoint) payload.sourceFloatPoint = data.sourceFloatPoint
      if (data.targetFloatPoint) payload.targetFloatPoint = data.targetFloatPoint
    }
    if (obj.type === 'group' && data?.subtype === 'input-field') {
      payload.subtype = 'input-field'
    }
    if (obj.type === 'group' && data?.subtype === 'button') {
      payload.subtype = 'button'
    }
    delete payload.data
    delete (payload as { layoutManager?: unknown }).layoutManager
    if (payload.zIndex === undefined) payload.zIndex = getObjectZIndex(obj)
    return payload
  }

  const emitModify = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    const payload = buildPayload(obj)
    if (!payload) return
    pendingWriteTimestamps.set(id, Date.now())
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const flushPendingMovesBatch = () => {
    if (pendingMoveIds.size === 0) return
    const items: { objectId: string; data: Record<string, unknown> }[] = []
    for (const id of pendingMoveIds) {
      const target = objectIndex.get(id)
      if (target) {
        const payload = buildPayload(target)
        if (payload) {
          pendingWriteTimestamps.set(id, Date.now())
          items.push({ objectId: id, data: payload })
        }
      }
    }
    pendingMoveIds.clear()
    if (items.length > 1) {
      writeDocumentsBatch(boardId, items).catch(console.error)
    } else if (items.length === 1) {
      writeDocument(boardId, items[0].objectId, items[0].data).catch(console.error)
    }
  }

  const emitModifyThrottled = (obj: FabricObject) => {
    if (!obj || isApplyingRemote) return
    const toSync = getObjectsToSync(obj)
    if (toSync.length === 0) return
    toSync.forEach((o) => {
      const id = getObjectId(o)
      if (id) pendingMoveIds.add(id)
    })
    const now = Date.now()
    const elapsed = now - lastMoveEmit
    if (elapsed >= MOVE_THROTTLE_MS) {
      lastMoveEmit = now
      flushPendingMovesBatch()
      return
    }
    if (!moveThrottleTimer) {
      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null
        lastMoveEmit = Date.now()
        flushPendingMovesBatch()
      }, MOVE_THROTTLE_MS - elapsed)
    }
  }

  const emitRemove = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    deleteDocument(boardId, id).catch(console.error)
  }

  const hasConnectors = () =>
    connectorCacheRef?.current ? connectorCacheRef.current.size > 0 : canvas.getObjects().some((o) => isConnector(o))

  const updateConnectorsForObjects = (objectIds: Set<string>) => {
    if (!hasConnectors()) return
    const connectors = connectorCacheRef?.current
      ? Array.from(connectorCacheRef.current)
      : canvas.getObjects().filter((obj) => isConnector(obj))
    for (const obj of connectors) {
      const data = getConnectorData(obj)
      if (!data) continue
      const srcId = data.sourceObjectId
      const tgtId = data.targetObjectId
      if ((srcId && objectIds.has(srcId)) || (tgtId && objectIds.has(tgtId))) {
        updateConnectorEndpoints(obj, canvas)
      }
    }
    canvas.requestRenderAll()
  }

  const unsub = subscribeToDocuments(boardId, {
    onAdded: (objectId, data) => applyRemote(objectId, data),
    onChanged: (objectId, data) => applyRemote(objectId, data),
    onRemoved: removeRemote,
    onBulkLoadStart: () => {
      isBulkLoading = true
      ;(canvas as unknown as { renderOnAddRemove: boolean }).renderOnAddRemove = false
    },
    onBulkLoadComplete: () => {
      isBulkLoading = false
      ;(canvas as unknown as { renderOnAddRemove: boolean }).renderOnAddRemove = true
      sortCanvasByZIndex(canvas)
      canvas.requestRenderAll()
      onBoardReady?.()
    },
  })

  // Move-delta broadcast: during drag we send (dx, dy) so other clients apply same vector (low lag, correct relative positions). On drop we write absolute to documents.
  const supabase = getSupabaseClient()
  const moveChannel = supabase.channel(`move_deltas:${boardId}`)
  const DELTA_BROADCAST_MS = 50
  let lastDeltaCenter: { x: number; y: number } | null = null
  let deltaThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let lastDeltaEmit = 0
  let moveChannelReady = false

  moveChannel
    .on('broadcast', { event: 'move_delta' }, (message) => {
      const p = (message as unknown as { payload: MoveDeltaPayload }).payload
      if (!p || getCurrentUserId?.() === p.userId || isApplyingRemote) return
      if (p.dx === 0 && p.dy === 0) return
      for (const objectId of p.objectIds) {
        const obj = objectIndex.get(objectId)
        if (obj) {
          obj.set({ left: obj.left + p.dx, top: obj.top + p.dy })
          obj.setCoords()
        }
      }
      updateConnectorsForObjects(new Set(p.objectIds))
    })
    .subscribe((status) => {
      moveChannelReady = status === 'SUBSCRIBED'
    })

  const broadcastMoveDelta = (objectIds: string[], dx: number, dy: number) => {
    const uid = getCurrentUserId?.()
    if (!uid) return
    if (!moveChannelReady) return
    moveChannel.send({
      type: 'broadcast',
      event: 'move_delta',
      payload: { userId: uid, objectIds, dx, dy },
    })
  }

  const emitMoveDeltaThrottledWithTargets = (target: FabricObject) => {
    const ids = cachedSyncIds ?? getObjectsToSync(target).map((o) => getObjectId(o)).filter((id): id is string => !!id)
    if (ids.length === 0) return
    const center = getTargetSceneCenter(target)
    const now = Date.now()
    if (lastDeltaCenter === null) {
      lastDeltaCenter = center
      return
    }
    const prevDeltaCenter = lastDeltaCenter // const so TS narrows away from null
    const dx = center.x - prevDeltaCenter.x
    const dy = center.y - prevDeltaCenter.y
    const elapsed = now - lastDeltaEmit
    if (elapsed >= DELTA_BROADCAST_MS) {
      lastDeltaEmit = now
      lastDeltaCenter = center
      if (dx !== 0 || dy !== 0) broadcastMoveDelta(ids, dx, dy)
      return
    }
    if (!deltaThrottleTimer) {
      const baseCenter = lastDeltaCenter
      deltaThrottleTimer = setTimeout(() => {
        deltaThrottleTimer = null
        lastDeltaEmit = Date.now()
        // Use current selection center so we send accumulated delta, not a single-frame delta
        const active = canvas.getActiveObject()
        const currentCenter = active ? getTargetSceneCenter(active) : center
        const totalDx = currentCenter.x - baseCenter.x
        const totalDy = currentCenter.y - baseCenter.y
        lastDeltaCenter = currentCenter
        if (totalDx !== 0 || totalDy !== 0) broadcastMoveDelta(ids, totalDx, totalDy)
      }, DELTA_BROADCAST_MS - elapsed)
    }
  }

  // Frame move: track previous position so we can compute delta and propagate to children.
  const framePrevPos = new Map<string, { left: number; top: number }>()

  /** Returns true if the center of obj falls within frame's bounding rect. */
  const isObjectInsideFrame = (obj: FabricObject, frame: FabricObject): boolean => {
    obj.setCoords()
    frame.setCoords()
    const ob = obj.getBoundingRect()
    const fb = frame.getBoundingRect()
    const cx = ob.left + ob.width / 2
    const cy = ob.top + ob.height / 2
    return cx >= fb.left && cx <= fb.left + fb.width && cy >= fb.top && cy <= fb.top + fb.height
  }

  /**
   * After an object is moved or created, update frame childIds so the object belongs
   * to whichever frame contains its center (or to no frame if it's outside all frames).
   */
  const checkAndUpdateFrameMembership = (obj: FabricObject) => {
    if (isApplyingRemote) return
    const objId = getObjectId(obj)
    if (!objId || isFrame(obj) || isDataTable(obj)) return

    const allFrames = canvas.getObjects().filter((o) => isFrame(o))
    const targetFrame = allFrames.find((f) => isObjectInsideFrame(obj, f)) ?? null
    const currentFrame = allFrames.find((f) => getFrameChildIds(f).includes(objId)) ?? null

    if (targetFrame === currentFrame) return

    if (currentFrame) {
      const updated = getFrameChildIds(currentFrame).filter((id) => id !== objId)
      setFrameChildIds(currentFrame, updated)
      emitModify(currentFrame)
    }
    if (targetFrame) {
      const updated = [...getFrameChildIds(targetFrame), objId]
      setFrameChildIds(targetFrame, updated)
      emitModify(targetFrame)
    }
  }

  canvas.on('object:added', (e) => {
    if (!e.target) return
    const addedId = getObjectId(e.target)
    if (addedId) objectIndex.set(addedId, e.target)
    emitAdd(e.target)
    if (!isApplyingRemote) {
      if (isFrame(e.target)) {
        // New frame drawn: auto-capture existing canvas objects whose center is inside it.
        // Only run for real frames (assignId=true); preview frames have no id.
        const frame = e.target
        const frameId = getObjectId(frame)
        if (frameId) {
          const childIds = canvas
            .getObjects()
            .filter((o) => o !== frame && !isFrame(o) && getObjectId(o) && isObjectInsideFrame(o, frame))
            .map((o) => getObjectId(o))
            .filter((id): id is string => !!id)
          if (childIds.length > 0) {
            setFrameChildIds(frame, childIds)
            emitModify(frame)
          }
        }
      } else {
        // New non-frame object: check if it lands inside a frame
        checkAndUpdateFrameMembership(e.target)
      }
    }
  })
  canvas.on('mouse:down', (e) => {
    const target = e.target as FabricObject | undefined
    if (target && isFrame(target)) {
      const id = getObjectId(target)
      if (id) framePrevPos.set(id, { left: target.left, top: target.top })
    }
  })
  // During large multi-selection drag, enable Fabric object caching on the ActiveSelection.
  // This renders all children to a single cached bitmap once, then just draws that bitmap
  // per frame — dropping per-frame render cost from O(N) to O(1).
  let dragCacheActive = false
  let cachedSyncIds: string[] | null = null

  canvas.on('object:moving', (e) => {
    if (!e.target) return

    if (!dragCacheActive && e.target.type === 'activeselection') {
      const sel = e.target as FabricObject & { objectCaching?: boolean }
      const childCount = 'getObjects' in sel
        ? (sel as unknown as { getObjects(): FabricObject[] }).getObjects().length
        : 0
      if (childCount > 50) {
        sel.objectCaching = true
        sel.dirty = true
        dragCacheActive = true
      }
    }

    // Propagate frame movement to its child canvas objects in real-time
    if (isFrame(e.target)) {
      const frame = e.target
      const frameId = getObjectId(frame)
      if (frameId) {
        const prev = framePrevPos.get(frameId)
        if (prev) {
          const dx = frame.left - prev.left
          const dy = frame.top - prev.top
          if (dx !== 0 || dy !== 0) {
            getFrameChildIds(frame).forEach((childId) => {
              const child = objectIndex.get(childId)
              if (child) {
                child.set({ left: child.left + dx, top: child.top + dy })
                child.setCoords()
              }
            })
          }
        }
        framePrevPos.set(frameId, { left: frame.left, top: frame.top })
      }
    }

    // Cache sync target IDs for the drag to avoid O(N) recomputation per frame
    if (!cachedSyncIds) {
      const syncTargets = getObjectsToSync(e.target)
      cachedSyncIds = syncTargets
        .map((o) => getObjectId(o))
        .filter((id): id is string => !!id)
    }
    const ids = new Set(cachedSyncIds)
    if (ids.size > 0) updateConnectorsForObjects(ids)
    emitMoveDeltaThrottledWithTargets(e.target)
  })
  const getTransformIds = (target: FabricObject): Set<string> =>
    new Set(
      getObjectsToSync(target)
        .map((o) => getObjectId(o))
        .filter((id): id is string => !!id)
    )

  canvas.on('object:scaling', (e) => {
    if (e.target) {
      const ids = getTransformIds(e.target)
      if (ids.size > 0) updateConnectorsForObjects(ids)
      emitModifyThrottled(e.target)
    }
  })
  canvas.on('object:rotating', (e) => {
    if (e.target) {
      const ids = getTransformIds(e.target)
      if (ids.size > 0) updateConnectorsForObjects(ids)
      emitModifyThrottled(e.target)
    }
  })
  canvas.on('text:editing:exited', (e) => {
    if (e.target) {
      const objToSync = e.target.group || e.target
      if (getObjectId(objToSync)) {
        emitModify(objToSync)
        if (objToSync.type === 'group') updateStickyPlaceholderVisibility(objToSync)
      }
    }
  })
  canvas.on('object:modified', (e) => {
    // Disable selection caching after transform ends so objects render at full fidelity
    if (dragCacheActive && e.target) {
      const sel = e.target as FabricObject & { objectCaching?: boolean }
      sel.objectCaching = false
      sel.dirty = true
      canvas.requestRenderAll()
    }
    dragCacheActive = false
    cachedSyncIds = null
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    if (deltaThrottleTimer) {
      clearTimeout(deltaThrottleTimer)
      deltaThrottleTimer = null
    }
    lastDeltaCenter = null
    pendingMoveIds.clear()
    if (e.target) {
      const toSync = getObjectsToSync(e.target)
      // Batch write: collect all payloads and send in one HTTP request
      if (toSync.length > 1) {
        const items: { objectId: string; data: Record<string, unknown> }[] = []
        for (const obj of toSync) {
          const id = getObjectId(obj)
          if (!id || isApplyingRemote) continue
          const payload = buildPayload(obj)
          if (payload) {
            pendingWriteTimestamps.set(id, Date.now())
            items.push({ objectId: id, data: payload })
          }
        }
        if (items.length > 0) {
          writeDocumentsBatch(boardId, items).catch(console.error)
        }
      } else {
        toSync.forEach((o) => emitModify(o))
      }
      if (!isApplyingRemote) {
        toSync.filter((o) => !isFrame(o) && !isDataTable(o)).forEach((o) => checkAndUpdateFrameMembership(o))
      }
    }
  })
  canvas.on('object:removed', (e) => {
    if (e.target) {
      const removedId = getObjectId(e.target)
      if (removedId) objectIndex.delete(removedId)
      emitRemove(e.target)
    }
  })
  const handleDocSyncSelectionCleared = () => {
    dragCacheActive = false
    cachedSyncIds = null
  }
  canvas.on('selection:cleared', handleDocSyncSelectionCleared)

  // Auto-capture objects inside a frame when it's sent backward/to-back
  const handleFrameCaptureBeforeSendBack = (e: { frame: FabricObject }) => {
    const { frame } = e
    const frameId = getObjectId(frame)
    if (!frameId) return
    const frameZIndex = getObjectZIndex(frame)
    const existingChildIds = new Set(getFrameChildIds(frame))
    const toCapture = canvas.getObjects().filter((o) => {
      const id = getObjectId(o)
      return (
        id &&
        !isFrame(o) &&
        !isDataTable(o) &&
        getObjectZIndex(o) > frameZIndex &&
        !existingChildIds.has(id) &&
        isObjectInsideFrame(o, frame)
      )
    }).map((o) => getObjectId(o)!)
    if (toCapture.length > 0) {
      setFrameChildIds(frame, [...existingChildIds, ...toCapture])
      emitModify(frame)
    }
  }
  onCanvasCustom(canvas, 'frame:captureBeforeSendBack', handleFrameCaptureBeforeSendBack as (e: object) => void)

  return () => {
    unsub()
    supabase.removeChannel(moveChannel)
    if (moveThrottleTimer) clearTimeout(moveThrottleTimer)
    if (deltaThrottleTimer) clearTimeout(deltaThrottleTimer)
    framePrevPos.clear()
    objectIndex.clear()
    canvas.off('object:added')
    canvas.off('mouse:down')
    canvas.off('object:moving')
    canvas.off('object:scaling')
    canvas.off('object:rotating')
    canvas.off('text:editing:exited')
    canvas.off('object:modified')
    canvas.off('object:removed')
    canvas.off('selection:cleared', handleDocSyncSelectionCleared)
    offCanvasCustom(canvas, 'frame:captureBeforeSendBack', handleFrameCaptureBeforeSendBack as (e: object) => void)
  }
}

/**
 * Sets up lock sync only. Depends on auth (lockOptions).
 * Registers applyLockStateCallbackRef so document sync can re-apply locks after remote updates.
 */
export function setupLockSync(
  canvas: Canvas,
  boardId: string,
  lockOptions: BoardSyncLockOptions,
  applyLockStateCallbackRef: LockStateCallbackRef
): () => void {
  const currentLockIds = new Set<string>()
  let cancelLockDisconnect: (() => void) | null = null
  let lastLocks: LockEntry[] = []
  let broadcastChannel: ReturnType<ReturnType<typeof import('@/shared/lib/supabase/config').getSupabaseClient>['channel']> | null = null

  const applyLocksToObjects = (locks: LockEntry[]) => {
    const ourLockIds = Array.from(currentLockIds)
    const ourLocks = lastLocks.filter(
      (lock) => ourLockIds.includes(lock.objectId) && lock.userId === lockOptions.userId
    )
    const otherLocks = locks.filter(
      (lock) => !ourLockIds.includes(lock.objectId) || lock.userId !== lockOptions.userId
    )
    lastLocks = [...ourLocks, ...otherLocks]
    applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const handleBroadcastLockAcquired = (lock: LockEntry & { allIds?: string[] }) => {
    if (lock.userId === lockOptions.userId) return
    const ids = lock.allIds ?? [lock.objectId]
    const idSet = new Set(ids)
    lastLocks = [
      ...lastLocks.filter((l) => !idSet.has(l.objectId)),
      ...ids.map((id) => ({ objectId: id, userId: lock.userId, userName: lock.userName, lastActive: lock.lastActive })),
    ]
    applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const handleBroadcastLockReleased = (objectId: string, userId: string, allIds?: string[]) => {
    if (userId === lockOptions.userId) return
    const ids = allIds ?? [objectId]
    const idSet = new Set(ids)
    lastLocks = lastLocks.filter((l) => !idSet.has(l.objectId) || l.userId !== userId)
    applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const lockSubscription = subscribeToLocks(boardId, applyLocksToObjects, handleBroadcastLockAcquired, handleBroadcastLockReleased)
  broadcastChannel = lockSubscription.channel

  applyLockStateCallbackRef.current = () => {
    if (lastLocks.length > 0) applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const tryAcquireLocks = async (objectIds: string[]): Promise<boolean> => {
    const ok = await acquireLocksBatch(boardId, objectIds, lockOptions.userId, lockOptions.userName, broadcastChannel ?? undefined)
    if (ok) {
      objectIds.forEach((id) => currentLockIds.add(id))
      cancelLockDisconnect?.()
      cancelLockDisconnect = setupLockDisconnect(boardId, objectIds[0] ?? '')
    } else {
      await releaseLocksBatch(boardId, objectIds, lockOptions.userId, broadcastChannel ?? undefined)
    }
    return ok
  }

  const tryReleaseLocks = async (objectIds: string[]) => {
    const toRelease = objectIds.filter((id) => currentLockIds.has(id))
    if (toRelease.length === 0) return
    await releaseLocksBatch(boardId, toRelease, lockOptions.userId, broadcastChannel ?? undefined)
    toRelease.forEach((id) => currentLockIds.delete(id))
    if (currentLockIds.size === 0) {
      cancelLockDisconnect?.()
      cancelLockDisconnect = null
    }
  }

  const handleSelectionCreated = async (e: { selected?: unknown[] }) => {
    const sel = e.selected
    const objs = Array.isArray(sel) ? sel : sel ? [sel] : []
    const ids = objs.map((o) => getObjectId(o as FabricObject)).filter((id): id is string => !!id)
    if (ids.length === 0) return

    const otherLockIds = new Set(
      lastLocks.filter((l) => l.userId !== lockOptions.userId).map((l) => l.objectId)
    )
    const lockedByOthers = ids.some((id) => otherLockIds.has(id))
    if (lockedByOthers) {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      return
    }

    const optimisticLocks: LockEntry[] = ids.map((id) => ({
      objectId: id,
      userId: lockOptions.userId,
      userName: lockOptions.userName,
      lastActive: Date.now(),
    }))
    lastLocks = [...lastLocks, ...optimisticLocks]
    applyLockState(canvas, lastLocks, lockOptions.userId)

    const ok = await tryAcquireLocks(ids)
    if (!ok) {
      lastLocks = lastLocks.filter((lock) => !ids.includes(lock.objectId) || lock.userId !== lockOptions.userId)
      applyLockState(canvas, lastLocks, lockOptions.userId)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    }
  }

  const handleSelectionCleared = (e: { deselected?: unknown[] }) => {
    const prev = e.deselected
    const objs = Array.isArray(prev) ? prev : prev ? [prev] : []
    const ids = objs.map((o) => getObjectId(o as FabricObject)).filter((id): id is string => !!id)
    if (ids.length > 0) {
      lastLocks = lastLocks.filter((lock) => !ids.includes(lock.objectId) || lock.userId !== lockOptions.userId)
      applyLockState(canvas, lastLocks, lockOptions.userId)
      tryReleaseLocks(ids)
    }
  }

  const handleObjectRemoved = (e: { target?: FabricObject }) => {
    if (e.target) {
      const id = getObjectId(e.target)
      if (id) tryReleaseLocks([id])
    }
  }

  canvas.on('selection:created', handleSelectionCreated)
  canvas.on('selection:cleared', handleSelectionCleared)
  canvas.on('object:removed', handleObjectRemoved)

  return () => {
    applyLockStateCallbackRef.current = null
    lockSubscription.cleanup()
    if (currentLockIds.size > 0) tryReleaseLocks([...currentLockIds])
    cancelLockDisconnect?.()
    canvas.off('selection:created', handleSelectionCreated)
    canvas.off('selection:cleared', handleSelectionCleared)
    canvas.off('object:removed', handleObjectRemoved)
  }
}

/** Single-call setup for document + optional lock sync. Used by FabricCanvas. */
export function setupBoardSync(
  canvas: Canvas,
  boardId: string,
  lockOptions?: BoardSyncLockOptions
): () => void {
  const applyLockStateCallbackRef: LockStateCallbackRef = { current: null }
  const docCleanup = setupDocumentSync(canvas, boardId, applyLockStateCallbackRef)
  if (!lockOptions) return docCleanup
  const lockCleanup = setupLockSync(canvas, boardId, lockOptions, applyLockStateCallbackRef)
  return () => {
    lockCleanup()
    docCleanup()
  }
}
