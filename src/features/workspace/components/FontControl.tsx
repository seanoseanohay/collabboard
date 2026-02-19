import { useState, useCallback, useEffect } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
] as const

const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 10000

interface FontControlProps {
  fontFamily: string
  fontSize: number
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  disabled?: boolean
}

function clampFontSize(n: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(n)))
}

export function FontControl({ fontFamily, fontSize, canvasRef, disabled }: FontControlProps) {
  const [sizeInput, setSizeInput] = useState(String(fontSize))
  const [sizeFocused, setSizeFocused] = useState(false)
  useEffect(() => {
    if (!sizeFocused) setSizeInput(String(fontSize))
  }, [fontSize, sizeFocused])

  const options = FONT_OPTIONS.includes(fontFamily as (typeof FONT_OPTIONS)[number])
    ? [...FONT_OPTIONS]
    : [fontFamily, ...FONT_OPTIONS]

  const applyFontSize = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10)
      if (!Number.isFinite(n)) {
        setSizeInput(String(fontSize))
        return
      }
      const clamped = clampFontSize(n)
      setSizeInput(String(clamped))
      canvasRef.current?.setActiveObjectFontSize(clamped)
    },
    [fontSize, canvasRef]
  )

  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Font</span>
      <select
        value={fontFamily}
        onChange={(e) => canvasRef.current?.setActiveObjectFontFamily(e.target.value)}
        disabled={disabled}
        style={styles.select}
        title="Font family"
        aria-label="Font family"
      >
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div style={styles.divider} />
      <span style={styles.label}>Size</span>
      <input
        type="number"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        value={sizeFocused ? sizeInput : fontSize}
        onChange={(e) => {
          setSizeInput(e.target.value)
          if (!sizeFocused) setSizeFocused(true)
        }}
        onFocus={() => setSizeFocused(true)}
        onBlur={() => {
          setSizeFocused(false)
          applyFontSize(sizeInput)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        disabled={disabled}
        style={styles.input}
        title={`Font size (${MIN_FONT_SIZE}–${MAX_FONT_SIZE})`}
        aria-label="Font size"
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
  divider: {
    width: 1,
    height: 20,
    background: '#e5e7eb',
  },
  input: {
    width: 52,
    padding: '4px 6px',
    fontSize: 12,
    fontWeight: 500,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    outline: 'none',
  },
  select: {
    minWidth: 120,
    padding: '4px 8px',
    fontSize: 12,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    outline: 'none',
    cursor: 'pointer',
  },
}
