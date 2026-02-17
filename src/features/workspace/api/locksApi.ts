/**
 * Supabase locks for object-level editing. Prevents concurrent edits.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'

export interface LockEntry {
  objectId: string
  userId: string
  userName: string
  lastActive: number
}

export async function acquireLock(
  boardId: string,
  objectId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const supabase = getSupabaseClient()

  const { data: existing } = await supabase
    .from('locks')
    .select('user_id')
    .eq('board_id', boardId)
    .eq('object_id', objectId)
    .maybeSingle()

  if (existing && existing.user_id !== userId) return false

  const { error } = await supabase.from('locks').upsert(
    {
      board_id: boardId,
      object_id: objectId,
      user_id: userId,
      user_name: userName,
      last_active: Date.now(),
    },
    { onConflict: 'board_id,object_id' }
  )

  return !error
}

export async function releaseLock(
  boardId: string,
  objectId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('locks')
    .select('user_id')
    .eq('board_id', boardId)
    .eq('object_id', objectId)
    .maybeSingle()

  if (!data || data.user_id !== userId) return

  await supabase
    .from('locks')
    .delete()
    .eq('board_id', boardId)
    .eq('object_id', objectId)
}

export function subscribeToLocks(
  boardId: string,
  onLocks: (locks: LockEntry[]) => void
): () => void {
  const supabase = getSupabaseClient()

  const fetch = async () => {
    const { data } = await supabase
      .from('locks')
      .select('object_id, user_id, user_name, last_active')
      .eq('board_id', boardId)

    const entries: LockEntry[] = (data ?? []).map((r) => ({
      objectId: r.object_id,
      userId: r.user_id,
      userName: r.user_name ?? 'Unknown',
      lastActive: r.last_active ?? 0,
    }))
    onLocks(entries)
  }

  fetch()

  const channel = supabase
    .channel(`locks:${boardId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'locks', filter: `board_id=eq.${boardId}` },
      () => fetch()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/** No-op for Supabase (no onDisconnect). Client should release on unmount. */
export function setupLockDisconnect(
  _boardId: string,
  _objectId: string
): () => void {
  return () => {}
}
