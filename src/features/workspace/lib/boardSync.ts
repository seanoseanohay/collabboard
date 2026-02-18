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
  deleteDocument,
} from '../api/documentsApi'
import {
  subscribeToLocks,
  acquireLock,
  releaseLock,
  setupLockDisconnect,
  type LockEntry,
} from '../api/locksApi'
import { updateStickyTextFontSize, updateStickyPlaceholderVisibility } from './shapeFactory'

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

/** Sort canvas objects by zIndex (ascending); reorder so lowest is at back. */
export function sortCanvasByZIndex(canvas: Canvas): void {
  const objects = canvas.getObjects().slice()
  objects.sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
  objects.forEach((obj) => canvas.bringObjectToFront(obj))
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
 */
export function setupDocumentSync(
  canvas: Canvas,
  boardId: string,
  applyLockStateCallbackRef: LockStateCallbackRef,
  getCurrentUserId?: () => string
): () => void {
  let isApplyingRemote = false

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
    const clean = stripSyncFields(data)
    const existing = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (existing) {
      // Skip objects that are in our active selection (multi-select). The sender's own
      // document writes echo back via postgres_changes; applying scene-space left/top to
      // a group-relative child would corrupt its position. Locking ensures only we write
      // to these objects while selected.
      const active = canvas.getActiveObject()
      if (existing.group && existing.group === active) return
      if (existing.type === 'group') {
        try {
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
            if ('getObjects' in existing && 'getObjects' in revived) {
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
            updateStickyTextFontSize(existing)
            updateStickyPlaceholderVisibility(existing)
            ensureGroupChildrenNotSelectable(existing)
            ensureTextEditable(existing)
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
      const objData = { ...clean, data: { id: objectId } }
      const [revived] = await util.enlivenObjects<FabricObject>([objData])
      if (revived) {
        revived.set('data', { id: objectId })
        applyZIndex(revived, clean)
        if (revived.type === 'group') {
          updateStickyTextFontSize(revived)
          updateStickyPlaceholderVisibility(revived)
        }
        ensureGroupChildrenNotSelectable(revived)
        ensureTextEditable(revived)
        isApplyingRemote = true
        canvas.add(revived)
        revived.setCoords()
        applyLockStateCallbackRef.current?.()
        sortCanvasByZIndex(canvas)
        canvas.requestRenderAll()
        isApplyingRemote = false
      }
    } catch {
      /* ignore */
    }
  }

  const removeRemote = (objectId: string) => {
    const obj = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (obj) {
      isApplyingRemote = true
      canvas.remove(obj)
      canvas.requestRenderAll()
      isApplyingRemote = false
    }
  }

  const emitAdd = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    let payload = obj.toObject(['data', 'objects']) as Record<string, unknown>
    payload = payloadWithSceneCoords(obj, payload)
    delete payload.data
    delete (payload as { layoutManager?: unknown }).layoutManager
    const z = (payload.zIndex as number) ?? Date.now()
    payload.zIndex = z
    setObjectZIndex(obj, z)
    writeDocument(boardId, id, payload).catch(console.error)
  }

  /** Resolve event target to objects to sync: single object with id, or each object in ActiveSelection (multi-selection). */
  const getObjectsToSync = (target: FabricObject): FabricObject[] => {
    if (getObjectId(target)) return [target]
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

  const emitModify = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    let payload = obj.toObject(['data', 'objects']) as Record<string, unknown>
    payload = payloadWithSceneCoords(obj, payload)
    delete payload.data
    delete (payload as { layoutManager?: unknown }).layoutManager
    if (payload.zIndex === undefined) payload.zIndex = getObjectZIndex(obj)
    writeDocument(boardId, id, payload).catch(console.error)
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
      toSync.forEach((o) => emitModify(o))
      pendingMoveIds.clear()
      return
    }
    if (!moveThrottleTimer) {
      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null
        lastMoveEmit = Date.now()
        for (const id of pendingMoveIds) {
          const target = canvas.getObjects().find((o) => getObjectId(o) === id)
          if (target) emitModify(target)
        }
        pendingMoveIds.clear()
      }, MOVE_THROTTLE_MS - elapsed)
    }
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
        const obj = canvas.getObjects().find((o) => getObjectId(o) === objectId)
        if (obj) {
          // Add delta directly to left/top. These are in scene (canvas) space for
          // standalone objects. The delta is the same whether measured at center or
          // origin, so no calcTransformMatrix conversion is needed (which would give
          // center coords and break objects with originX/Y != 'center').
          obj.set({ left: obj.left + p.dx, top: obj.top + p.dy })
          obj.setCoords()
        }
      }
      canvas.requestRenderAll()
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

  const emitMoveDeltaThrottled = (target: FabricObject) => {
    const toSync = getObjectsToSync(target)
    if (toSync.length === 0) return
    const ids = toSync.map((o) => getObjectId(o)).filter((id): id is string => !!id)
    if (ids.length === 0) return
    const center = getTargetSceneCenter(target)
    const now = Date.now()
    if (lastDeltaCenter === null) {
      lastDeltaCenter = center
      return
    }
    const dx = center.x - lastDeltaCenter.x
    const dy = center.y - lastDeltaCenter.y
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

  canvas.on('object:added', (e) => {
    if (e.target) emitAdd(e.target)
  })
  canvas.on('object:moving', (e) => {
    if (e.target) emitMoveDeltaThrottled(e.target)
  })
  canvas.on('object:scaling', (e) => {
    if (e.target) emitModifyThrottled(e.target)
  })
  canvas.on('object:rotating', (e) => {
    if (e.target) emitModifyThrottled(e.target)
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
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    if (deltaThrottleTimer) {
      clearTimeout(deltaThrottleTimer)
      deltaThrottleTimer = null
    }
    lastDeltaCenter = null
    if (e.target) {
      const toSync = getObjectsToSync(e.target)
      toSync.forEach((o) => emitModify(o))
    }
  })
  canvas.on('object:removed', (e) => {
    if (e.target) emitRemove(e.target)
  })

  return () => {
    unsub()
    supabase.removeChannel(moveChannel)
    if (moveThrottleTimer) clearTimeout(moveThrottleTimer)
    if (deltaThrottleTimer) clearTimeout(deltaThrottleTimer)
    canvas.off('object:added')
    canvas.off('object:moving')
    canvas.off('object:scaling')
    canvas.off('object:rotating')
    canvas.off('text:editing:exited')
    canvas.off('object:modified')
    canvas.off('object:removed')
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

  const handleBroadcastLockAcquired = (lock: LockEntry) => {
    if (lock.userId === lockOptions.userId) return
    lastLocks = [...lastLocks.filter((l) => l.objectId !== lock.objectId), lock]
    applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const handleBroadcastLockReleased = (objectId: string, userId: string) => {
    if (userId === lockOptions.userId) return
    lastLocks = lastLocks.filter((l) => l.objectId !== objectId || l.userId !== userId)
    applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const lockSubscription = subscribeToLocks(boardId, applyLocksToObjects, handleBroadcastLockAcquired, handleBroadcastLockReleased)
  broadcastChannel = lockSubscription.channel

  applyLockStateCallbackRef.current = () => {
    if (lastLocks.length > 0) applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const tryAcquireLocks = async (objectIds: string[]): Promise<boolean> => {
    const results = await Promise.all(
      objectIds.map((id) =>
        acquireLock(boardId, id, lockOptions.userId, lockOptions.userName, broadcastChannel ?? undefined)
      )
    )
    const allOk = results.every(Boolean)
    if (allOk) {
      objectIds.forEach((id) => currentLockIds.add(id))
      cancelLockDisconnect?.()
      cancelLockDisconnect = setupLockDisconnect(boardId, objectIds[0] ?? '')
    } else {
      for (const id of objectIds) {
        await releaseLock(boardId, id, lockOptions.userId, broadcastChannel ?? undefined)
      }
    }
    return allOk
  }

  const tryReleaseLocks = async (objectIds: string[]) => {
    for (const id of objectIds) {
      if (currentLockIds.has(id)) {
        await releaseLock(boardId, id, lockOptions.userId, broadcastChannel ?? undefined)
        currentLockIds.delete(id)
      }
    }
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

    const lockedByOthers = ids.some((id) =>
      lastLocks.some((lock) => lock.objectId === id && lock.userId !== lockOptions.userId)
    )
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
