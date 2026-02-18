interface NavBarProps {
  showSignIn?: boolean
  onSignInClick?: () => void
}

export function NavBar({ showSignIn = false, onSignInClick }: NavBarProps) {
  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>⚓</span>
        <span style={styles.logoText}>MeBoard</span>
      </div>
      <div style={styles.links}>
        <a href="#features" style={styles.link}>Features</a>
        <a href="#pricing" style={styles.link}>Pricing</a>
        {showSignIn && (
          <button onClick={onSignInClick} style={styles.signInBtn}>
            Log In
          </button>
        )}
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
}
