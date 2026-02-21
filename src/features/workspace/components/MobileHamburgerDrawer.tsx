import { useEffect } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'

interface MobileHamburgerDrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

/**
 * Figma-like slide-in drawer for mobile workspace.
 * Slides from left, backdrop dims canvas, tap outside to close.
 */
export function MobileHamburgerDrawer({ open, onClose, children }: MobileHamburgerDrawerProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        aria-hidden
        style={{
          ...styles.backdrop,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-label="Tools and options"
        style={{
          ...styles.drawer,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div style={styles.content}>{children}</div>
      </aside>
    </>
  )
}

const DRAWER_WIDTH = 300

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: Z_INDEX.DRAWER - 1,
    transition: 'opacity 0.2s ease',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    maxWidth: '85vw',
    background: '#fff',
    boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
    zIndex: Z_INDEX.DRAWER,
    transition: 'transform 0.25s ease',
  },
  content: {
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },
}
