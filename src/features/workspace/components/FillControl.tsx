import { useState, useEffect } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'

interface FillControlProps {
  fill: string
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  disabled?: boolean
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)
}

export function FillControl({ fill, canvasRef, disabled }: FillControlProps) {
  const [hex, setHex] = useState(fill)
  useEffect(() => {
    setHex(fill)
  }, [fill])

  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Fill</span>
      <input
        type="color"
        value={fill}
        onChange={(e) => canvasRef.current?.setActiveObjectFill(e.target.value)}
        disabled={disabled}
        style={styles.swatch}
        title="Fill color"
        aria-label="Fill color"
      />
      <input
        type="text"
        value={hex}
        onChange={(e) => {
          const v = e.target.value
          setHex(v)
          if (isValidHex(v)) canvasRef.current?.setActiveObjectFill(v)
        }}
        onBlur={() => {
          if (isValidHex(hex)) canvasRef.current?.setActiveObjectFill(hex)
          else setHex(fill)
        }}
        style={styles.hex}
        title="Hex color"
        aria-label="Fill color hex"
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
  },
  label: {
    color: '#6b7280',
  },
  swatch: {
    width: 24,
    height: 24,
    padding: 0,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'transparent',
  },
  hex: {
    width: 58,
    padding: '4px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    outline: 'none',
  },
}
