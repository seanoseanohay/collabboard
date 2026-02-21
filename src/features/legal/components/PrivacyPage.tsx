import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { signOutUser } from '@/features/auth/api/authApi'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'

export function PrivacyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSignInClick = () => {
    navigate('/')
  }

  const handleSignOut = async () => {
    await signOutUser()
  }

  return (
    <div style={styles.page}>
      <NavBar
        showSignIn={!user}
        onSignInClick={handleSignInClick}
        isAuthenticated={!!user}
        onSignOut={handleSignOut}
      />
      <main style={styles.main}>
        <div style={styles.content}>
          <h1 style={styles.h1}>Privacy Policy</h1>
          <p style={styles.updated}>Last updated: February 2026</p>

          <section style={styles.section}>
            <h2 style={styles.h2}>1. Information We Collect</h2>
            <p style={styles.p}>
              When you use MeBoard, we collect your email address and authentication data from your sign-in provider
              (e.g., Google). We also store the boards you create, their content, and collaboration data (e.g.,
              cursor positions and presence) to provide real-time sync.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>2. How We Use Your Information</h2>
            <p style={styles.p}>
              We use your data to operate the Service: to authenticate you, store and sync your boards, show
              presence (cursors and names) to collaborators, and improve reliability and performance. We do not
              sell your personal information.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>3. Data Sharing</h2>
            <p style={styles.p}>
              Board content is visible to people you invite or share with. We rely on third-party services (e.g.,
              Supabase) to host the Service; their privacy practices apply to data they process on our behalf.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>4. Data Retention</h2>
            <p style={styles.p}>
              We retain your account and board data for as long as your account is active. If you delete your
              account or boards, we will remove the associated data in accordance with our retention practices.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>5. Security</h2>
            <p style={styles.p}>
              We use industry-standard measures to protect your data, including encryption in transit and at rest.
              You are responsible for keeping your credentials secure.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>6. Your Rights</h2>
            <p style={styles.p}>
              Depending on your location, you may have rights to access, correct, or delete your personal data.
              Contact us at contact@meboard.dev to exercise these rights or with questions.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>7. Contact</h2>
            <p style={styles.p}>
              For privacy inquiries, email us at{' '}
              <a href="mailto:contact@meboard.dev" style={styles.a}>contact@meboard.dev</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #0d1117 0%, #1a1a2e 100%)',
  },
  main: {
    flex: 1,
    paddingTop: 72,
    paddingBottom: 48,
    paddingLeft: 24,
    paddingRight: 24,
  },
  content: {
    maxWidth: 720,
    margin: '0 auto',
  },
  h1: {
    fontSize: 32,
    fontWeight: 700,
    color: '#d4a017',
    marginBottom: 8,
  },
  updated: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  h2: {
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  p: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.65,
    margin: 0,
  },
  a: {
    color: '#d4a017',
    textDecoration: 'none',
  },
}
