/**
 * Floating menu shown when a connector is dropped on empty canvas space.
 * Lets the user pick a shape type to create at the drop point and auto-connect to it.
 */

import { useEffect, useRef } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'

export type ConnectorDropShapeType = 'rect' | 'circle' | 'triangle' | 'text' | 'sticky'

export interface ConnectorDropMenuProps {
  /** Screen coordinates (px) for the top-left of the menu */
  screenX: number
  screenY: number
  onSelect: (shapeType: ConnectorDropShapeType) => void
  onCancel: () => void
}

const SHAPES: { type: ConnectorDropShapeType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'rect',
    label: 'Rectangle',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    type: 'circle',
    label: 'Circle',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    type: 'triangle',
    label: 'Triangle',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
  },
  {
    type: 'sticky',
    label: 'Sticky',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    ),
  },
]

export function ConnectorDropMenu({ screenX, screenY, onSelect, onCancel }: ConnectorDropMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onCancel()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [onCancel])

  return (
    <div ref={ref} style={{ ...styles.menu, left: screenX, top: screenY }}>
      <div style={styles.header}>Connect to…</div>
      <div style={styles.grid}>
        {SHAPES.map((s) => (
          <button
            key={s.type}
            type="button"
            style={styles.item}
            onClick={() => onSelect(s.type)}
            title={s.label}
          >
            <span style={styles.icon}>{s.icon}</span>
            <span style={styles.label}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'absolute',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
    padding: '8px 10px',
    zIndex: Z_INDEX.TOOLBAR_OVERLAY,
    minWidth: 180,
    pointerEvents: 'all',
  },
  header: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
    paddingLeft: 2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '7px 4px',
    border: '1px solid transparent',
    borderRadius: 7,
    background: 'transparent',
    cursor: 'pointer',
    color: '#374151',
    transition: 'background 0.1s',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.2,
  },
}
