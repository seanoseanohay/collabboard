import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { BoardListPage } from '@/features/boards/components/BoardListPage'
import { BoardPage } from '@/features/boards/components/BoardPage'
import { Routes, Route, Navigate } from 'react-router-dom'

function App() {
  const { user, loading } = useAuth()

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

  return (
    <Routes>
      <Route path="/" element={<BoardListPage />} />
      <Route path="/board/:boardId" element={<BoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
