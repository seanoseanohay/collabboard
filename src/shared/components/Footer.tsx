import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <span style={styles.copy}>© MeBoard – All hands on deck</span>
        <div style={styles.links}>
          <Link to="/terms" style={styles.link}>Terms</Link>
          <Link to="/privacy" style={styles.link}>Privacy</Link>
          <a href="mailto:contact@meboard.dev" style={styles.link}>Contact</a>
        </div>
      </div>
    </footer>
  )
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    background: '#0d1117',
    borderTop: '1px solid rgba(212, 160, 23, 0.15)',
    padding: '24px 32px',
  },
  inner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  copy: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  links: {
    display: 'flex',
    gap: 20,
  },
  link: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textDecoration: 'none',
  },
}
