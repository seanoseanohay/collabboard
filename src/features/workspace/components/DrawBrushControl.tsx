import { useState, useEffect } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'

const BRUSH_WIDTHS = [1, 2, 4, 8]
const DEFAULT_COLOR = '#1e293b'
const DEFAULT_WIDTH = 2

interface DrawBrushControlProps {
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
}

export function DrawBrushControl({ canvasRef }: DrawBrushControlProps) {
  const [brushColor, setBrushColor] = useState(DEFAULT_COLOR)
  const [brushWidth, setBrushWidth] = useState(DEFAULT_WIDTH)

  // Sync default brush to canvas when Draw tool is first selected
  useEffect(() => {
    canvasRef.current?.setDrawBrushColor?.(brushColor)
    canvasRef.current?.setDrawBrushWidth?.(brushWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Brush</span>
      <input
        type="color"
        value={brushColor}
        onChange={(e) => {
          const v = e.target.value
          setBrushColor(v)
          canvasRef.current?.setDrawBrushColor?.(v)
        }}
        style={styles.swatch}
        title="Brush color"
        aria-label="Brush color"
      />
      <select
        value={brushWidth}
        onChange={(e) => {
          const v = Number(e.target.value)
          setBrushWidth(v)
          canvasRef.current?.setDrawBrushWidth?.(v)
        }}
        style={styles.select}
        title="Brush width"
        aria-label="Brush width"
      >
        {BRUSH_WIDTHS.map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
      </select>
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
  select: {
    padding: '4px 8px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
}
