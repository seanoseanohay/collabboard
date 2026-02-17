import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { WorkspacePage } from '@/features/workspace/components/WorkspacePage'
import { joinBoard } from '@/features/boards/api/boardsApi'
import type { BoardMeta } from '@/features/boards/api/boardsApi'

/**
 * Renders a board by ID from the URL. Joins the board if user is not yet a member
 * (permanent invite: anyone with the link/ID can join).
 */
export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [board, setBoard] = useState<BoardMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }
    if (!boardId || !user) {
      setLoading(false)
      if (!user) return
      if (!boardId) {
        navigate('/', { replace: true })
        return
      }
      return
    }

    let cancelled = false
    setError(null)
    setLoading(true)

    joinBoard(boardId, user.uid)
      .then((meta) => {
        if (!cancelled) {
          setBoard(meta)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to join board')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [boardId, user, authLoading, navigate])

  const handleBack = () => {
    navigate('/')
  }

  if (!boardId) return null
  if (!user) return null

  if (authLoading || loading) {
    return (
      <div style={styles.center}>
        <p>Joining board…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={styles.error}>{error}</p>
        <button type="button" onClick={handleBack} style={styles.btn}>
          Back to boards
        </button>
      </div>
    )
  }

  if (!board) return null

  return (
    <WorkspacePage
      board={board}
      onBack={handleBack}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: '#f5f5f5',
  },
  error: {
    color: '#b91c1c',
    fontSize: 16,
  },
  btn: {
    padding: '10px 20px',
    fontSize: 15,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
  },
}
