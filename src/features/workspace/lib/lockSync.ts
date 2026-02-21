/**
 * Lock sync: acquire locks on selection, release on deselection.
 * Depends on auth (lockOptions). Registers applyLockStateCallbackRef so document sync
 * can re-apply locks after remote updates.
 */

import type { Canvas, FabricObject } from 'fabric'
import {
  subscribeToLocks,
  acquireLocksBatch,
  releaseLocksBatch,
  setupLockDisconnect,
  type LockEntry,
} from '../api/locksApi'
import { getObjectId } from './boardSyncUtils'
import { applyLockState, type BoardSyncLockOptions, type LockStateCallbackRef } from './boardSyncUtils'

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
      ...ids.map((id) => ({
        objectId: id,
        userId: lock.userId,
        userName: lock.userName,
        lastActive: lock.lastActive,
      })),
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

  const lockSubscription = subscribeToLocks(
    boardId,
    applyLocksToObjects,
    handleBroadcastLockAcquired,
    handleBroadcastLockReleased
  )
  broadcastChannel = lockSubscription.channel

  applyLockStateCallbackRef.current = () => {
    if (lastLocks.length > 0) applyLockState(canvas, lastLocks, lockOptions.userId)
  }

  const tryAcquireLocks = async (objectIds: string[]): Promise<boolean> => {
    const ok = await acquireLocksBatch(
      boardId,
      objectIds,
      lockOptions.userId,
      lockOptions.userName,
      broadcastChannel ?? undefined
    )
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

    const otherLockIds = new Set(lastLocks.filter((l) => l.userId !== lockOptions.userId).map((l) => l.objectId))
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
