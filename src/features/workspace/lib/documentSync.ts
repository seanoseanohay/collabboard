/**
 * Document sync: connects Fabric canvas to Supabase for delta sync.
 * Always runs for position/add/remove updates. Never depends on auth.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'
import { getSupabaseClient } from '@/shared/lib/supabase/config'
import {
  subscribeToDocuments,
  writeDocument,
  writeDocumentsBatch,
  deleteDocument,
} from '../api/documentsApi'
import { updateStickyTextFontSize, updateStickyPlaceholderVisibility } from './shapeFactory'
import { isFrame, getFrameChildIds, setFrameChildIds, counterScaleFrameOrTableTitle } from './frameUtils'
import { isDataTable } from './dataTableUtils'
import {
  updateConnectorEndpoints,
  syncConnectorMoveLock,
  getConnectorData,
  isConnector,
  getStrokeDashArray,
  type StrokeDash,
} from './connectorFactory'
import {
  getObjectId,
  setObjectZIndex,
  getObjectZIndex,
  sortCanvasByZIndex,
  payloadWithSceneCoords,
  getTargetSceneCenter,
  fireCanvasCustom,
  onCanvasCustom,
  offCanvasCustom,
  type LockStateCallbackRef,
  type MoveDeltaPayload,
} from './boardSyncUtils'

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
  let isBulkLoading = false
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

  const syncFrameOrTableTitleFromRevived = (existing: FabricObject, revived: FabricObject) => {
    if (!('getObjects' in existing) || !('getObjects' in revived)) return
    const existingChildren = (existing as { getObjects: () => FabricObject[] }).getObjects()
    const revivedChildren = (revived as { getObjects: () => FabricObject[] }).getObjects()
    const existingTitle = existingChildren.find((c) => c.type === 'i-text')
    const revivedTitle = revivedChildren.find((c) => c.type === 'i-text')
    if (existingTitle && revivedTitle) {
      const text = (revivedTitle.get('text') as string) ?? ''
      const fontSize = revivedTitle.get('fontSize')
      existingTitle.set('text', text)
      if (typeof fontSize === 'number') existingTitle.set('fontSize', fontSize)
    }
  }

  const applyZIndex = (obj: FabricObject, data: Record<string, unknown>) => {
    const z = (data.zIndex as number) ?? Date.now()
    setObjectZIndex(obj, z)
  }

  const isContainerGroup = (obj: FabricObject) =>
    ((obj.get('data') as { subtype?: string } | undefined)?.subtype) === 'container'
  const isFrameGroup = (obj: FabricObject) =>
    ((obj.get('data') as { subtype?: string } | undefined)?.subtype) === 'frame'
  const isTableGroup = (obj: FabricObject) =>
    ((obj.get('data') as { subtype?: string } | undefined)?.subtype) === 'table'

  const updateConnectorsForObjects = (objectIds: Set<string>) => {
    const hasConnectors = () =>
      connectorCacheRef?.current ? connectorCacheRef.current.size > 0 : canvas.getObjects().some((o) => isConnector(o))
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

  type PayloadData = {
    subtype?: string
    sourceObjectId?: string | null
    sourcePort?: string
    targetObjectId?: string | null
    targetPort?: string
    arrowMode?: string
    strokeDash?: string
    waypoints?: unknown[]
    sourceFloatPoint?: unknown
    targetFloatPoint?: unknown
    minZoom?: number
    maxZoom?: number
  }

  const buildPayload = (obj: FabricObject): Record<string, unknown> | null => {
    let payload = obj.toObject(['data', 'objects', 'zIndex']) as Record<string, unknown>
    payload = payloadWithSceneCoords(obj, payload)
    const data = payload.data as PayloadData | undefined
    if (obj.type === 'group' && data?.subtype === 'container') payload.subtype = 'container'
    if (obj.type === 'group' && data?.subtype === 'frame') {
      payload.subtype = 'frame'
      payload.frameTitle = (data as { title?: string }).title ?? 'Frame'
      payload.childIds = (data as { childIds?: string[] }).childIds ?? []
    }
    if (obj.type === 'group' && data?.subtype === 'table') {
      payload.subtype = 'table'
      payload.tableTitle = (data as { title?: string }).title ?? 'Untitled Table'
      payload.formSchema = (data as { formSchema?: unknown }).formSchema ?? null
      const td = data as { accentColor?: string; showTitle?: boolean }
      if (td.accentColor) payload.accentColor = td.accentColor
      payload.showTitle = td.showTitle ?? false
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
    if (obj.type === 'group' && data?.subtype === 'input-field') payload.subtype = 'input-field'
    if (obj.type === 'group' && data?.subtype === 'button') payload.subtype = 'button'
    payload.minZoom = data?.minZoom ?? null
    payload.maxZoom = data?.maxZoom ?? null
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

  const MOVE_THROTTLE_MS = 80
  let moveThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let lastMoveEmit = 0
  let pendingMoveIds = new Set<string>()

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
    if (items.length > 1) writeDocumentsBatch(boardId, items).catch(console.error)
    else if (items.length === 1) writeDocument(boardId, items[0].objectId, items[0].data).catch(console.error)
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
    if (now - lastMoveEmit >= MOVE_THROTTLE_MS) {
      lastMoveEmit = now
      flushPendingMovesBatch()
      return
    }
    if (!moveThrottleTimer) {
      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null
        lastMoveEmit = Date.now()
        flushPendingMovesBatch()
      }, MOVE_THROTTLE_MS - (now - lastMoveEmit))
    }
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
        const active = canvas.getActiveObject()
        if (existing === active) return
        if (existing.group && existing.group === active) return
        if (existing.type === 'group') {
          try {
            const objData = {
              ...clean,
              data: {
                id: objectId,
                ...(clean.minZoom != null ? { minZoom: clean.minZoom as number } : {}),
                ...(clean.maxZoom != null ? { maxZoom: clean.maxZoom as number } : {}),
              },
            }
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
              if (isFrameGroup(existing)) {
                const existingData = existing.get('data') as Record<string, unknown>
                existing.set('data', {
                  ...existingData,
                  title: (clean.frameTitle as string) ?? existingData['title'],
                  childIds: (clean.childIds as string[]) ?? existingData['childIds'] ?? [],
                  ...(clean.minZoom != null ? { minZoom: clean.minZoom as number } : { minZoom: undefined }),
                  ...(clean.maxZoom != null ? { maxZoom: clean.maxZoom as number } : { maxZoom: undefined }),
                })
                syncFrameOrTableTitleFromRevived(existing, revived)
                fireCanvasCustom(canvas, 'frame:data:changed', { frameId: objectId })
              }
              if (isTableGroup(existing)) {
                const existingData = existing.get('data') as Record<string, unknown>
                existing.set('data', {
                  ...existingData,
                  title: (clean.tableTitle as string) ?? existingData['title'],
                  formSchema: Object.prototype.hasOwnProperty.call(clean, 'formSchema')
                    ? (clean.formSchema ?? null)
                    : (existingData['formSchema'] ?? null),
                  accentColor: Object.prototype.hasOwnProperty.call(clean, 'accentColor')
                    ? (clean.accentColor ?? existingData['accentColor'])
                    : existingData['accentColor'],
                  showTitle: Object.prototype.hasOwnProperty.call(clean, 'showTitle')
                    ? (clean.showTitle ?? existingData['showTitle'])
                    : existingData['showTitle'],
                  ...(clean.minZoom != null ? { minZoom: clean.minZoom as number } : { minZoom: undefined }),
                  ...(clean.maxZoom != null ? { maxZoom: clean.maxZoom as number } : { maxZoom: undefined }),
                })
                syncFrameOrTableTitleFromRevived(existing, revived)
                fireCanvasCustom(canvas, 'table:data:changed', { tableId: objectId })
              }
              if (
                !isContainerGroup(existing) &&
                !isFrameGroup(existing) &&
                !isTableGroup(existing) &&
                'getObjects' in existing &&
                'getObjects' in revived
              ) {
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
              if (
                !isContainerGroup(existing) &&
                !isFrameGroup(existing) &&
                !isTableGroup(existing) &&
                existingSubtype !== 'input-field' &&
                existingSubtype !== 'button'
              ) {
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
            ? { title: (clean.frameTitle as string) ?? 'Frame', childIds: (clean.childIds as string[]) ?? [] }
            : {}
        const tableData =
          subtype === 'table'
            ? {
                title: (clean.tableTitle as string) ?? 'Untitled Table',
                formSchema: (clean.formSchema ?? null) as unknown,
                accentColor: (clean.accentColor as string | undefined) ?? undefined,
                showTitle: (clean.showTitle as boolean | undefined) ?? false,
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
        const scaleBandData = {
          ...(clean.minZoom != null ? { minZoom: clean.minZoom as number } : {}),
          ...(clean.maxZoom != null ? { maxZoom: clean.maxZoom as number } : {}),
        }
        const objData = {
          ...clean,
          data: {
            id: objectId,
            ...(subtype && { subtype }),
            ...frameData,
            ...tableData,
            ...connectorData,
            ...scaleBandData,
          },
        }
        const [revived] = await util.enlivenObjects<FabricObject>([objData])
        if (revived) {
          revived.set('data', {
            id: objectId,
            ...(subtype && { subtype }),
            ...frameData,
            ...tableData,
            ...connectorData,
          })
          applyZIndex(revived, clean)
          if (revived.type === 'group') {
            const revivedData = revived.get('data') as { subtype?: string } | undefined
            if (
              revivedData?.subtype !== 'container' &&
              revivedData?.subtype !== 'frame' &&
              revivedData?.subtype !== 'table' &&
              revivedData?.subtype !== 'input-field' &&
              revivedData?.subtype !== 'button'
            ) {
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
    const data = payload.data as PayloadData | undefined
    if (obj.type === 'group' && data?.subtype === 'container') payload.subtype = 'container'
    if (obj.type === 'group' && data?.subtype === 'frame') {
      payload.subtype = 'frame'
      payload.frameTitle = (data as { title?: string }).title ?? 'Frame'
      payload.childIds = (data as { childIds?: string[] }).childIds ?? []
    }
    if (obj.type === 'group' && data?.subtype === 'table') {
      payload.subtype = 'table'
      payload.tableTitle = (data as { title?: string }).title ?? 'Untitled Table'
      payload.formSchema = (data as { formSchema?: unknown }).formSchema ?? null
      const td = data as { accentColor?: string; showTitle?: boolean }
      if (td.accentColor) payload.accentColor = td.accentColor
      payload.showTitle = td.showTitle ?? false
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
    if (obj.type === 'group' && data?.subtype === 'input-field') payload.subtype = 'input-field'
    if (obj.type === 'group' && data?.subtype === 'button') payload.subtype = 'button'
    payload.minZoom = data?.minZoom ?? null
    payload.maxZoom = data?.maxZoom ?? null
    delete payload.data
    delete (payload as { layoutManager?: unknown }).layoutManager
    const z = (payload.zIndex as number) ?? Date.now()
    payload.zIndex = z
    setObjectZIndex(obj, z)
    pendingWriteTimestamps.set(id, Date.now())
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const emitRemove = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    deleteDocument(boardId, id).catch(console.error)
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
      canvas.requestRenderAll()
    })
    .subscribe((status) => {
      moveChannelReady = status === 'SUBSCRIBED'
    })

  const broadcastMoveDelta = (objectIds: string[], dx: number, dy: number) => {
    const uid = getCurrentUserId?.()
    if (!uid || !moveChannelReady) return
    moveChannel.send({
      type: 'broadcast',
      event: 'move_delta',
      payload: { userId: uid, objectIds, dx, dy },
    })
  }

  const framePrevPos = new Map<string, { left: number; top: number }>()

  const isObjectInsideFrame = (obj: FabricObject, frame: FabricObject): boolean => {
    obj.setCoords()
    frame.setCoords()
    const ob = obj.getBoundingRect()
    const fb = frame.getBoundingRect()
    const cx = ob.left + ob.width / 2
    const cy = ob.top + ob.height / 2
    return cx >= fb.left && cx <= fb.left + fb.width && cy >= fb.top && cy <= fb.top + fb.height
  }

  const checkAndUpdateFrameMembership = (obj: FabricObject) => {
    if (isApplyingRemote) return
    const objId = getObjectId(obj)
    if (!objId || isFrame(obj)) return
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

  let dragCacheActive = false
  let cachedSyncIds: string[] | null = null

  const emitMoveDeltaThrottledWithTargets = (target: FabricObject) => {
    const ids = cachedSyncIds ?? getObjectsToSync(target).map((o) => getObjectId(o)).filter((id): id is string => !!id)
    if (ids.length === 0) return
    const center = getTargetSceneCenter(target)
    const now = Date.now()
    if (lastDeltaCenter === null) {
      lastDeltaCenter = center
      return
    }
    const prevDeltaCenter = lastDeltaCenter
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
        const active = canvas.getActiveObject()
        const currentCenter = active ? getTargetSceneCenter(active) : center
        const totalDx = currentCenter.x - baseCenter.x
        const totalDy = currentCenter.y - baseCenter.y
        lastDeltaCenter = currentCenter
        if (totalDx !== 0 || totalDy !== 0) broadcastMoveDelta(ids, totalDx, totalDy)
      }, DELTA_BROADCAST_MS - elapsed)
    }
  }

  const getTransformIds = (target: FabricObject): Set<string> =>
    new Set(getObjectsToSync(target).map((o) => getObjectId(o)).filter((id): id is string => !!id))

  canvas.on('object:added', (e) => {
    if (!e.target) return
    const addedId = getObjectId(e.target)
    if (addedId) objectIndex.set(addedId, e.target)
    emitAdd(e.target)
    if (!isApplyingRemote) {
      if (isFrame(e.target)) {
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

  canvas.on('object:moving', (e) => {
    if (!e.target) return
    if (!dragCacheActive && e.target.type === 'activeselection') {
      const sel = e.target as FabricObject & { objectCaching?: boolean }
      const childCount = 'getObjects' in sel ? (sel as unknown as { getObjects(): FabricObject[] }).getObjects().length : 0
      if (childCount > 50) {
        sel.objectCaching = true
        sel.dirty = true
        dragCacheActive = true
      }
    }
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
    if (!cachedSyncIds) {
      const syncTargets = getObjectsToSync(e.target)
      cachedSyncIds = syncTargets.map((o) => getObjectId(o)).filter((id): id is string => !!id)
    }
    const ids = new Set(cachedSyncIds)
    if (ids.size > 0) updateConnectorsForObjects(ids)
    emitMoveDeltaThrottledWithTargets(e.target)
  })

  canvas.on('object:scaling', (e) => {
    if (e.target) {
      counterScaleFrameOrTableTitle(e.target)
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
        if (objToSync.type === 'group') {
          const data = objToSync.get('data') as { subtype?: string; title?: string } | undefined
          if ((data?.subtype === 'frame' || data?.subtype === 'table') && e.target.type === 'i-text') {
            const text = (e.target.get('text') as string) ?? ''
            objToSync.set('data', { ...data, title: text || (data.title ?? '') })
          }
        }
        emitModify(objToSync)
        if (objToSync.type === 'group') updateStickyPlaceholderVisibility(objToSync)
      }
    }
  })

  canvas.on('object:modified', (e) => {
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
        if (items.length > 0) writeDocumentsBatch(boardId, items).catch(console.error)
      } else {
        toSync.forEach((o) => emitModify(o))
      }
      if (!isApplyingRemote) {
        toSync.filter((o) => !isFrame(o)).forEach((o) => checkAndUpdateFrameMembership(o))
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

  const handleFrameCaptureBeforeSendBack = (e: { frame: FabricObject }) => {
    const { frame } = e
    const frameId = getObjectId(frame)
    if (!frameId) return
    const frameZIndex = getObjectZIndex(frame)
    const existingChildIds = new Set(getFrameChildIds(frame))
    const toCapture = canvas
      .getObjects()
      .filter((o) => {
        const id = getObjectId(o)
        return (
          id &&
          !isFrame(o) &&
          !isDataTable(o) &&
          getObjectZIndex(o) > frameZIndex &&
          !existingChildIds.has(id) &&
          isObjectInsideFrame(o, frame)
        )
      })
      .map((o) => getObjectId(o)!)
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
