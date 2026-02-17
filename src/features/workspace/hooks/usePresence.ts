/**
 * Presence hook: subscribe to others' cursors, debounce our own updates.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  subscribeToPresence,
  writePresence,
  setupPresenceDisconnect,
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

const DEBOUNCE_MS = 50

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  const updatePresence = useCallback(
    (x: number, y: number) => {
      if (!boardId || !userId) return
      const payload = {
        x,
        y,
        name: userName,
        color: colorRef.current,
        lastActive: Date.now(),
      }
      lastRef.current = { x, y }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        writePresence(boardId, userId, payload)
      }, DEBOUNCE_MS)
    },
    [boardId, userId, userName]
  )

  useEffect(() => {
    if (!boardId || !userId) return () => {}
    const clearPresence = setupPresenceDisconnect(boardId, userId)
    const unsub = subscribeToPresence(boardId, (entries) => {
      setOthers(entries.filter((e) => e.userId !== userId))
    })
    return () => {
      unsub()
      clearPresence()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [boardId, userId])

  return { others, updatePresence }
}
