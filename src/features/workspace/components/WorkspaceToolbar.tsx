import { useEffect, useRef, useState } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'
import type { ToolType } from '../types/tools'
import type { FabricCanvasZoomHandle } from './FabricCanvas'
import type { SelectionStrokeInfo } from './FabricCanvas'
import { StrokeControl } from './StrokeControl'
import { FillControl } from './FillControl'
import { StrokeColorControl } from './StrokeColorControl'
import { FontControl } from './FontControl'
import { DrawBrushControl } from './DrawBrushControl'
import { STICKER_DEFS, STICKER_KINDS, type StickerKind } from '../lib/pirateStickerFactory'
import type { ArrowMode, StrokeDash } from '../lib/connectorFactory'

interface WorkspaceToolbarProps {
  selectedTool: ToolType
  onToolChange: (tool: ToolType) => void
  selectedStickerKind?: StickerKind
  onStickerKindChange?: (kind: StickerKind) => void
  zoom?: number
  onZoomToFit?: () => void
  onResetView?: () => void
  onZoomSet?: (zoom: number) => void
  selectionStroke?: SelectionStrokeInfo | null
  canvasRef?: React.RefObject<FabricCanvasZoomHandle | null>
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  showMapBorder?: boolean
  onToggleMapBorder?: () => void
}

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'hand', label: 'Hand' },
  { id: 'lasso', label: 'Lasso' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'line', label: 'Line' },
  { id: 'draw', label: 'Draw' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky note' },
  { id: 'frame', label: 'Frame' },
]

const ZOOM_PRESETS = [0.00001, 0.001, 0.01, 0.25, 0.5, 1, 2, 4, 10, 100]
const ZOOM_SLIDER_MIN = 0.00001  // 0.001%
const ZOOM_SLIDER_MAX = 10       // 1000% — must match MAX_ZOOM in fabricCanvasZoom.ts

function zoomToLabel(z: number): string {
  const pct = z * 100
  if (pct >= 100) return `${Math.round(pct)}%`
  if (pct >= 10)  return `${Math.round(pct)}%`
  if (pct >= 1)   return `${pct.toFixed(1)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

function zoomToSliderValue(zoom: number): number {
  const clamped = Math.min(ZOOM_SLIDER_MAX, Math.max(ZOOM_SLIDER_MIN, zoom))
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return 100 * ((Math.log(clamped) - logMin) / (logMax - logMin))
}

function sliderValueToZoom(value: number): number {
  const t = value / 100
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return Math.exp(logMin + t * (logMax - logMin))
}

const ToolIcons: Record<ToolType, React.ReactNode> = {
  select: (
    // Classic arrow cursor: tip upper-left, diagonal body, tail with notch
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2L4 17L9 13L12 21L13.5 20L10.5 12H16L4 2Z" />
    </svg>
  ),
  hand: (
    // Open hand: four finger stems + rounded palm base
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M6 14v2a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0" />
    </svg>
  ),
  lasso: (
    // Dashed loop (the selection area) + short rope tail
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12C5 7.6 8.1 4 12 4s7 3.6 7 8-3.1 8-7 8c-2 0-3.9-.9-5.2-2.4" strokeDasharray="2.5 2" />
      <path d="M6.8 17.6C5.9 19.2 5.2 20.6 5 22" />
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
  frame: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="2" y1="7" x2="22" y2="7" />
    </svg>
  ),
  table: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  ),
  sticker: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3C7 3 3 7 3 12s4 9 9 9h6a3 3 0 0 0 3-3v-6c0-5-4-9-9-9z" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  draw: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    </svg>
  ),
  button: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="3" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
  'input-field': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <line x1="6" y1="12" x2="8" y2="12" />
    </svg>
  ),
}

const INSERT_TOOLS: ToolType[] = ['rect', 'circle', 'triangle', 'line', 'draw', 'text', 'sticky', 'frame']

export function WorkspaceToolbar({
  selectedTool,
  onToolChange,
  selectedStickerKind = 'anchor',
  onStickerKindChange,
  zoom = 1,
  onZoomToFit,
  onResetView,
  onZoomSet,
  selectionStroke,
  canvasRef,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  showMapBorder = true,
  onToggleMapBorder,
}: WorkspaceToolbarProps) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const zoomButtonRef = useRef<HTMLButtonElement>(null)
  const insertRef = useRef<HTMLDivElement>(null)
  const insertBtnRef = useRef<HTMLButtonElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)
  const layersBtnRef = useRef<HTMLButtonElement>(null)

  const showStrokeControls =
    selectionStroke != null &&
    !selectionStroke.isTextOnly &&
    !selectionStroke.isStickyNote &&
    selectionStroke.strokeWidth > 0

  useEffect(() => {
    if (!zoomOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || zoomButtonRef.current?.contains(e.target as Node)) return
      setZoomOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [zoomOpen])

  useEffect(() => {
    if (!insertOpen) return
    const close = (e: MouseEvent) => {
      if (insertRef.current?.contains(e.target as Node) || insertBtnRef.current?.contains(e.target as Node)) return
      setInsertOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [insertOpen])

  useEffect(() => {
    if (!layersOpen) return
    const close = (e: MouseEvent) => {
      if (layersRef.current?.contains(e.target as Node) || layersBtnRef.current?.contains(e.target as Node)) return
      setLayersOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [layersOpen])

  const selectAndClose = (tool: ToolType, stickerKind?: StickerKind) => {
    onToolChange(tool)
    if (stickerKind) onStickerKindChange?.(stickerKind)
    setInsertOpen(false)
  }

  const insertTitle =
    selectedTool === 'sticker'
      ? STICKER_DEFS[selectedStickerKind].label
      : INSERT_TOOLS.includes(selectedTool)
        ? TOOLS.find((t) => t.id === selectedTool)?.label ?? 'Insert'
        : 'Insert'
  const insertIcon =
    selectedTool === 'sticker'
      ? STICKER_DEFS[selectedStickerKind].icon
      : INSERT_TOOLS.includes(selectedTool)
        ? ToolIcons[selectedTool]
        : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )

  return (
    <div style={styles.wrapper}>
      {/* Main toolbar row */}
      <div style={styles.mainRow}>
        <div style={styles.toolGroups}>
          <div style={styles.toolGroup}>
            <button
              type="button"
              onClick={() => onToolChange('select')}
              style={{ ...styles.toolBtn, ...(selectedTool === 'select' ? styles.toolBtnActive : {}) }}
              title="Select"
            >
              {ToolIcons.select}
            </button>
            <button
              type="button"
              onClick={() => onToolChange('hand')}
              style={{ ...styles.toolBtn, ...(selectedTool === 'hand' ? styles.toolBtnActive : {}) }}
              title="Hand"
            >
              {ToolIcons.hand}
            </button>
            <button
              type="button"
              onClick={() => onToolChange('lasso')}
              style={{ ...styles.toolBtn, ...(selectedTool === 'lasso' ? styles.toolBtnActive : {}) }}
              title="Lasso — draw freeform selection"
            >
              {ToolIcons.lasso}
            </button>
          </div>
          <div style={styles.divider} />
          <div style={{ position: 'relative' }}>
            <button
              ref={insertBtnRef}
              type="button"
              style={{
                ...styles.toolBtn,
                ...(INSERT_TOOLS.includes(selectedTool) || selectedTool === 'sticker' ? styles.toolBtnActive : {}),
              }}
              onClick={() => setInsertOpen((o) => !o)}
              title={insertTitle}
            >
              {selectedTool === 'sticker' ? (
                <span style={{ fontSize: 18, lineHeight: 1 }}>{insertIcon}</span>
              ) : (
                insertIcon
              )}
            </button>
            {insertOpen && (
              <div ref={insertRef} style={styles.insertMenu}>
                <div style={styles.insertSection}>
                  <div style={styles.insertHeader}>Shapes</div>
                  <div style={styles.insertGrid}>
                    {(['rect', 'circle', 'triangle', 'line', 'draw'] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        style={{
                          ...styles.insertItem,
                          ...(selectedTool === id ? styles.insertItemActive : {}),
                        }}
                        title={TOOLS.find((t) => t.id === id)?.label ?? id}
                        onClick={() => selectAndClose(id)}
                      >
                        {ToolIcons[id]}
                        <span style={styles.insertLabel}>{TOOLS.find((t) => t.id === id)?.label ?? id}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={styles.insertSection}>
                  <div style={styles.insertHeader}>Text</div>
                  <div style={styles.insertGrid}>
                    <button
                      type="button"
                      style={{
                        ...styles.insertItem,
                        ...(selectedTool === 'text' ? styles.insertItemActive : {}),
                      }}
                      title="Text"
                      onClick={() => selectAndClose('text')}
                    >
                      {ToolIcons.text}
                      <span style={styles.insertLabel}>Text</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.insertItem,
                        ...(selectedTool === 'sticky' ? styles.insertItemActive : {}),
                      }}
                      title="Sticky note"
                      onClick={() => selectAndClose('sticky')}
                    >
                      {ToolIcons.sticky}
                      <span style={styles.insertLabel}>Sticky note</span>
                    </button>
                  </div>
                </div>
                <div style={styles.insertSection}>
                  <div style={styles.insertHeader}>Containers</div>
                  <div style={styles.insertGrid}>
                    <button
                      type="button"
                      style={{
                        ...styles.insertItem,
                        ...(selectedTool === 'frame' ? styles.insertItemActive : {}),
                      }}
                      title="Frame — drag to draw a spatial container"
                      onClick={() => selectAndClose('frame')}
                    >
                      {ToolIcons.frame}
                      <span style={styles.insertLabel}>Frame</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.insertItem,
                        ...(selectedTool === 'table' ? styles.insertItemActive : {}),
                      }}
                      title="Table — drag to draw a data table"
                      onClick={() => selectAndClose('table')}
                    >
                      {ToolIcons.table}
                      <span style={styles.insertLabel}>Table</span>
                    </button>
                  </div>
                </div>
                <div style={styles.insertSection}>
                  <div style={styles.insertHeader}>Pirate Plunder</div>
                  <div style={{ ...styles.insertGrid, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {STICKER_KINDS.map((kind) => {
                      const def = STICKER_DEFS[kind]
                      return (
                        <button
                          key={kind}
                          type="button"
                          style={{
                            ...styles.insertItem,
                            ...(selectedStickerKind === kind && selectedTool === 'sticker' ? styles.insertItemActive : {}),
                          }}
                          title={def.label}
                          onClick={() => selectAndClose('sticker', kind)}
                        >
                          <span style={styles.stickerIcon}>{def.icon}</span>
                          <span style={styles.insertLabel}>{def.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={styles.divider} />
          <div style={styles.toolGroup}>
            <button
              type="button"
              style={{ ...styles.toolBtn, ...(canUndo ? {} : styles.toolBtnDisabled) }}
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
            <button
              type="button"
              style={{ ...styles.toolBtn, ...(canRedo ? {} : styles.toolBtnDisabled) }}
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
              </svg>
            </button>
          </div>
        </div>
        <div style={styles.right}>
          <button
            type="button"
            style={{
              ...styles.toolBtn,
              fontSize: 14,
              opacity: showMapBorder ? 1 : 0.4,
              border: showMapBorder ? '1px solid #e5e7eb' : 'none',
            }}
            onClick={onToggleMapBorder}
            title={showMapBorder ? 'Hide map border' : 'Show map border'}
          >
            🗺️
          </button>
          <div style={styles.divider} />
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
                  {onResetView && (
                    <button
                      type="button"
                      style={styles.zoomItem}
                      onClick={() => {
                        onResetView()
                        setZoomOpen(false)
                      }}
                    >
                      Reset view
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contextual bar (selection controls or draw brush) */}
      {(selectionStroke != null || selectedTool === 'draw') && canvasRef && (
        <div style={styles.contextualRow}>
          <div style={styles.contextualLeft}>
            {selectedTool === 'draw' ? (
              <DrawBrushControl canvasRef={canvasRef} />
            ) : (
              <>
                {showStrokeControls && (
                  <>
                    <StrokeControl strokeWidth={selectionStroke!.strokeWidth} canvasRef={canvasRef} />
                    {selectionStroke!.strokeColor != null && (
                      <StrokeColorControl strokeColor={selectionStroke!.strokeColor} canvasRef={canvasRef} />
                    )}
                  </>
                )}
                {selectionStroke!.fontFamily != null && (
                  <FontControl
                    fontFamily={selectionStroke!.fontFamily}
                    fontSize={selectionStroke!.fontSize ?? 16}
                    canvasRef={canvasRef}
                  />
                )}
                {selectionStroke!.fill != null && !selectionStroke!.isConnector && (
                  <FillControl fill={selectionStroke!.fill} canvasRef={canvasRef} />
                )}
                {/* Connector-specific controls */}
                {selectionStroke!.isConnector && (
              <>
                {/* Arrow mode selector */}
                <div style={styles.connectorGroup}>
                  <span style={styles.connectorLabel}>Arrow</span>
                  {(['none', 'end', 'both'] as ArrowMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      style={{
                        ...styles.connectorBtn,
                        ...(selectionStroke!.arrowMode === mode ? styles.connectorBtnActive : {}),
                      }}
                      onClick={() => canvasRef.current?.setActiveConnectorArrowMode?.(mode)}
                      title={mode === 'none' ? 'No arrows' : mode === 'end' ? 'Arrow at end' : 'Arrows at both ends'}
                    >
                      {mode === 'none' && (
                        <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                          <line x1="2" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      )}
                      {mode === 'end' && (
                        <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                          <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="2" />
                          <path d="M16 3L21 7L16 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" />
                        </svg>
                      )}
                      {mode === 'both' && (
                        <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                          <line x1="6" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="2" />
                          <path d="M6 3L1 7L6 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" />
                          <path d="M16 3L21 7L16 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div style={styles.divider} />
                {/* Stroke dash selector */}
                <div style={styles.connectorGroup}>
                  <span style={styles.connectorLabel}>Line</span>
                  {(['solid', 'dashed', 'dotted'] as StrokeDash[]).map((dash) => (
                    <button
                      key={dash}
                      type="button"
                      style={{
                        ...styles.connectorBtn,
                        ...(selectionStroke!.strokeDash === dash ? styles.connectorBtnActive : {}),
                      }}
                      onClick={() => canvasRef.current?.setActiveConnectorStrokeDash?.(dash)}
                      title={dash}
                    >
                      <svg width="28" height="10" viewBox="0 0 28 10" fill="none">
                        <line
                          x1="2" y1="5" x2="26" y2="5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray={dash === 'solid' ? undefined : dash === 'dashed' ? '6 3' : '2 3'}
                        />
                      </svg>
                    </button>
                  ))}
                </div>
                <div style={styles.divider} />
              </>
            )}
            <div style={styles.layerGroup}>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.duplicateSelected?.()}
                title="Duplicate (⌘D)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="8" width="12" height="12" rx="1" />
                  <path d="M4 16V4h12" />
                </svg>
              </button>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.copySelected?.()}
                title="Copy (⌘C)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="1" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button
                type="button"
                style={styles.layerBtn}
                onClick={() => canvasRef.current?.paste?.()}
                title="Paste (⌘V)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                </svg>
              </button>
            </div>
                {(selectionStroke!.canGroup || selectionStroke!.canUngroup) && (
              <div style={styles.layerGroup}>
                {selectionStroke!.canGroup && (
                  <button
                    type="button"
                    style={styles.layerBtn}
                    onClick={() => canvasRef.current?.groupSelected()}
                    title="Group (⌘G)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="8" height="8" rx="1" />
                      <rect x="14" y="2" width="8" height="8" rx="1" />
                      <rect x="2" y="14" width="8" height="8" rx="1" />
                      <rect x="14" y="14" width="8" height="8" rx="1" />
                      <path d="M6 10v4M18 10v4M10 6h4M10 18h4" />
                    </svg>
                  </button>
                )}
                {selectionStroke!.canUngroup && (
                  <button
                    type="button"
                    style={styles.layerBtn}
                    onClick={() => canvasRef.current?.ungroupSelected()}
                    title="Ungroup (⌘⇧G)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="8" height="8" rx="1" />
                      <rect x="14" y="2" width="8" height="8" rx="1" />
                      <rect x="2" y="14" width="8" height="8" rx="1" />
                      <rect x="14" y="14" width="8" height="8" rx="1" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button
                ref={layersBtnRef}
                type="button"
                style={styles.toolBtn}
                onClick={() => setLayersOpen((o) => !o)}
                title="Layers"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6M4 10h10v4M4 6h14v4M4 4h18v2" />
                </svg>
                <span style={{ marginLeft: 4, fontSize: 11 }}>Layers</span>
              </button>
              {layersOpen && (
                <div ref={layersRef} style={styles.layersMenu}>
                  <button type="button" style={styles.layersItem} onClick={() => { canvasRef.current?.bringToFront(); setLayersOpen(false) }}>
                    Bring to front
                  </button>
                  <button type="button" style={styles.layersItem} onClick={() => { canvasRef.current?.bringForward(); setLayersOpen(false) }}>
                    Bring forward
                  </button>
                  <button type="button" style={styles.layersItem} onClick={() => { canvasRef.current?.sendBackward(); setLayersOpen(false) }}>
                    Send backward
                  </button>
                  <button type="button" style={styles.layersItem} onClick={() => { canvasRef.current?.sendToBack(); setLayersOpen(false) }}>
                    Send to back
                  </button>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  mainRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '6px 12px',
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
  toolBtnDisabled: {
    opacity: 0.35,
    cursor: 'default',
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
    zIndex: Z_INDEX.TOOLBAR_OVERLAY,
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
  insertMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: '10px 12px',
    minWidth: 180,
    maxWidth: 260,
    zIndex: Z_INDEX.TOOLBAR_OVERLAY,
  },
  insertSection: {
    marginBottom: 10,
  },
  insertHeader: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    marginBottom: 6,
  },
  insertGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
  },
  insertItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
    padding: '8px 4px',
    border: '1px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
  },
  insertItemActive: {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
  },
  insertLabel: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center' as const,
    lineHeight: 1.2,
  },
  stickerIcon: {
    fontSize: 20,
    lineHeight: 1,
  },
  contextualRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    background: '#fafafa',
    borderTop: '1px solid #e5e7eb',
    gap: 8,
  },
  contextualLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  connectorGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  connectorLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    marginRight: 4,
  },
  connectorBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 28,
    padding: 0,
    border: '1px solid transparent',
    borderRadius: 5,
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer',
  },
  connectorBtnActive: {
    background: '#e0e7ff',
    border: '1px solid #a5b4fc',
    color: '#1d4ed8',
  },
  layersMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
    padding: 4,
    minWidth: 140,
    zIndex: Z_INDEX.TOOLBAR_OVERLAY,
  },
  layersItem: {
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
