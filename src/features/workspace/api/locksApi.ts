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

  if (existing) {
    if (existing.user_id !== userId) return false
    // We already own this lock (stale from previous session) — refresh the timestamp directly
    const { error: updateError } = await supabase
      .from('locks')
      .update({ last_active: Date.now() })
      .eq('board_id', boardId)
      .eq('object_id', objectId)
      .eq('user_id', userId)
    if (updateError) return false
  } else {
    // No existing lock — INSERT (database unique constraint prevents race with another user)
    const { error } = await supabase.from('locks').insert({
      board_id: boardId,
      object_id: objectId,
      user_id: userId,
      user_name: userName,
      last_active: Date.now(),
    })
    if (error) return false
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
  onBroadcastLockAcquired?: (lock: LockEntry & { allIds?: string[] }) => void,
  onBroadcastLockReleased?: (objectId: string, userId: string, allIds?: string[]) => void
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
        const data = payload.payload as { objectId: string; userId: string; userName: string; lastActive: number; allIds?: string[] }
        if (onBroadcastLockAcquired) {
          onBroadcastLockAcquired({
            objectId: data.objectId,
            userId: data.userId,
            userName: data.userName,
            lastActive: data.lastActive,
            allIds: data.allIds,
          })
        }
      }
    )
    .on(
      'broadcast',
      { event: 'lock_released' },
      (payload) => {
        const data = payload.payload as { objectId: string; userId: string; allIds?: string[] }
        if (onBroadcastLockReleased) {
          onBroadcastLockReleased(data.objectId, data.userId, data.allIds)
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

/** Acquire locks for multiple objects in batched DB calls (avoids connection exhaustion).
 * Returns false ONLY when another user holds a lock. Network/DB errors are treated as
 * best-effort (selection stays, locks are attempted but not guaranteed). */
export async function acquireLocksBatch(
  boardId: string,
  objectIds: string[],
  userId: string,
  userName: string,
  broadcastChannel?: ReturnType<ReturnType<typeof getSupabaseClient>['channel']>
): Promise<boolean> {
  if (objectIds.length === 0) return true
  const supabase = getSupabaseClient()
  const CHUNK = 100
  const now = Date.now()

  try {
    // Check existing locks in chunks (Supabase .in() has URL length limits)
    const existingMap = new Map<string, string>()
    for (let i = 0; i < objectIds.length; i += CHUNK) {
      const chunk = objectIds.slice(i, i + CHUNK)
      const { data } = await supabase
        .from('locks')
        .select('object_id, user_id')
        .eq('board_id', boardId)
        .in('object_id', chunk)
      for (const r of data ?? []) existingMap.set(r.object_id, r.user_id)
    }

    // Only fail if another user actually holds a lock
    for (const [, lockUserId] of existingMap) {
      if (lockUserId !== userId) return false
    }

    // Upsert all locks (handles both fresh inserts and stale-lock refreshes in one call)
    for (let i = 0; i < objectIds.length; i += CHUNK) {
      const chunk = objectIds.slice(i, i + CHUNK)
      const rows = chunk.map((id) => ({
        board_id: boardId,
        object_id: id,
        user_id: userId,
        user_name: userName,
        last_active: now,
      }))
      await supabase
        .from('locks')
        .upsert(rows, { onConflict: 'board_id,object_id' })
    }
  } catch {
    // Network/DB failure is best-effort — don't kill the selection
  }

  if (broadcastChannel) {
    broadcastChannel.send({
      type: 'broadcast',
      event: 'lock_acquired',
      payload: { objectId: objectIds[0], userId, userName, lastActive: now, allIds: objectIds },
    }).catch(() => {})
  }
  return true
}

/** Release locks for multiple objects in chunked DB calls. */
export async function releaseLocksBatch(
  boardId: string,
  objectIds: string[],
  userId: string,
  broadcastChannel?: ReturnType<ReturnType<typeof getSupabaseClient>['channel']>
): Promise<void> {
  if (objectIds.length === 0) return
  const supabase = getSupabaseClient()
  const CHUNK = 100

  try {
    for (let i = 0; i < objectIds.length; i += CHUNK) {
      const chunk = objectIds.slice(i, i + CHUNK)
      await supabase
        .from('locks')
        .delete()
        .eq('board_id', boardId)
        .eq('user_id', userId)
        .in('object_id', chunk)
    }
  } catch {
    // Best-effort release — stale locks will be cleaned up by timeout
  }

  if (broadcastChannel) {
    broadcastChannel.send({
      type: 'broadcast',
      event: 'lock_released',
      payload: { objectId: objectIds[0], userId, allIds: objectIds },
    }).catch(() => {})
  }
}

/** No-op for Supabase (no onDisconnect). Client should release on unmount. */
export function setupLockDisconnect(
  _boardId: string,
  _objectId: string
): () => void {
  return () => {}
}
