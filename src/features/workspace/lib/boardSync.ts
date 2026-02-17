/**
 * Connects Fabric canvas to RTDB for delta sync.
 * Optional locking: acquire on selection, release on deselection.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'
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

const OBJ_ID_KEY = 'id'

export function getObjectId(obj: FabricObject): string | null {
  const data = obj.get('data') as { id?: string } | undefined
  return (data?.id ?? null) as string | null
}

export function setObjectId(obj: FabricObject, id: string): void {
  obj.set('data', { ...(obj.get('data') as object), [OBJ_ID_KEY]: id })
}

export interface BoardSyncLockOptions {
  userId: string
  userName: string
}

function applyLockState(
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
      evented: true,
      hoverCursor: locked ? 'not-allowed' : undefined,
    })
  }
  canvas.requestRenderAll()
}

export function setupBoardSync(
  canvas: Canvas,
  boardId: string,
  lockOptions?: BoardSyncLockOptions
): () => void {
  let isApplyingRemote = false
  let currentLockId: string | null = null
  let cancelLockDisconnect: (() => void) | null = null

  const stripSyncFields = (d: Record<string, unknown>) => {
    const { updatedAt, ...rest } = d
    return rest
  }

  const applyRemote = async (
    objectId: string,
    data: Record<string, unknown>
  ) => {
    const clean = stripSyncFields(data)
    const existing = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (existing) {
      try {
        const objData = { ...clean, data: { id: objectId } }
        const [revived] = await util.enlivenObjects<FabricObject>([objData])
        if (revived) {
          const serialized = revived.toObject(['data']) as Record<string, unknown>
          delete serialized.data
          existing.set(serialized)
          canvas.requestRenderAll()
        }
      } catch {
        // Ignore deserialization errors
      }
      return
    }
    try {
      const objData = { ...clean, data: { id: objectId } }
      const [revived] = await util.enlivenObjects<FabricObject>([objData])
      if (revived) {
        revived.set('data', { id: objectId })
        isApplyingRemote = true
        canvas.add(revived)
        canvas.requestRenderAll()
        isApplyingRemote = false
      }
    } catch {
      // Ignore deserialization errors
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

  let lastLocks: LockEntry[] = []
  const applyLocksToObjects = lockOptions
    ? (locks: LockEntry[]) => {
        lastLocks = locks
        applyLockState(canvas, locks, lockOptions!.userId)
      }
    : () => {}

  const unsubLocks = lockOptions
    ? subscribeToLocks(boardId, applyLocksToObjects)
    : () => {}

  const tryAcquireLock = async (objectId: string): Promise<boolean> => {
    if (!lockOptions) return true
    const ok = await acquireLock(
      boardId,
      objectId,
      lockOptions.userId,
      lockOptions.userName
    )
    if (ok) {
      currentLockId = objectId
      cancelLockDisconnect?.()
      cancelLockDisconnect = setupLockDisconnect(boardId, objectId)
    }
    return ok
  }

  const tryReleaseLock = async (objectId: string) => {
    if (!lockOptions || currentLockId !== objectId) return
    await releaseLock(boardId, objectId, lockOptions.userId)
    currentLockId = null
    cancelLockDisconnect?.()
    cancelLockDisconnect = null
  }

  const emitAdd = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    const payload = obj.toObject(['data']) as Record<string, unknown>
    delete payload.data
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const emitModify = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    const payload = obj.toObject(['data']) as Record<string, unknown>
    delete payload.data
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
  })

  canvas.on('object:added', (e) => {
    if (e.target) {
      emitAdd(e.target)
      if (lockOptions && lastLocks.length > 0) {
        applyLockState(canvas, lastLocks, lockOptions.userId)
      }
    }
  })
  canvas.on('object:modified', (e) => {
    if (e.target) emitModify(e.target)
  })
  canvas.on('object:removed', (e) => {
    if (e.target) {
      const id = getObjectId(e.target)
      if (id) tryReleaseLock(id)
      emitRemove(e.target)
    }
  })

  if (lockOptions) {
    canvas.on('selection:created', async (e) => {
      const sel = e.selected
      if (Array.isArray(sel) && sel.length === 1) {
        const id = getObjectId(sel[0])
        if (id) {
          const ok = await tryAcquireLock(id)
          if (!ok) {
            canvas.discardActiveObject()
            canvas.requestRenderAll()
          }
        }
      }
    })
    canvas.on('selection:cleared', (e) => {
      const prev = e.deselected
      if (Array.isArray(prev) && prev.length === 1) {
        const id = getObjectId(prev[0])
        if (id) tryReleaseLock(id)
      }
    })
  }

  return () => {
    unsub()
    unsubLocks()
    if (currentLockId && lockOptions) {
      tryReleaseLock(currentLockId)
    }
    cancelLockDisconnect?.()
    canvas.off('object:added')
    canvas.off('object:modified')
    canvas.off('object:removed')
    if (lockOptions) {
      canvas.off('selection:created')
      canvas.off('selection:cleared')
    }
  }
}
