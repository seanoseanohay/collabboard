import { useEffect, useState } from 'react'
import type { BoardMeta } from '../api/boardsApi'
import { subscribeToUserBoards } from '../api/boardsApi'

export function useUserBoards(userId: string | undefined): {
  boards: BoardMeta[]
  loading: boolean
} {
  const [boards, setBoards] = useState<BoardMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setBoards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToUserBoards(userId, (next) => {
      setBoards(next)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [userId])

  return { boards, loading }
}
