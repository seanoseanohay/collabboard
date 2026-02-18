import { useState, useCallback } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'
import { clampStrokeWeight, MIN_STROKE_WEIGHT, MAX_STROKE_WEIGHT } from '../lib/strokeUtils'

interface StrokeControlProps {
  strokeWidth: number
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  disabled?: boolean
}

export function StrokeControl({ strokeWidth, canvasRef, disabled }: StrokeControlProps) {
  const [inputValue, setInputValue] = useState(String(strokeWidth))
  const [isFocused, setIsFocused] = useState(false)

  const applyValue = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10)
      if (!Number.isFinite(n)) {
        setInputValue(String(strokeWidth))
        return
      }
      const clamped = clampStrokeWeight(n)
      setInputValue(String(clamped))
      canvasRef.current?.setActiveObjectStrokeWidth(clamped)
    },
    [strokeWidth, canvasRef]
  )

  const handleBlur = () => {
    setIsFocused(false)
    applyValue(inputValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const handleFocus = () => {
    setInputValue(String(strokeWidth))
    setIsFocused(true)
  }

  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Stroke</span>
      <input
        type="number"
        min={MIN_STROKE_WEIGHT}
        max={MAX_STROKE_WEIGHT}
        value={isFocused ? inputValue : strokeWidth}
        onChange={(e) => {
          setInputValue(e.target.value)
          if (!isFocused) setIsFocused(true)
        }}
        onFocus={handleFocus}
        onBlur={() => {
          handleBlur()
          setIsFocused(false)
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={styles.input}
        title={`Border thickness (${MIN_STROKE_WEIGHT}–${MAX_STROKE_WEIGHT}px)`}
        aria-label="Stroke width in pixels"
      />
      <span style={styles.unit}>px</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
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
  },
  label: {
    color: '#6b7280',
  },
  input: {
    width: 44,
    padding: '4px 6px',
    fontSize: 12,
    fontWeight: 500,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    outline: 'none',
  },
  unit: {
    color: '#6b7280',
    fontSize: 11,
  },
}
