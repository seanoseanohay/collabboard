import { getSupabaseClient } from '@/shared/lib/supabase/config'

export interface BoardMeta {
  id: string
  title: string
  createdAt: number
  lastAccessedAt: number
  isPublic?: boolean
  ownerId?: string
  objectCount?: number
  thumbnailUrl?: string
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

export async function leaveBoard(boardId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('user_boards')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function joinBoard(
  boardId: string,
  userId: string
): Promise<BoardMeta> {
  const supabase = getSupabaseClient()

  // board_members upsert and boards fetch are independent — run in parallel
  const [, { data: board, error }] = await Promise.all([
    supabase.from('board_members').upsert(
      { board_id: boardId, user_id: userId },
      { onConflict: 'board_id,user_id' }
    ),
    supabase
      .from('boards')
      .select('id, title, created_at, is_public, owner_id')
      .eq('id', boardId)
      .single(),
  ])

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
    isPublic: board.is_public ?? false,
    ownerId: board.owner_id,
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

export interface BoardMember {
  userId: string
  displayName: string
  email: string
  isOwner: boolean
  joinedAt: number
}

export async function getBoardMembers(boardId: string): Promise<BoardMember[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('get_board_members', {
    p_board_id: boardId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map(
    (r: {
      user_id: string
      display_name: string
      email: string
      is_owner: boolean
      joined_at: string
    }) => ({
      userId: r.user_id,
      displayName: r.display_name,
      email: r.email,
      isOwner: r.is_owner,
      joinedAt: new Date(r.joined_at).getTime(),
    })
  )
}

export async function removeBoardMember(
  boardId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('remove_board_member', {
    p_board_id: boardId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function fetchPublicBoards(): Promise<BoardMeta[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, owner_id, created_at, is_public, thumbnail_url')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? 'Untitled',
    createdAt: new Date(r.created_at).getTime(),
    lastAccessedAt: 0,
    isPublic: true,
    ownerId: r.owner_id,
    thumbnailUrl: r.thumbnail_url ?? undefined,
  }))
}

export async function updateBoardVisibility(
  boardId: string,
  isPublic: boolean
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('update_board_visibility', {
    p_board_id: boardId,
    p_is_public: isPublic,
  })
  if (error) throw new Error(error.message)
}

export function subscribeToUserBoards(
  userId: string,
  onBoards: (boards: BoardMeta[]) => void
): () => void {
  const supabase = getSupabaseClient()

  const fetchWithCounts = async () => {
    const { data } = await supabase.rpc('get_user_boards_with_counts', {
      p_user_id: userId,
    })
    const boards: BoardMeta[] = (data ?? []).map(
      (r: {
        board_id: string
        title?: string
        created_at?: string
        last_accessed_at?: string
        is_public?: boolean
        owner_id?: string
        object_count?: number
        thumbnail_url?: string
      }) => ({
        id: r.board_id,
        title: r.title ?? 'Untitled',
        createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
        lastAccessedAt: r.last_accessed_at
          ? new Date(r.last_accessed_at).getTime()
          : 0,
        isPublic: r.is_public ?? false,
        ownerId: r.owner_id,
        objectCount: Number(r.object_count ?? 0),
        thumbnailUrl: r.thumbnail_url ?? undefined,
      })
    )
    onBoards(boards)
  }

  fetchWithCounts()

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
      () => void fetchWithCounts()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
