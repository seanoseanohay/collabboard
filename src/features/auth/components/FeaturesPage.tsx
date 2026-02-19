import { Link } from 'react-router-dom'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { signOutUser } from '@/features/auth/api/authApi'

export function FeaturesPage() {
  const { user } = useAuth()
  return (
    <div style={styles.container}>
      <NavBar isAuthenticated={!!user} onSignOut={() => signOutUser()} />
      <main style={styles.main}>
        <h1 style={styles.title}>Features</h1>
        <p style={styles.sub}>
          Real-time collaboration • Infinite canvas • Pirate Plunder stickers • AI first mate • And more!
        </p>
        <Link to="/" style={styles.link}>
          ← Back to boards
        </Link>
      </main>
      <Footer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #0d1117 0%, #1a1a2e 100%)',
    paddingTop: 56,
  },
  main: {
    flex: 1,
    maxWidth: 720,
    margin: '0 auto',
    padding: 48,
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    color: '#d4a017',
  },
  sub: {
    margin: '16px 0 24px',
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
  },
  link: {
    color: '#d4a017',
    fontSize: 14,
    textDecoration: 'none',
  },
}
