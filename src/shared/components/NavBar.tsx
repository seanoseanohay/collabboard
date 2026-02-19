import { Link } from 'react-router-dom'

interface NavBarProps {
  showSignIn?: boolean
  onSignInClick?: () => void
  /** When true, show Sign out instead of Log In. */
  isAuthenticated?: boolean
  onSignOut?: () => void
}

export function NavBar({ showSignIn = false, onSignInClick, isAuthenticated = false, onSignOut }: NavBarProps) {
  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.logo} aria-label="MeBoard home">
        <span style={styles.logoIcon}>⚓</span>
        <span style={styles.logoText}>MeBoard</span>
      </Link>
      <div style={styles.links}>
        <Link to="/features" style={styles.link}>Features</Link>
        <Link to="/pricing" style={styles.link}>Pricing</Link>
        {isAuthenticated && onSignOut ? (
          <button onClick={onSignOut} style={styles.signOutBtn}>
            Sign out
          </button>
        ) : showSignIn && onSignInClick ? (
          <button onClick={onSignInClick} style={styles.signInBtn}>
            Log In
          </button>
        ) : null}
      </div>
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    background: 'rgba(22, 33, 62, 0.95)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(212, 160, 23, 0.2)',
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#d4a017',
    letterSpacing: '-0.3px',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  link: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  signInBtn: {
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 600,
    background: 'transparent',
    border: '1px solid #d4a017',
    borderRadius: 6,
    color: '#d4a017',
    cursor: 'pointer',
  },
  signOutBtn: {
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 600,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.9)',
    cursor: 'pointer',
  },
}
