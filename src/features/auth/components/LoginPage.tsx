import { useRef, useState } from 'react'
import {
  signInWithGithub,
  signInWithEmail,
  signUpWithEmail,
  getAuthErrorMessage,
} from '@/features/auth/api/authApi'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'
import { HeroIllustration } from './HeroIllustration'

const WHY_FEATURES = [
  {
    icon: '🗺️',
    title: 'Infinite Treasure Map',
    desc: 'An endless canvas that grows with yer crew. Pan, zoom, and explore — the seas have no edge.',
  },
  {
    icon: '👥',
    title: 'Real-Time Crew Sync',
    desc: "See yer crew's cursors and changes live. No refresh, no lag — just pure collaborative plunder.",
  },
  {
    icon: '🦜',
    title: 'Fun Tools & Stickers',
    desc: 'Shapes, sticky notes, pirate stickers, and an AI first mate to help build your masterplan.',
  },
]

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleOAuthSignIn = async (fn: () => Promise<void>) => {
    setError(null)
    setLoading(true)
    try {
      await fn()
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? getAuthErrorMessage(err as { code?: string; message?: string })
          : 'Sign-in failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { confirmationRequired } = await signUpWithEmail(email, password)
        if (confirmationRequired) {
          setSuccessMsg('Account created! Check your inbox for a confirmation link before signing in.')
        }
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err: unknown) {
      setError(
        err && typeof err === 'object' && 'message' in err
          ? getAuthErrorMessage(err as { code?: string; message?: string })
          : 'Authentication failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <NavBar showSignIn onSignInClick={scrollToForm} />

      {/* ── Hero ── */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.badge}>🏴‍☠️ Now boarding</div>
          <h1 style={styles.heroTitle}>
            <span style={styles.heroAnchor}>⚓</span> MeBoard
          </h1>
          <p style={styles.heroSub}>
            The collaborative whiteboard where crews plunder brilliant ideas —
            with a treasure map edge to set the adventure.
          </p>
          <button onClick={scrollToForm} className="btn-gold" style={styles.heroBtn}>
            Claim yer canvas →
          </button>
        </div>

        {/* Hero illustration */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <HeroIllustration />
        </div>

        {/* ── Login card ── */}
        <div ref={formRef} style={styles.card}>
          <p style={styles.cardEyebrow}>Enter yer credentials, matey!</p>
          <h2 style={styles.cardTitle}>
            {mode === 'signin' ? 'Welcome back, Captain' : 'Join the Crew'}
          </h2>

          <button
            type="button"
            onClick={() => handleOAuthSignIn(signInWithGithub)}
            disabled={loading}
            className="btn-github"
            style={styles.githubBtn}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={styles.githubIcon} aria-hidden={true}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Join the Crew with GitHub
          </button>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <span style={styles.dividerLine} />
          </div>

          <form onSubmit={handleEmailSubmit} style={styles.form}>
            <input
              type="email"
              placeholder="Email"
              data-testid="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-dark"
              style={styles.submitBtn}
              data-testid="login-submit"
            >
              {loading
                ? 'Hoisting the sails…'
                : mode === 'signin'
                  ? 'Enter the Ship'
                  : 'Sign Up Free'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
              setError(null)
              setSuccessMsg(null)
            }}
            style={styles.toggle}
          >
            {mode === 'signin'
              ? 'New to the crew? Sign up free ⚓'
              : 'Already sailing with us? Sign in'}
          </button>

          {error && <p style={styles.error}>{error}</p>}
          {successMsg && <p style={styles.success}>{successMsg}</p>}
        </div>
      </section>

      {/* ── Why MeBoard ── */}
      <section id="features" style={styles.features}>
        <h2 style={styles.featuresTitle}>Why MeBoard?</h2>
        <p style={styles.featuresSub}>
          Built for crews who think big and move fast.
        </p>
        <div style={styles.featureGrid}>
          {WHY_FEATURES.map((f) => (
            <div key={f.title} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureCardTitle}>{f.title}</h3>
              <p style={styles.featureCardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <blockquote style={styles.testimonial}>
          <p style={styles.testimonialText}>
            "Best board since the Black Pearl! Our remote crew ships ideas 10x faster."
          </p>
          <cite style={styles.testimonialCite}>— Remote Crew Captain</cite>
        </blockquote>

        {/* CTA */}
        <button onClick={scrollToForm} className="btn-gold" style={styles.ctaBtn}>
          Sign up free — claim yer treasure map canvas today 🗺️
        </button>
      </section>

      <Footer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0d1117 0%, #1a1a2e 50%, #16213e 100%)',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  /* Hero */
  hero: {
    minHeight: '100vh',
    paddingTop: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 64,
    padding: '80px 32px 64px',
    flexWrap: 'wrap',
  },
  heroContent: {
    flex: '1 1 360px',
    maxWidth: 480,
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: 'rgba(212, 160, 23, 0.15)',
    border: '1px solid rgba(212, 160, 23, 0.35)',
    borderRadius: 20,
    fontSize: 13,
    color: '#d4a017',
    marginBottom: 20,
    letterSpacing: '0.3px',
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 800,
    margin: '0 0 16px',
    lineHeight: 1.1,
    color: '#fff',
    letterSpacing: '-1px',
  },
  heroAnchor: {
    display: 'inline-block',
    marginRight: 8,
  },
  heroSub: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.6,
    margin: '0 0 32px',
  },
  heroBtn: {
    padding: '14px 28px',
    fontSize: 16,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },

  /* Card */
  card: {
    flex: '0 0 360px',
    background: '#fdf6e3',
    borderRadius: 16,
    padding: '32px 28px',
    border: '1.5px solid #c9a84c',
    boxShadow: '0 12px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,160,23,0.1)',
    color: '#2c1a00',
  },
  cardEyebrow: {
    margin: '0 0 6px',
    fontSize: 12,
    color: '#8b6914',
    fontStyle: 'italic',
    letterSpacing: '0.3px',
  },
  cardTitle: {
    margin: '0 0 20px',
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  githubBtn: {
    width: '100%',
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 700,
    border: '1.5px solid #444c56',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    letterSpacing: '0.15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    marginBottom: 4,
  },
  githubIcon: {
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  divider: {
    margin: '18px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#d4b87a',
    display: 'block',
  },
  dividerText: {
    fontSize: 12,
    color: '#8b6914',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  input: {
    padding: '11px 14px',
    fontSize: 15,
    border: '1.5px solid #c9a84c',
    borderRadius: 8,
    background: '#fffdf5',
    color: '#1a1a2e',
    outline: 'none',
  },
  submitBtn: {
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  toggle: {
    marginTop: 16,
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: '#8b6914',
    cursor: 'pointer',
    textDecoration: 'underline',
    width: '100%',
    textAlign: 'center',
  },
  error: {
    marginTop: 14,
    padding: '10px 12px',
    background: '#fee',
    color: '#c00',
    borderRadius: 8,
    fontSize: 13,
    border: '1px solid #fcc',
  },
  success: {
    marginTop: 14,
    padding: '10px 12px',
    background: '#efffef',
    color: '#1a7f37',
    borderRadius: 8,
    fontSize: 13,
    border: '1px solid #aaddaa',
    lineHeight: 1.5,
  },

  /* Features */
  features: {
    padding: '80px 32px',
    textAlign: 'center',
    borderTop: '1px solid rgba(212,160,23,0.1)',
  },
  featuresTitle: {
    fontSize: 36,
    fontWeight: 800,
    margin: '0 0 12px',
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  featuresSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 48px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 24,
    maxWidth: 900,
    margin: '0 auto 56px',
  },
  featureCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212,160,23,0.15)',
    borderRadius: 12,
    padding: '28px 24px',
    textAlign: 'left',
  },
  featureIcon: {
    fontSize: 36,
    marginBottom: 16,
  },
  featureCardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#d4a017',
    margin: '0 0 10px',
  },
  featureCardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    margin: 0,
  },

  /* Testimonial */
  testimonial: {
    maxWidth: 560,
    margin: '0 auto 40px',
    padding: '24px 32px',
    background: 'rgba(212,160,23,0.06)',
    border: '1px solid rgba(212,160,23,0.2)',
    borderRadius: 12,
    textAlign: 'center',
  },
  testimonialText: {
    fontSize: 18,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.8)',
    margin: '0 0 12px',
    lineHeight: 1.6,
  },
  testimonialCite: {
    fontSize: 13,
    color: '#d4a017',
    fontStyle: 'normal',
  },

  /* CTA */
  ctaBtn: {
    padding: '16px 36px',
    fontSize: 16,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
}
