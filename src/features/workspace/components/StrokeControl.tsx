import { useRef, useEffect, useState } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'
import { STROKE_WEIGHT_OPTIONS } from '../lib/strokeUtils'

interface StrokeControlProps {
  strokeWidth: number
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  disabled?: boolean
}

export function StrokeControl({ strokeWidth, canvasRef, disabled }: StrokeControlProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [open])

  return (
    <div style={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={styles.btn}
        title="Border thickness"
        disabled={disabled}
      >
        <span style={styles.label}>Stroke</span>
        <span style={styles.value}>{strokeWidth}px</span>
      </button>
      {open && (
        <div ref={menuRef} style={styles.menu}>
          {STROKE_WEIGHT_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              style={{
                ...styles.item,
                ...(strokeWidth === w ? styles.itemActive : {}),
              }}
              onClick={() => {
                canvasRef.current?.setActiveObjectStrokeWidth(w)
                setOpen(false)
              }}
            >
              {w}px
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  label: {
    color: '#6b7280',
  },
  value: {
    fontWeight: 500,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
    padding: 4,
    minWidth: 72,
    zIndex: 20,
  },
  item: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    fontSize: 13,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemActive: {
    background: '#f1f5f9',
    fontWeight: 500,
  },
}
