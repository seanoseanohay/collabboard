import { useState } from 'react'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  getAuthErrorMessage,
} from '@/features/auth/api/authApi'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'code' in err
          ? getAuthErrorMessage(err as { code: string; message?: string })
          : 'Sign-in failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'code' in err
          ? getAuthErrorMessage(err as { code: string; message?: string })
          : 'Authentication failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CollabBoard</h1>
        <p style={styles.subtitle}>Sign in to continue</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={styles.googleBtn}
        >
          Continue with Google
        </button>

        <div style={styles.divider}>or</div>

        <form onSubmit={handleEmailSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
            setError(null)
          }}
          style={styles.toggle}
        >
          {mode === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  card: {
    background: '#fff',
    padding: 32,
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: 360,
  },
  title: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  subtitle: {
    margin: '0 0 24px',
    fontSize: 14,
    color: '#666',
  },
  googleBtn: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    fontWeight: 500,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
  },
  divider: {
    margin: '20px 0',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: 12,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  input: {
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #ddd',
    borderRadius: 8,
  },
  submitBtn: {
    padding: '12px 16px',
    fontSize: 16,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    background: '#16213e',
    color: '#fff',
    cursor: 'pointer',
  },
  toggle: {
    marginTop: 16,
    background: 'none',
    border: 'none',
    fontSize: 14,
    color: '#16213e',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  error: {
    marginTop: 16,
    padding: 12,
    background: '#fee',
    color: '#c00',
    borderRadius: 8,
    fontSize: 14,
  },
}
