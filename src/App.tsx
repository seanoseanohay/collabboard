import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { BoardListPage } from '@/features/boards/components/BoardListPage'
import { BoardPage } from '@/features/boards/components/BoardPage'
import { Routes, Route, Navigate } from 'react-router-dom'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={loadingStyles.container}>
        <span style={loadingStyles.ship}>⚓</span>
        <p style={loadingStyles.text}>Hoisting the sails…</p>
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

const loadingStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #0d1117 0%, #1a1a2e 100%)',
    gap: 12,
  } as React.CSSProperties,
  ship: {
    fontSize: 40,
    animation: 'none',
  } as React.CSSProperties,
  text: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    margin: 0,
    fontStyle: 'italic',
  } as React.CSSProperties,
}
