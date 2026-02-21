import { useState, useEffect, useCallback } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'

export type BrushType = 'pencil' | 'circle' | 'spray' | 'pattern'

export const BRUSH_MIN = 1
export const BRUSH_MAX = 512

const DEFAULT_COLOR = '#1e293b'
const DEFAULT_WIDTH = 2
const DEFAULT_OPACITY = 100

function brushToSlider(w: number): number {
  return (
    (Math.log(Math.max(BRUSH_MIN, w)) - Math.log(BRUSH_MIN)) /
    (Math.log(BRUSH_MAX) - Math.log(BRUSH_MIN))
  )
}

function sliderToBrush(v: number): number {
  return Math.round(
    Math.exp(
      Math.log(BRUSH_MIN) + v * (Math.log(BRUSH_MAX) - Math.log(BRUSH_MIN))
    )
  )
}

/* ── SVG Icons ── */

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  )
}

function SprayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="4" r="1" />
      <circle cx="8" cy="3" r="1.2" />
      <circle cx="12" cy="5" r="0.8" />
      <circle cx="6" cy="7" r="1" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="3" cy="10" r="0.9" />
      <circle cx="8" cy="11" r="1.1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="5" cy="13" r="0.8" />
    </svg>
  )
}

function PatternIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 8h12M8 2v12M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 14h8M3.5 10.5l6-6 3 3-6 6-3.5.5.5-3.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Component ── */

interface DrawBrushControlProps {
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
}

export function DrawBrushControl({ canvasRef }: DrawBrushControlProps) {
  const [brushType, setBrushType] = useState<BrushType>('pencil')
  const [brushWidth, setBrushWidth] = useState(DEFAULT_WIDTH)
  const [brushColor, setBrushColor] = useState(DEFAULT_COLOR)
  const [brushOpacity, setBrushOpacity] = useState(DEFAULT_OPACITY)
  const [eraserActive, setEraserActive] = useState(false)

  const syncToCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.setDrawBrushColor?.(brushColor)
    c.setDrawBrushWidth?.(brushWidth)
    c.setDrawBrushType?.(brushType)
    c.setDrawBrushOpacity?.(brushOpacity / 100)
    c.setDrawEraserMode?.(eraserActive)
  }, [canvasRef, brushColor, brushWidth, brushType, brushOpacity, eraserActive])

  useEffect(() => {
    syncToCanvas()
  }, [syncToCanvas])

  const brushTypes: { type: BrushType; icon: React.ReactNode; title: string }[] = [
    { type: 'pencil', icon: <PencilIcon />, title: 'Pencil' },
    { type: 'circle', icon: <CircleIcon />, title: 'Circle' },
    { type: 'spray', icon: <SprayIcon />, title: 'Spray' },
    { type: 'pattern', icon: <PatternIcon />, title: 'Pattern' },
  ]

  return (
    <div style={styles.wrap}>
      {/* Brush type buttons */}
      <div style={styles.group}>
        {brushTypes.map(({ type, icon, title }) => (
          <button
            key={type}
            title={title}
            aria-label={title}
            aria-pressed={!eraserActive && brushType === type}
            onClick={() => {
              setBrushType(type)
              setEraserActive(false)
            }}
            style={{
              ...styles.iconBtn,
              ...(!eraserActive && brushType === type ? styles.iconBtnActive : {}),
            }}
          >
            {icon}
          </button>
        ))}

        <div style={styles.divider} />

        <button
          title="Eraser"
          aria-label="Eraser"
          aria-pressed={eraserActive}
          onClick={() => setEraserActive((prev) => !prev)}
          style={{
            ...styles.iconBtn,
            ...(eraserActive ? styles.iconBtnActive : {}),
          }}
        >
          <EraserIcon />
        </button>
      </div>

      <div style={styles.divider} />

      {/* Size slider */}
      <div style={styles.group}>
        <span style={styles.label}>Size</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={brushToSlider(brushWidth)}
          onChange={(e) => {
            const w = sliderToBrush(Number(e.target.value))
            setBrushWidth(w)
          }}
          style={styles.slider}
          title="Brush size"
          aria-label="Brush size"
        />
        <span style={styles.value}>{brushWidth}px</span>
      </div>

      <div style={styles.divider} />

      {/* Opacity slider */}
      <div style={styles.group}>
        <span style={styles.label}>Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={brushOpacity}
          onChange={(e) => setBrushOpacity(Number(e.target.value))}
          style={styles.slider}
          title="Brush opacity"
          aria-label="Brush opacity"
        />
        <span style={styles.value}>{brushOpacity}%</span>
      </div>

      <div style={styles.divider} />

      {/* Color picker */}
      <div style={styles.group}>
        <span style={styles.label}>Color</span>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          style={styles.swatch}
          title="Brush color"
          aria-label="Brush color"
        />
      </div>
    </div>
  )
}

/* ── Styles ── */

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 20,
    background: '#e5e7eb',
    flexShrink: 0,
  },
  label: {
    color: '#6b7280',
    fontSize: 11,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  value: {
    color: '#6b7280',
    fontSize: 11,
    minWidth: 36,
    textAlign: 'right' as const,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.1s, color 0.1s',
  },
  iconBtnActive: {
    background: '#eef2ff',
    color: '#4f46e5',
    border: '1px solid #c7d2fe',
  },
  slider: {
    width: 80,
    height: 4,
    cursor: 'pointer',
    accentColor: '#4f46e5',
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
}
