import { getSupabaseClient } from '@/shared/lib/supabase/config'

export interface BoardMeta {
  id: string
  title: string
  createdAt: number
  lastAccessedAt: number
}

export async function createBoard(
  userId: string,
  title: string = 'Untitled Board'
): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .insert({ title, owner_id: userId })
    .select('id')
    .single()

  if (boardErr || !board) throw new Error(boardErr?.message ?? 'Failed to create board')

  await supabase.from('board_members').insert({
    board_id: board.id,
    user_id: userId,
  })

  await supabase.from('user_boards').insert({
    user_id: userId,
    board_id: board.id,
    title,
  })

  return board.id
}

export async function updateBoardTitle(
  boardId: string,
  userId: string,
  title: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error: boardErr } = await supabase
    .from('boards')
    .update({ title })
    .eq('id', boardId)

  if (boardErr) throw new Error(boardErr.message)

  await supabase
    .from('user_boards')
    .update({ title })
    .eq('user_id', userId)
    .eq('board_id', boardId)
}

export async function deleteBoard(boardId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('boards').delete().eq('id', boardId)
  if (error) throw new Error(error.message)
}

export async function joinBoard(
  boardId: string,
  userId: string
): Promise<BoardMeta> {
  const supabase = getSupabaseClient()

  await supabase.from('board_members').upsert(
    { board_id: boardId, user_id: userId },
    { onConflict: 'board_id,user_id' }
  )

  const { data: board, error } = await supabase
    .from('boards')
    .select('id, title, created_at')
    .eq('id', boardId)
    .single()

  if (error || !board) throw new Error('Board not found')

  const now = new Date().toISOString()
  await supabase.from('user_boards').upsert(
    {
      user_id: userId,
      board_id: boardId,
      title: board.title ?? 'Untitled',
      last_accessed_at: now,
    },
    { onConflict: 'user_id,board_id' }
  )

  return {
    id: board.id,
    title: board.title ?? 'Untitled',
    createdAt: new Date(board.created_at).getTime(),
    lastAccessedAt: new Date(now).getTime(),
  }
}

/** Record that the user opened this board; used for "recently opened" ordering. */
export async function recordBoardAccess(
  boardId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase
    .from('user_boards')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('board_id', boardId)
}

export function subscribeToUserBoards(
  userId: string,
  onBoards: (boards: BoardMeta[]) => void
): () => void {
  const supabase = getSupabaseClient()

  const mapRow = (r: {
    board_id: string
    title?: string
    created_at?: string
    last_accessed_at?: string
  }) => ({
    id: r.board_id,
    title: r.title ?? 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
    lastAccessedAt: r.last_accessed_at
      ? new Date(r.last_accessed_at).getTime()
      : 0,
  })

  const fetch = async () => {
    const { data } = await supabase
      .from('user_boards')
      .select('board_id, title, created_at, last_accessed_at')
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false })
    const boards = (data ?? []).map(mapRow)
    onBoards(boards)
  }

  fetch()

  const channel = supabase
    .channel(`user_boards:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_boards',
        filter: `user_id=eq.${userId}`,
      },
      () => fetch()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
