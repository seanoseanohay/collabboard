import { useState } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { BoardListPage } from '@/features/boards/components/BoardListPage'
import { WorkspacePage } from '@/features/workspace/components/WorkspacePage'
import type { BoardMeta } from '@/features/boards/api/boardsApi'

function App() {
  const { user, loading } = useAuth()
  const [selectedBoard, setSelectedBoard] = useState<BoardMeta | null>(null)

  if (loading) {
    return (
      <div style={loadingStyles}>
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (selectedBoard) {
    return (
      <WorkspacePage
        board={selectedBoard}
        onBack={() => setSelectedBoard(null)}
      />
    )
  }

  return (
    <BoardListPage
      userId={user.uid}
      userEmail={user.email ?? 'Signed in'}
      onSelectBoard={setSelectedBoard}
    />
  )
}

export default App

const loadingStyles: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1a1a2e',
  color: '#fff',
  fontSize: 18,
}
