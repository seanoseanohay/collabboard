/**
 * Supabase Realtime Presence for multiplayer cursors.
 * Uses the Presence API (WebSocket) instead of postgres_changes — no DB round-trip,
 * so cursor updates have minimal latency. Designed for collaborative cursors.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'

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

/** Presence state shape from Supabase; key is the presence key (userId). */
interface PresenceState {
  [key: string]: Array<PresencePayload & { userId?: string }>
}

function presenceStateToEntries(state: PresenceState): PresenceEntry[] {
  const entries: PresenceEntry[] = []
  for (const [key, payloads] of Object.entries(state)) {
    const p = payloads?.[0]
    if (p && key) {
      entries.push({
        userId: key,
        x: p.x ?? 0,
        y: p.y ?? 0,
        name: p.name ?? 'Anonymous',
        color: p.color ?? '#6366f1',
        lastActive: p.lastActive ?? 0,
      })
    }
  }
  return entries
}

export interface PresenceChannelHandle {
  /** Update our cursor position. Call on pointer move (throttled by the hook). */
  track: (payload: PresencePayload) => void
  /** Unsubscribe and stop tracking. Call on unmount. */
  unsubscribe: () => void
}

/**
 * Subscribe to presence and start tracking. Uses Supabase Realtime Presence (WebSocket),
 * not postgres_changes — cursor updates bypass the database for low latency.
 *
 * @param boardId - Board/channel ID
 * @param userId - Our user ID (used as presence key so we have one slot per user)
 * @param initialPayload - Initial cursor state (name, color)
 * @param onPresence - Callback when presence state changes
 */
export function setupPresenceChannel(
  boardId: string,
  userId: string,
  initialPayload: Omit<PresencePayload, 'x' | 'y' | 'lastActive'>,
  onPresence: (entries: PresenceEntry[]) => void
): PresenceChannelHandle {
  const supabase = getSupabaseClient()

  const channel = supabase.channel(`presence:${boardId}`, {
    config: { presence: { key: userId } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload & { userId?: string }>()
      onPresence(presenceStateToEntries(state as PresenceState))
    })
    .on('presence', { event: 'join' }, () => {
      const state = channel.presenceState<PresencePayload & { userId?: string }>()
      onPresence(presenceStateToEntries(state as PresenceState))
    })
    .on('presence', { event: 'leave' }, () => {
      const state = channel.presenceState<PresencePayload & { userId?: string }>()
      onPresence(presenceStateToEntries(state as PresenceState))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          ...initialPayload,
          x: 0,
          y: 0,
          lastActive: Date.now(),
        })
      }
    })

  const track = (payload: PresencePayload) => {
    void channel.track(payload)
  }

  const unsubscribe = () => {
    void channel.untrack()
    supabase.removeChannel(channel)
  }

  return { track, unsubscribe }
}
