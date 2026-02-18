import { useEffect, useRef, useState } from 'react'
import type { ToolType } from '../types/tools'

interface WorkspaceToolbarProps {
  selectedTool: ToolType
  onToolChange: (tool: ToolType) => void
  zoom?: number
  onZoomToFit?: () => void
  onZoomSet?: (zoom: number) => void
}

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'hand', label: 'Hand' },
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'line', label: 'Line' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky' },
]

const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4]

function zoomToLabel(z: number): string {
  if (z >= 1) return `${Math.round(z * 100)}%`
  return `${Math.round(z * 100)}%`
}

export function WorkspaceToolbar({
  selectedTool,
  onToolChange,
  zoom = 1,
  onZoomToFit,
  onZoomSet,
}: WorkspaceToolbarProps) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!zoomOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setZoomOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [zoomOpen])

  return (
    <div style={styles.container}>
      {TOOLS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onToolChange(id)}
          style={{
            ...styles.btn,
            ...(selectedTool === id ? styles.btnActive : {}),
          }}
          title={label}
        >
          {label}
        </button>
      ))}
      <div style={styles.zoomWrap}>
        <button
          ref={buttonRef}
          type="button"
          style={styles.btn}
          onClick={() => setZoomOpen((o) => !o)}
          title="Zoom"
        >
          {zoomToLabel(zoom)}
        </button>
        {zoomOpen && (
          <div ref={menuRef} style={styles.zoomMenu}>
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                type="button"
                style={styles.zoomItem}
                onClick={() => {
                  onZoomSet?.(z)
                  setZoomOpen(false)
                }}
              >
                {zoomToLabel(z)}
              </button>
            ))}
            {onZoomToFit && (
              <button
                type="button"
                style={styles.zoomItem}
                onClick={() => {
                  onZoomToFit()
                  setZoomOpen(false)
                }}
              >
                Fit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
  },
  btn: {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    color: '#333',
    cursor: 'pointer',
  },
  btnActive: {
    background: '#1a1a2e',
    color: '#fff',
    borderColor: '#1a1a2e',
  },
  zoomWrap: {
    marginLeft: 'auto',
    position: 'relative',
  },
  zoomMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    padding: 4,
    minWidth: 80,
    zIndex: 10,
  },
  zoomItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    fontSize: 13,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
}
