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

  const PAGE_SIZE = 50

  const fetchInitial = async () => {
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const { data } = await supabase
        .from('documents')
        .select('object_id, data')
        .eq('board_id', boardId)
        .order('object_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      const rows = data ?? []
      for (const row of rows) {
        if (row?.object_id && row.data) {
          callbacks.onAdded(row.object_id, row.data as Record<string, unknown>)
        }
      }
      hasMore = rows.length === PAGE_SIZE
      offset += PAGE_SIZE
      // Yield to UI after first batch so canvas appears responsive
      if (hasMore) await new Promise((r) => setTimeout(r, 0))
    }
  }

  fetchInitial()

  const channel = supabase
    .channel(`documents:${boardId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `board_id=eq.${boardId}`,
      },
      (payload) => {
        const evt = (payload as { eventType?: string }).eventType
        if (evt === 'DELETE' && payload.old) {
          const row = payload.old as { board_id?: string; object_id?: string }
          if (row?.object_id && row.board_id === boardId) callbacks.onRemoved(row.object_id)
        } else if (payload.new) {
          const row = payload.new as { board_id?: string; object_id: string; data?: Record<string, unknown> }
          if (row?.object_id && row.data && row.board_id === boardId) {
            if (evt === 'INSERT') callbacks.onAdded(row.object_id, row.data)
            else callbacks.onChanged(row.object_id, row.data)
          }
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
