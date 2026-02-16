import {
  ref,
  update,
  onValue,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database'
import { getDatabaseInstance } from '@/shared/lib/firebase/config'

export interface BoardMeta {
  id: string
  title: string
  createdAt: number
}

export async function createBoard(
  userId: string,
  title: string = 'Untitled Board'
): Promise<string> {
  const db = getDatabaseInstance()
  const boardId = crypto.randomUUID()
  const updates: Record<string, unknown> = {
    [`boards/${boardId}/title`]: title,
    [`boards/${boardId}/ownerId`]: userId,
    [`boards/${boardId}/members/${userId}`]: true,
    [`boards/${boardId}/createdAt`]: serverTimestamp(),
    [`user_boards/${userId}/${boardId}/title`]: title,
    [`user_boards/${userId}/${boardId}/createdAt`]: serverTimestamp(),
  }
  await update(ref(db), updates)
  return boardId
}

export function subscribeToUserBoards(
  userId: string,
  onBoards: (boards: BoardMeta[]) => void
): Unsubscribe {
  const db = getDatabaseInstance()
  const userBoardsRef = ref(db, `user_boards/${userId}`)
  return onValue(
    userBoardsRef,
    (snapshot) => {
      const val = snapshot.val()
      if (!val) {
        onBoards([])
        return
      }
      const boards: BoardMeta[] = Object.entries(val).map(
        ([id, data]: [string, unknown]) => {
          const d = data as { title?: string; createdAt?: number }
          return {
            id,
            title: d.title ?? 'Untitled',
            createdAt: d.createdAt ?? 0,
          }
        }
      )
      boards.sort((a, b) => b.createdAt - a.createdAt)
      onBoards(boards)
    },
    (err) => {
      console.error('subscribeToUserBoards error:', err)
      onBoards([])
    }
  )
}
