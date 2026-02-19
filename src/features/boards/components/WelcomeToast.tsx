/**
 * Welcome animation: brief "Welcome aboard!" toast on first BoardListPage visit per session.
 */
import { useState, useEffect } from 'react'

const SESSION_KEY = 'meboard:welcomed-session'

export function WelcomeToast() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #d4a017 0%, #b8860b 100%)',
        color: '#0d1117',
        fontSize: 16,
        fontWeight: 600,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(212, 160, 23, 0.4)',
        zIndex: 200,
        animation: 'welcomeToastIn 0.4s ease-out',
      }}
    >
      Welcome aboard! 🏴‍☠️
    </div>
  )
}
