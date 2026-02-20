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

/** Fetch a single document by board and object id. Returns null if not found. */
export async function getDocument(
  boardId: string,
  objectId: string
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .select('data')
    .eq('board_id', boardId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error) throw error
  return (data?.data as Record<string, unknown>) ?? null
}

export type DocumentQueryCriteria = {
  type?: string
  fill?: string
}

/** Fetch a specific set of documents by their object IDs. */
export async function getDocumentsByIds(
  boardId: string,
  objectIds: string[]
): Promise<{ objectId: string; data: Record<string, unknown> }[]> {
  if (objectIds.length === 0) return []
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .select('object_id, data')
    .eq('board_id', boardId)
    .in('object_id', objectIds)
  if (error) throw error
  const rows = data ?? []
  return rows
    .filter((row): row is { object_id: string; data: Record<string, unknown> } => !!row?.object_id && !!row.data)
    .map((row) => ({ objectId: row.object_id, data: row.data }))
}

const QUERY_PAGE_SIZE = 500

/** Fetch documents for a board with optional criteria. For AI/client query use. */
export async function fetchDocuments(
  boardId: string,
  criteria?: DocumentQueryCriteria
): Promise<{ objectId: string; data: Record<string, unknown> }[]> {
  const supabase = getSupabaseClient()
  let query = supabase
    .from('documents')
    .select('object_id, data')
    .eq('board_id', boardId)
    .order('object_id', { ascending: true })
    .limit(QUERY_PAGE_SIZE)
  if (criteria?.type) {
    query = query.eq('data->>type', criteria.type)
  }
  if (criteria?.fill) {
    query = query.eq('data->>fill', criteria.fill)
  }
  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  return rows
    .filter((row): row is { object_id: string; data: Record<string, unknown> } => !!row?.object_id && !!row.data)
    .map((row) => ({ objectId: row.object_id, data: row.data }))
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

  const PAGE_SIZE = 1000

  const fetchInitial = async () => {
    let offset = 0
    let hasMore = true
    let loadIndex = 0
    while (hasMore) {
      const { data } = await supabase
        .from('documents')
        .select('object_id, data')
        .eq('board_id', boardId)
        .order('updated_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      const rows = data ?? []
      for (const row of rows) {
        if (row?.object_id && row.data) {
          const docData = row.data as Record<string, unknown>
          if (docData.zIndex == null) {
            docData.zIndex = loadIndex++
          }
          callbacks.onAdded(row.object_id, docData)
        }
      }
      hasMore = rows.length === PAGE_SIZE
      offset += PAGE_SIZE
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
