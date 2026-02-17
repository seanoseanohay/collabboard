import { getSupabaseClient } from '@/shared/lib/supabase/config'

export interface BoardMeta {
  id: string
  title: string
  createdAt: number
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

  await supabase.from('user_boards').upsert(
    {
      user_id: userId,
      board_id: boardId,
      title: board.title ?? 'Untitled',
    },
    { onConflict: 'user_id,board_id' }
  )

  return {
    id: board.id,
    title: board.title ?? 'Untitled',
    createdAt: new Date(board.created_at).getTime(),
  }
}

export function subscribeToUserBoards(
  userId: string,
  onBoards: (boards: BoardMeta[]) => void
): () => void {
  const supabase = getSupabaseClient()

  const mapRow = (r: { board_id: string; title?: string; created_at?: string }) => ({
    id: r.board_id,
    title: r.title ?? 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
  })

  const fetch = async () => {
    const { data } = await supabase
      .from('user_boards')
      .select('board_id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
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
