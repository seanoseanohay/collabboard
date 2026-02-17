/**
 * RTDB locks for object-level editing. Prevents concurrent edits.
 * Path: boards/{boardId}/locks/{objectId}
 */

import {
  ref,
  onValue,
  runTransaction,
  onDisconnect as rtdbOnDisconnect,
  type Unsubscribe,
} from 'firebase/database'
import { getDatabaseInstance } from '@/shared/lib/firebase/config'

const LOCKS_PATH = 'locks'

export interface LockEntry {
  objectId: string
  userId: string
  userName: string
  lastActive: number
}

function getLocksPath(boardId: string): string {
  return `boards/${boardId}/${LOCKS_PATH}`
}

function getLockPath(boardId: string, objectId: string): string {
  return `${getLocksPath(boardId)}/${objectId}`
}

export function acquireLock(
  boardId: string,
  objectId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const db = getDatabaseInstance()
  const lockRef = ref(db, getLockPath(boardId, objectId))

  return runTransaction(lockRef, (current) => {
    if (current.exists() && current.val().userId !== userId) {
      return // Abort: someone else holds the lock
    }
    return {
      userId,
      userName,
      lastActive: Date.now(),
    }
  }).then((result) => result.committed)
}

export function releaseLock(
  boardId: string,
  objectId: string,
  userId: string
): Promise<void> {
  const db = getDatabaseInstance()
  const lockRef = ref(db, getLockPath(boardId, objectId))

  return runTransaction(lockRef, (current) => {
    if (!current.exists()) return undefined
    if (current.val().userId !== userId) return undefined
    return null // Remove node
  }).then(() => undefined)
}

export function subscribeToLocks(
  boardId: string,
  onLocks: (locks: LockEntry[]) => void
): Unsubscribe {
  const db = getDatabaseInstance()
  const locksRef = ref(db, getLocksPath(boardId))

  const unsub = onValue(locksRef, (snapshot) => {
    const val = snapshot.val()
    if (!val || typeof val !== 'object') {
      onLocks([])
      return
    }
    const entries: LockEntry[] = []
    for (const [objectId, data] of Object.entries(val)) {
      if (objectId && data && typeof data === 'object') {
        const d = data as Record<string, unknown>
        const userId = typeof d.userId === 'string' ? d.userId : ''
        const userName = typeof d.userName === 'string' ? d.userName : 'Unknown'
        const lastActive = typeof d.lastActive === 'number' ? d.lastActive : 0
        entries.push({ objectId, userId, userName, lastActive })
      }
    }
    onLocks(entries)
  })

  return unsub
}

export function setupLockDisconnect(
  boardId: string,
  objectId: string
): () => void {
  const db = getDatabaseInstance()
  const lockRef = ref(db, getLockPath(boardId, objectId))
  const onDisc = rtdbOnDisconnect(lockRef)
  onDisc.remove()

  return () => {
    onDisc.cancel()
  }
}
