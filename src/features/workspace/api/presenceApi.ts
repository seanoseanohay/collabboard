/**
 * Supabase presence for multiplayer cursors.
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

export function writePresence(
  boardId: string,
  userId: string,
  payload: PresencePayload
): void {
  const supabase = getSupabaseClient()
  supabase
    .from('presence')
    .upsert(
      {
        board_id: boardId,
        user_id: userId,
        x: payload.x,
        y: payload.y,
        name: payload.name,
        color: payload.color,
        last_active: payload.lastActive,
      },
      { onConflict: 'board_id,user_id' }
    )
    .then(() => {})
}

export function subscribeToPresence(
  boardId: string,
  onPresence: (entries: PresenceEntry[]) => void
): () => void {
  const supabase = getSupabaseClient()

  const fetch = async () => {
    const { data } = await supabase
      .from('presence')
      .select('user_id, x, y, name, color, last_active')
      .eq('board_id', boardId)

    const entries: PresenceEntry[] = (data ?? []).map((r) => ({
      userId: r.user_id,
      x: r.x ?? 0,
      y: r.y ?? 0,
      name: r.name ?? 'Anonymous',
      color: r.color ?? '#6366f1',
      lastActive: r.last_active ?? 0,
    }))
    onPresence(entries)
  }

  fetch()

  const channel = supabase
    .channel(`presence:${boardId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'presence', filter: `board_id=eq.${boardId}` },
      () => fetch()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/** Returns cleanup that removes our presence row (call on unmount). */
export function setupPresenceDisconnect(
  boardId: string,
  userId: string
): () => void {
  return () => {
    const supabase = getSupabaseClient()
    supabase.from('presence').delete().eq('board_id', boardId).eq('user_id', userId).then(() => {})
  }
}
