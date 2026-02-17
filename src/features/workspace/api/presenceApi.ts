/**
 * RTDB presence for multiplayer cursors.
 * Path: presence/{boardId}/{userId}
 */

import {
  ref,
  set,
  onValue,
  onDisconnect as rtdbOnDisconnect,
  type Unsubscribe,
} from 'firebase/database'
import { getDatabaseInstance } from '@/shared/lib/firebase/config'

export interface PresencePayload {
  x: number
  y: number
  name: string
  color: string
  lastActive: number
}

export interface PresenceEntry extends PresencePayload {
  userId: string
}

function getPresencePath(boardId: string, userId: string): string {
  return `presence/${boardId}/${userId}`
}

export function writePresence(
  boardId: string,
  userId: string,
  payload: PresencePayload
): void {
  const db = getDatabaseInstance()
  const presenceRef = ref(db, getPresencePath(boardId, userId))
  set(presenceRef, payload)
}

export function subscribeToPresence(
  boardId: string,
  onPresence: (entries: PresenceEntry[]) => void
): Unsubscribe {
  const db = getDatabaseInstance()
  const presenceRef = ref(db, `presence/${boardId}`)

  const unsub = onValue(presenceRef, (snapshot) => {
    const val = snapshot.val()
    if (!val || typeof val !== 'object') {
      onPresence([])
      return
    }
    const entries: PresenceEntry[] = []
    for (const [uid, data] of Object.entries(val)) {
      if (uid && data && typeof data === 'object') {
        const d = data as Record<string, unknown>
        const x = typeof d.x === 'number' ? d.x : 0
        const y = typeof d.y === 'number' ? d.y : 0
        const name = typeof d.name === 'string' ? d.name : 'Anonymous'
        const color = typeof d.color === 'string' ? d.color : '#6366f1'
        const lastActive = typeof d.lastActive === 'number' ? d.lastActive : 0
        entries.push({ userId: uid, x, y, name, color, lastActive })
      }
    }
    onPresence(entries)
  })

  return unsub
}

export function setupPresenceDisconnect(
  boardId: string,
  userId: string
): void {
  const db = getDatabaseInstance()
  const presenceRef = ref(db, getPresencePath(boardId, userId))
  const onDisc = rtdbOnDisconnect(presenceRef)
  onDisc.remove()
}
