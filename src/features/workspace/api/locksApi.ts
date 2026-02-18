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
  userName: string,
  broadcastChannel?: ReturnType<ReturnType<typeof getSupabaseClient>['channel']>
): Promise<boolean> {
  const supabase = getSupabaseClient()

  // Check if lock already exists (optimization to avoid unnecessary insert)
  const { data: existing } = await supabase
    .from('locks')
    .select('user_id')
    .eq('board_id', boardId)
    .eq('object_id', objectId)
    .maybeSingle()

  if (existing && existing.user_id !== userId) return false

  // Use INSERT instead of UPSERT - database enforces mutual exclusion via unique constraint
  // If another user already holds the lock, INSERT will fail with unique constraint violation
  const { error } = await supabase.from('locks').insert({
    board_id: boardId,
    object_id: objectId,
    user_id: userId,
    user_name: userName,
    last_active: Date.now(),
  })

  // Error code 23505 = unique constraint violation (lock already held by another user)
  if (error) {
    // If it's our own lock, update it (reacquiring after connection drop)
    if (existing && existing.user_id === userId) {
      const { error: updateError } = await supabase
        .from('locks')
        .update({ last_active: Date.now() })
        .eq('board_id', boardId)
        .eq('object_id', objectId)
        .eq('user_id', userId)
      
      if (updateError) return false
    } else {
      // Lock held by someone else - acquisition failed
      return false
    }
  }

  // Broadcast lock acquisition for instant propagation (<100ms)
  if (broadcastChannel) {
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'lock_acquired',
      payload: { objectId, userId, userName, lastActive: Date.now() },
    })
  }

  return true
}

export async function releaseLock(
  boardId: string,
  objectId: string,
  userId: string,
  broadcastChannel?: ReturnType<ReturnType<typeof getSupabaseClient>['channel']>
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

  // Broadcast lock release for instant propagation (<100ms)
  if (broadcastChannel) {
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'lock_released',
      payload: { objectId, userId },
    })
  }
}

export function subscribeToLocks(
  boardId: string,
  onLocks: (locks: LockEntry[]) => void,
  onBroadcastLockAcquired?: (lock: LockEntry) => void,
  onBroadcastLockReleased?: (objectId: string, userId: string) => void
): { cleanup: () => void; channel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> } {
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
    .on(
      'broadcast',
      { event: 'lock_acquired' },
      (payload) => {
        const data = payload.payload as { objectId: string; userId: string; userName: string; lastActive: number }
        if (onBroadcastLockAcquired) {
          onBroadcastLockAcquired({
            objectId: data.objectId,
            userId: data.userId,
            userName: data.userName,
            lastActive: data.lastActive,
          })
        }
      }
    )
    .on(
      'broadcast',
      { event: 'lock_released' },
      (payload) => {
        const data = payload.payload as { objectId: string; userId: string }
        if (onBroadcastLockReleased) {
          onBroadcastLockReleased(data.objectId, data.userId)
        }
      }
    )
    .subscribe((status, err) => {
      // Only log unexpected errors; CLOSED is expected when we call removeChannel during cleanup
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[LOCKS] Channel error:', status, err)
      }
    })

  return {
    cleanup: () => supabase.removeChannel(channel),
    channel,
  }
}

/** No-op for Supabase (no onDisconnect). Client should release on unmount. */
export function setupLockDisconnect(
  _boardId: string,
  _objectId: string
): () => void {
  return () => {}
}
