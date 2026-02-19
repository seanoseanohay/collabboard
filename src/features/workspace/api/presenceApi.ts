/**
 * Cursor presence via Supabase Realtime — same channel pattern as object move-deltas:
 *
 *  Broadcast  → cursor positions   (high-freq, fire-and-forget, low latency)
 *  Presence   → join / leave only  (name + color, no position — used for online list and cleanup)
 *
 * Using Broadcast for positions matches how object movements work and avoids the extra
 * server-side state reconciliation that Presence does for every track() call.
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

/** Payload tracked via Presence (join/leave only — no position). */
interface OnlinePayload {
  userId: string
  name: string
  color: string
}

export interface PresenceChannelHandle {
  /** Broadcast our current cursor position to all subscribers. */
  track: (payload: PresencePayload) => void
  /** Remove our presence and unsubscribe. Call on unmount. */
  unsubscribe: () => void
}

/**
 * Set up the cursor channel using a single Supabase Realtime channel with:
 *  - Broadcast for position updates (same low-latency path as move_deltas)
 *  - Presence for online/offline tracking (auto-cleanup on disconnect)
 *
 * The cache starts populated from Presence sync (stub entries with lastActive=0).
 * CursorOverlay skips entries with lastActive=0, so cursors only appear once the
 * user has broadcast at least one real position.
 */
export function setupPresenceChannel(
  boardId: string,
  userId: string,
  initial: { name: string; color: string },
  onPresence: (entries: PresenceEntry[]) => void
): PresenceChannelHandle {
  const supabase = getSupabaseClient()

  /** Cache of all known peers (keyed by userId). */
  const cache = new Map<string, PresenceEntry>()

  const emit = () => onPresence(Array.from(cache.values()))

  const channel = supabase.channel(`cursor:${boardId}`, {
    config: { presence: { key: userId } },
  })

  channel
    // ── Broadcast: receive real-time cursor positions from peers ──────────
    .on('broadcast', { event: 'cursor' }, (msg) => {
      const p = msg.payload as (PresencePayload & { userId: string }) | undefined
      if (!p?.userId || p.userId === userId) return
      cache.set(p.userId, {
        userId: p.userId,
        x: p.x,
        y: p.y,
        name: p.name,
        color: p.color,
        lastActive: p.lastActive,
      })
      emit()
    })

    // ── Presence sync: populate cache when we first subscribe ─────────────
    // Gives us the name list even before peers move their cursors.
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<OnlinePayload>()
      for (const [key, payloads] of Object.entries(state)) {
        if (key === userId) continue
        const p = (payloads as OnlinePayload[])[0]
        if (p && !cache.has(key)) {
          cache.set(key, {
            userId: key,
            x: 0,
            y: 0,
            name: p.name ?? 'Anonymous',
            color: p.color ?? '#6366f1',
            lastActive: 0,
          })
        }
      }
      emit()
    })

    // ── Presence join: peer connected ─────────────────────────────────────
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const p of (newPresences as unknown as OnlinePayload[]) ?? []) {
        if (!p.userId || p.userId === userId) continue
        if (!cache.has(p.userId)) {
          cache.set(p.userId, {
            userId: p.userId,
            x: 0,
            y: 0,
            name: p.name ?? 'Anonymous',
            color: p.color ?? '#6366f1',
            lastActive: 0,
          })
        }
      }
      emit()
    })

    // ── Presence leave: peer disconnected — remove their cursor ───────────
    .on('presence', { event: 'leave' }, ({ key }) => {
      if (key) cache.delete(key as string)
      emit()
    })

    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track our online state (name + color) so peers know we're here.
        // Position is sent via Broadcast only — not tracked in Presence.
        await channel.track({ userId, name: initial.name, color: initial.color })
      }
    })

  const track = (payload: PresencePayload) => {
    void channel.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { ...payload, userId },
    })
  }

  const unsubscribe = () => {
    void channel.untrack()
    supabase.removeChannel(channel)
  }

  return { track, unsubscribe }
}
