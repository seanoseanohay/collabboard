/**
 * Supabase delta sync for board documents. Object-level patches only.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'

export type DocumentDelta = { objectId: string; data: Record<string, unknown> | null }

export function getDocumentsPath(boardId: string): string {
  return `boards/${boardId}/documents`
}

export async function writeDocument(
  boardId: string,
  objectId: string,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('documents')
    .upsert(
      { board_id: boardId, object_id: objectId, data, updated_at: new Date().toISOString() },
      { onConflict: 'board_id,object_id' }
    )
  if (error) throw error
}

export async function deleteDocument(
  boardId: string,
  objectId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('board_id', boardId)
    .eq('object_id', objectId)
  if (error) throw error
}

export function subscribeToDocuments(
  boardId: string,
  callbacks: {
    onAdded: (objectId: string, data: Record<string, unknown>) => void
    onChanged: (objectId: string, data: Record<string, unknown>) => void
    onRemoved: (objectId: string) => void
  }
): () => void {
  const supabase = getSupabaseClient()

  const fetchInitial = async () => {
    const { data } = await supabase
      .from('documents')
      .select('object_id, data')
      .eq('board_id', boardId)
    for (const row of data ?? []) {
      if (row?.object_id && row.data) {
        callbacks.onAdded(row.object_id, row.data as Record<string, unknown>)
      }
    }
  }

  fetchInitial()

  let channel: ReturnType<typeof supabase.channel> | null = null
  const id = setTimeout(() => {
    channel = supabase
      .channel(`documents:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = payload.new as { object_id: string; data?: Record<string, unknown> }
          if (row?.object_id && row.data) callbacks.onAdded(row.object_id, row.data)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = payload.new as { object_id: string; data?: Record<string, unknown> }
          if (row?.object_id && row.data) callbacks.onChanged(row.object_id, row.data)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'documents',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = payload.old as { object_id?: string }
          if (row?.object_id) callbacks.onRemoved(row.object_id)
        }
      )
      .subscribe()
  }, 0)

  return () => {
    clearTimeout(id)
    if (channel) supabase.removeChannel(channel)
  }
}
