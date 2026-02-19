/**
 * Presence hook: broadcast cursor positions, track who's online.
 * Positions go over Broadcast (same low-latency path as object moves).
 * Join/leave goes over Presence for automatic cleanup on disconnect.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  setupPresenceChannel,
  type PresenceEntry,
} from '../api/presenceApi'

const PRESENCE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

function hashToColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) - h) + userId.charCodeAt(i)
    h |= 0
  }
  const idx = Math.abs(h) % PRESENCE_COLORS.length
  return PRESENCE_COLORS[idx]
}

/** Send at most this often (ms). ~30fps — plenty for smooth cursor display. */
const THROTTLE_MS = 33

/** Remove a peer's cursor if they haven't broadcast in this long (ms). */
const STALE_MS = 3000

export interface UsePresenceOptions {
  boardId: string
  userId: string
  userName: string
}

export function usePresence({ boardId, userId, userName }: UsePresenceOptions): {
  others: PresenceEntry[]
  updatePresence: (x: number, y: number) => void
} {
  const [others, setOthers] = useState<PresenceEntry[]>([])
  const colorRef = useRef(hashToColor(userId))
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const lastSendRef = useRef(0)
  const scheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof setupPresenceChannel> | null>(null)

  const updatePresence = useCallback(
    (x: number, y: number) => {
      if (!boardId || !userId) return
      const handle = channelRef.current
      if (!handle) return

      const payload = {
        x,
        y,
        name: userName,
        color: colorRef.current,
        lastActive: Date.now(),
      }
      lastRef.current = { x, y }

      const now = Date.now()
      const elapsed = now - lastSendRef.current

      if (elapsed >= THROTTLE_MS || lastSendRef.current === 0) {
        lastSendRef.current = now
        handle.track(payload)
      } else if (!scheduledRef.current) {
        scheduledRef.current = setTimeout(() => {
          scheduledRef.current = null
          lastSendRef.current = Date.now()
          handle.track({
            ...payload,
            x: lastRef.current?.x ?? x,
            y: lastRef.current?.y ?? y,
          })
        }, THROTTLE_MS - elapsed)
      }
    },
    [boardId, userId, userName]
  )

  useEffect(() => {
    if (!boardId || !userId) return () => {}

    let latestEntries: PresenceEntry[] = []

    const handle = setupPresenceChannel(
      boardId,
      userId,
      { name: userName, color: colorRef.current },
      (entries) => {
        latestEntries = entries.filter((e) => e.userId !== userId)
        setOthers(latestEntries)
      }
    )
    channelRef.current = handle

    // Stale cursor cleanup: hide the canvas cursor for peers who haven't broadcast
    // recently, but keep them in the presence list (they're still connected).
    // Only Presence leave (tab close / disconnect) removes them from the list entirely.
    const staleTimer = setInterval(() => {
      const cutoff = Date.now() - STALE_MS
      let changed = false
      latestEntries = latestEntries.map((e) => {
        if (e.lastActive > 0 && e.lastActive <= cutoff) {
          changed = true
          return { ...e, lastActive: 0 }  // stub: cursor hidden, presence icon stays
        }
        return e
      })
      if (changed) setOthers([...latestEntries])
    }, 1000)

    return () => {
      channelRef.current = null
      clearInterval(staleTimer)
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
      handle.unsubscribe()
    }
  }, [boardId, userId, userName])

  return { others, updatePresence }
}
