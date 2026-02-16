import { useEffect, useState } from 'react'
import type { BoardMeta } from '../api/boardsApi'
import { subscribeToUserBoards } from '../api/boardsApi'

export function useUserBoards(userId: string | undefined): BoardMeta[] {
  const [boards, setBoards] = useState<BoardMeta[]>([])

  useEffect(() => {
    if (!userId) {
      setBoards([])
      return
    }
    const unsubscribe = subscribeToUserBoards(userId, setBoards)
    return () => unsubscribe()
  }, [userId])

  return boards
}
