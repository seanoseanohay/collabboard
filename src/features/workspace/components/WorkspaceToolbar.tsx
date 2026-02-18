import { useEffect, useRef, useState } from 'react'
import type { ToolType } from '../types/tools'
import type { FabricCanvasZoomHandle } from './FabricCanvas'
import type { SelectionStrokeInfo } from './FabricCanvas'
import { StrokeControl } from './StrokeControl'
import { FillControl } from './FillControl'
import { StrokeColorControl } from './StrokeColorControl'

interface WorkspaceToolbarProps {
  selectedTool: ToolType
  onToolChange: (tool: ToolType) => void
  zoom?: number
  onZoomToFit?: () => void
  onZoomSet?: (zoom: number) => void
  selectionStroke?: SelectionStrokeInfo | null
  canvasRef?: React.RefObject<FabricCanvasZoomHandle | null>
}

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'hand', label: 'Hand' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'line', label: 'Line' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky note' },
]

const ZOOM_PRESETS = [0.00001, 0.001, 0.01, 0.25, 0.5, 1, 2, 4, 10, 100]
const ZOOM_SLIDER_MIN = 0.00001  // 0.001%
const ZOOM_SLIDER_MAX = 100      // 10000%

function zoomToLabel(z: number): string {
  const pct = z * 100
  if (pct >= 100) return `${Math.round(pct)}%`
  if (pct >= 10)  return `${Math.round(pct)}%`
  if (pct >= 1)   return `${pct.toFixed(1)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

/** Map zoom (full range) to slider value (0–100) using log scale */
function zoomToSliderValue(zoom: number): number {
  const clamped = Math.min(ZOOM_SLIDER_MAX, Math.max(ZOOM_SLIDER_MIN, zoom))
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return 100 * ((Math.log(clamped) - logMin) / (logMax - logMin))
}

/** Map slider value (0–100) to zoom */
function sliderValueToZoom(value: number): number {
  const t = value / 100
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return Math.exp(logMin + t * (logMax - logMin))
}

const ToolIcons: Record<ToolType, React.ReactNode> = {
  select: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l6 12 3-6 5 0" />
    </svg>
  ),
  hand: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    </svg>
  ),
  rect: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  circle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  triangle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  ),
  line: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  ),
  text: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  ),
  sticky: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
}

export function WorkspaceToolbar({
  selectedTool,
  onToolChange,
  zoom = 1,
  onZoomToFit,
  onZoomSet,
  selectionStroke,
  canvasRef,
}: WorkspaceToolbarProps) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const zoomButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!zoomOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || zoomButtonRef.current?.contains(target)) return
      setZoomOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [zoomOpen])

  const toolGroups: ToolType[][] = [
    ['select', 'hand'],
    ['rect', 'circle', 'triangle', 'line'],
    ['text', 'sticky'],
  ]

  return (
    <div style={styles.container}>
      <div style={styles.toolGroups}>
        {toolGroups.map((group, i) => (
          <div key={i} style={styles.toolGroup}>
            {group.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onToolChange(id)}
                style={{
                  ...styles.toolBtn,
                  ...(selectedTool === id ? styles.toolBtnActive : {}),
                }}
                title={TOOLS.find((t) => t.id === id)?.label ?? id}
              >
                {ToolIcons[id]}
              </button>
            ))}
            {i < toolGroups.length - 1 && <div style={styles.divider} />}
          </div>
        ))}
      </div>

      <div style={styles.right}>
        {selectionStroke != null && canvasRef && (
          <>
            {selectionStroke.strokeWidth > 0 && (
              <>
                <StrokeControl
                  strokeWidth={selectionStroke.strokeWidth}
                  canvasRef={canvasRef}
                />
                {selectionStroke.strokeColor != null && (
                  <StrokeColorControl
                    strokeColor={selectionStroke.strokeColor}
                    canvasRef={canvasRef}
                  />
                )}
              </>
            )}
            {selectionStroke.fill != null && (
              <FillControl
                fill={selectionStroke.fill}
                canvasRef={canvasRef}
              />
            )}
            <div style={styles.layerGroup}>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.bringToFront()}
                title="Bring to front"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6M4 10h10v4M4 6h14v4M4 4h18v2" />
                </svg>
              </button>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.bringForward()}
                title="Bring forward"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.sendBackward()}
                title="Send backward"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.sendToBack()}
                title="Send to back"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10H10v10M20 6H6v4M20 4H4v2" />
                </svg>
              </button>
            </div>
          </>
        )}
        <div style={styles.zoomControls}>
          <input
            type="range"
            min={0}
            max={100}
            value={zoomToSliderValue(zoom)}
            onChange={(e) => onZoomSet?.(sliderValueToZoom(Number(e.target.value)))}
            style={styles.zoomSlider}
            title="Zoom"
            aria-label="Zoom level"
          />
          <div style={styles.zoomWrap}>
          <button
            ref={zoomButtonRef}
            type="button"
            style={styles.zoomBtn}
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
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '6px 12px',
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  toolGroups: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  toolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer',
  },
  toolBtnActive: {
    background: '#f1f5f9',
    color: '#1e293b',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
  },
  layerGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  layerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer',
  },
  divider: {
    width: 1,
    height: 20,
    background: '#e5e7eb',
    margin: '0 4px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  zoomSlider: {
    width: 80,
    height: 6,
    accentColor: '#6366f1',
  },
  zoomWrap: {
    position: 'relative',
  },
  zoomBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    flexShrink: 0,
    height: 32,
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'ui-monospace, monospace',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  zoomMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
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
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
}
