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

export function setupBoardSync(
  canvas: Canvas,
  boardId: string,
  lockOptions?: BoardSyncLockOptions
): () => void {
  let isApplyingRemote = false
  const currentLockIds = new Set<string>()
  let cancelLockDisconnect: (() => void) | null = null

  const stripSyncFields = (d: Record<string, unknown>) => {
    const { updatedAt, ...rest } = d
    return rest
  }

  const ensureGroupChildrenNotSelectable = (obj: FabricObject) => {
    // For Groups (sticky notes), ensure children cannot be directly selected
    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
      children.forEach((child) => {
        child.set({
          selectable: false,
          evented: false,
        })
      })
    }
  }

  const ensureTextEditable = (obj: FabricObject) => {
    // Ensure IText objects are editable
    if (obj.type === 'i-text' && 'editable' in obj) {
      obj.set('editable', true)
    }
    // For groups, check children
    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => FabricObject[] }).getObjects()
      children.forEach(ensureTextEditable)
    }
  }

  const applyRemote = async (
    objectId: string,
    data: Record<string, unknown>
  ) => {
    const clean = stripSyncFields(data)
    const existing = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (existing) {
      // For Groups, update carefully without breaking structure
      if (existing.type === 'group') {
        try {
          const objData = { ...clean, data: { id: objectId } }
          const [revived] = await util.enlivenObjects<FabricObject>([objData])
          if (revived) {
            // Update position and transform properties
            existing.set({
              left: revived.left,
              top: revived.top,
              angle: revived.angle,
              scaleX: revived.scaleX,
              scaleY: revived.scaleY,
              flipX: revived.flipX,
              flipY: revived.flipY,
            })
            
            // Update text content in children if it changed
            if ('getObjects' in existing && 'getObjects' in revived) {
              const existingChildren = (existing as { getObjects: () => FabricObject[] }).getObjects()
              const revivedChildren = (revived as { getObjects: () => FabricObject[] }).getObjects()
              
              existingChildren.forEach((child, index) => {
                const revivedChild = revivedChildren[index]
                if (child.type === 'i-text' && revivedChild && 'text' in revivedChild) {
                  child.set('text', (revivedChild as { text: string }).text)
                }
              })
            }
            
            ensureGroupChildrenNotSelectable(existing)
            ensureTextEditable(existing)
            canvas.requestRenderAll()
          }
        } catch {
          // Ignore deserialization errors
        }
        return
      }
      
      // For non-Group objects, update in place
      try {
        const objData = { ...clean, data: { id: objectId } }
        const [revived] = await util.enlivenObjects<FabricObject>([objData])
        if (revived) {
          const serialized = revived.toObject(['data']) as Record<string, unknown>
          delete serialized.data
          delete serialized.type  // Fabric: "Setting type has no effect" - cannot change type on existing object
          delete serialized.layoutManager  // Remove layoutManager - not serializable
          existing.set(serialized)
          ensureTextEditable(existing)
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
        ensureGroupChildrenNotSelectable(revived)
        ensureTextEditable(revived)
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

  const tryAcquireLocks = async (objectIds: string[]): Promise<boolean> => {
    if (!lockOptions || objectIds.length === 0) return true
    const results = await Promise.all(
      objectIds.map((id) =>
        acquireLock(boardId, id, lockOptions!.userId, lockOptions!.userName)
      )
    )
    const allOk = results.every(Boolean)
    if (allOk) {
      objectIds.forEach((id) => currentLockIds.add(id))
      cancelLockDisconnect?.()
      cancelLockDisconnect = setupLockDisconnect(boardId, objectIds[0] ?? '')
    } else {
      for (const id of objectIds) {
        await releaseLock(boardId, id, lockOptions!.userId)
      }
    }
    return allOk
  }

  const tryReleaseLocks = async (objectIds: string[]) => {
    if (!lockOptions) return
    for (const id of objectIds) {
      if (currentLockIds.has(id)) {
        await releaseLock(boardId, id, lockOptions.userId)
        currentLockIds.delete(id)
      }
    }
    if (currentLockIds.size === 0) {
      cancelLockDisconnect?.()
      cancelLockDisconnect = null
    }
  }

  const emitAdd = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    // Include 'data' and 'objects' (for Groups) in serialization
    const payload = obj.toObject(['data', 'objects']) as Record<string, unknown>
    delete payload.data
    // Remove layoutManager - it's not serializable and Fabric will recreate it on deserialize
    delete payload.layoutManager
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const MOVE_THROTTLE_MS = 80

  const emitModify = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    // Include 'data' and 'objects' (for Groups) in serialization
    const payload = obj.toObject(['data', 'objects']) as Record<string, unknown>
    delete payload.data
    // Remove layoutManager - it's not serializable and Fabric will recreate it on deserialize
    delete payload.layoutManager
    writeDocument(boardId, id, payload).catch(console.error)
  }

  let moveThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let lastMoveEmit = 0
  let pendingMoveId: string | null = null

  const emitModifyThrottled = (obj: FabricObject) => {
    if (!obj || isApplyingRemote) return
    const id = getObjectId(obj)
    if (!id) return
    pendingMoveId = id
    const now = Date.now()
    const elapsed = now - lastMoveEmit
    if (elapsed >= MOVE_THROTTLE_MS) {
      lastMoveEmit = now
      emitModify(obj)
      return
    }
    if (!moveThrottleTimer) {
      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null
        lastMoveEmit = Date.now()
        const target = pendingMoveId
          ? canvas.getObjects().find((o) => getObjectId(o) === pendingMoveId)
          : null
        if (target) emitModify(target)
        pendingMoveId = null
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

  canvas.on('object:added', (e) => {
    if (e.target) {
      emitAdd(e.target)
      if (lockOptions && lastLocks.length > 0) {
        applyLockState(canvas, lastLocks, lockOptions.userId)
      }
    }
  })
  canvas.on('object:moving', (e) => {
    if (e.target) emitModifyThrottled(e.target)
  })
  canvas.on('object:scaling', (e) => {
    if (e.target) emitModifyThrottled(e.target)
  })
  canvas.on('object:rotating', (e) => {
    if (e.target) emitModifyThrottled(e.target)
  })
  canvas.on('text:editing:exited', (e) => {
    if (e.target) {
      // For IText inside a Group (sticky notes), sync the parent Group
      // Only sync when user FINISHES editing, not on every keystroke
      const objToSync = e.target.group || e.target
      if (getObjectId(objToSync)) emitModify(objToSync)
    }
  })
  canvas.on('object:modified', (e) => {
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    if (e.target) emitModify(e.target)
  })
  canvas.on('object:removed', (e) => {
    if (e.target) {
      const id = getObjectId(e.target)
      if (id) tryReleaseLocks([id])
      emitRemove(e.target)
    }
  })

  if (lockOptions) {
    canvas.on('selection:created', async (e) => {
      const sel = e.selected
      const objs = Array.isArray(sel) ? sel : sel ? [sel] : []
      const ids = objs.map(getObjectId).filter((id): id is string => !!id)
      
      if (ids.length > 0) {
        // SYNCHRONOUS CHECK: Prevent selection if any object is already locked by another user
        // This handles race conditions before the async DB lock propagates
        const lockedByOthers = ids.some(id => 
          lastLocks.some(lock => lock.objectId === id && lock.userId !== lockOptions!.userId)
        )
        
        if (lockedByOthers) {
          // Immediately discard selection - object is already locked
          canvas.discardActiveObject()
          canvas.requestRenderAll()
          return
        }
        
        // Now try to acquire the lock from the server
        const ok = await tryAcquireLocks(ids)
        if (!ok) {
          canvas.discardActiveObject()
          canvas.requestRenderAll()
        }
      }
    })
    canvas.on('selection:cleared', (e) => {
      const prev = e.deselected
      const objs = Array.isArray(prev) ? prev : prev ? [prev] : []
      const ids = objs.map(getObjectId).filter((id): id is string => !!id)
      if (ids.length > 0) tryReleaseLocks(ids)
    })
  }

  return () => {
    unsub()
    unsubLocks()
    if (currentLockIds.size > 0 && lockOptions) {
      tryReleaseLocks([...currentLockIds])
    }
    cancelLockDisconnect?.()
    canvas.off('object:added')
    canvas.off('object:moving')
    canvas.off('object:scaling')
    canvas.off('object:rotating')
    canvas.off('text:editing:exited')
    canvas.off('object:modified')
    canvas.off('object:removed')
    if (moveThrottleTimer) clearTimeout(moveThrottleTimer)
    if (lockOptions) {
      canvas.off('selection:created')
      canvas.off('selection:cleared')
    }
  }
}
