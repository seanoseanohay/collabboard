import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOutUser } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUserBoards } from '@/features/boards/hooks/useUserBoards'
import { createBoard, joinBoard } from '@/features/boards/api/boardsApi'
import { parseBoardIdFromShareInput } from '@/shared/lib/shareLinks'
import type { BoardMeta } from '@/features/boards/api/boardsApi'

export function BoardListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const boards = useUserBoards(user?.uid)
  const [creating, setCreating] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const userId = user?.uid ?? ''

  const handleCreate = async () => {
    setCreating(true)
    try {
      const boardId = await createBoard(userId, 'Untitled Board')
      navigate(`/board/${boardId}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectBoard = (board: BoardMeta) => {
    navigate(`/board/${board.id}`)
  }

  const handleJoin = async () => {
    const boardId = parseBoardIdFromShareInput(joinInput)
    if (!boardId || !userId) {
      setJoinError('Paste a board link or ID')
      return
    }
    setJoinError(null)
    setJoining(true)
    try {
      await joinBoard(boardId, userId)
      navigate(`/board/${boardId}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Board not found')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>CollabBoard</h1>
        <div style={styles.userRow}>
          <span style={styles.email}>{user?.email ?? 'Signed in'}</span>
          <button
            type="button"
            onClick={() => signOutUser()}
            style={styles.btn}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={styles.main}>
        <div style={styles.toolbar}>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            style={styles.createBtn}
          >
            {creating ? 'Creating…' : '+ New Board'}
          </button>
          <div style={styles.joinRow}>
            <input
              type="text"
              placeholder="Paste board link or ID"
              value={joinInput}
              onChange={(e) => {
                setJoinInput(e.target.value)
                setJoinError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              style={styles.joinInput}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              style={styles.joinBtn}
            >
              {joining ? 'Joining…' : 'Join Board'}
            </button>
          </div>
          {joinError && <p style={styles.joinError}>{joinError}</p>}
        </div>
        {boards.length === 0 ? (
          <p style={styles.empty}>No boards yet. Create one to get started.</p>
        ) : (
          <ul style={styles.list}>
            {boards.map((board) => (
              <li key={board.id} style={styles.item}>
                <button
                  type="button"
                  onClick={() => handleSelectBoard(board)}
                  style={styles.boardBtn}
                >
                  <span style={styles.boardTitle}>{board.title}</span>
                  <span style={styles.boardDate}>
                    {formatDate(board.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 86400_000)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  btn: {
    padding: '8px 16px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
  },
  main: {
    padding: 24,
    maxWidth: 800,
    margin: '0 auto',
  },
  toolbar: {
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  joinRow: {
    display: 'flex',
    gap: 8,
  },
  joinInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    border: '1px solid #e0e0e0',
    borderRadius: 8,
  },
  joinBtn: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid #16213e',
    borderRadius: 8,
    background: '#fff',
    color: '#16213e',
    cursor: 'pointer',
  },
  joinError: {
    margin: 0,
    fontSize: 13,
    color: '#b91c1c',
  },
  createBtn: {
    padding: '10px 20px',
    fontSize: 15,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    background: '#16213e',
    color: '#fff',
    cursor: 'pointer',
  },
  empty: {
    color: '#999',
    fontSize: 16,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    marginBottom: 8,
  },
  boardBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 16,
  },
  boardTitle: {
    fontWeight: 500,
    color: '#1a1a2e',
  },
  boardDate: {
    fontSize: 13,
    color: '#999',
  },
}
