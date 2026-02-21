import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { signOutUser } from '@/features/auth/api/authApi'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'

export function TermsPage() {
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
          <h1 style={styles.h1}>Terms of Service</h1>
          <p style={styles.updated}>Last updated: February 2026</p>

          <section style={styles.section}>
            <h2 style={styles.h2}>1. Agreement</h2>
            <p style={styles.p}>
              By accessing or using MeBoard (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>2. Use of the Service</h2>
            <p style={styles.p}>
              MeBoard provides a collaborative whiteboard where you can create boards, invite others, and work together
              in real time. You agree to use the Service only for lawful purposes and in accordance with these terms.
              You may not use the Service to share content that infringes others&apos; rights, is illegal, or is
              otherwise harmful.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>3. Account Responsibility</h2>
            <p style={styles.p}>
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activity under your account. Notify us promptly at contact@meboard.dev if you become aware of any
              unauthorized use.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>4. Intellectual Property</h2>
            <p style={styles.p}>
              You retain ownership of content you create on the Service. By using the Service, you grant us a
              limited license to store, process, and display your content solely to provide the Service. We do not
              claim ownership of your content.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>5. Service Availability</h2>
            <p style={styles.p}>
              We strive to keep the Service available but do not guarantee uninterrupted access. We may modify,
              suspend, or discontinue features with reasonable notice when possible.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>6. Limitation of Liability</h2>
            <p style={styles.p}>
              The Service is provided &quot;as is.&quot; To the extent permitted by law, we are not liable for any
              indirect, incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>7. Contact</h2>
            <p style={styles.p}>
              Questions about these terms? Reach us at{' '}
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
