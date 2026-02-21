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
import { ToolIcons } from './ToolIcons'
import { InsertMenu } from './InsertMenu'
import { STICKER_DEFS, type StickerKind } from '../lib/pirateStickerFactory'
import { TOOLS, INSERT_TOOLS, ZOOM_PRESETS } from '../lib/toolbarConstants'
import { zoomToLabel, zoomToSliderValue, sliderValueToZoom } from '../lib/toolbarZoomUtils'
import type { ArrowMode, StrokeDash } from '../lib/connectorFactory'
import { SCALE_BANDS, ALL_SCALES_ID } from '../lib/scaleBands'

interface WorkspaceToolbarProps {
  selectedTool: ToolType
  onToolChange: (tool: ToolType) => void
  selectedStickerKind?: StickerKind
  onStickerKindChange?: (kind: StickerKind) => void
  zoom?: number
  onZoomToFit?: () => void
  onZoomToSelection?: () => void
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
  boardMode?: 'standard' | 'explorer'
  polygonSides?: number
  starMode?: boolean
  onPolygonSidesChange?: (sides: number) => void
  onStarModeChange?: (star: boolean) => void
  onPortsToggle?: () => void
  gridType?: 'square' | 'hex' | 'none'
  onGridTypeChange?: (type: 'square' | 'hex' | 'none') => void
  snapToGrid?: boolean
  onSnapToggle?: () => void
  fogEnabled?: boolean
  onFogToggle?: () => void
  revealRadius?: number
  onRevealRadiusChange?: (radius: number) => void
  /** When true, layout stacks vertically for mobile drawer (Figma-like) */
  inDrawer?: boolean
}

export function WorkspaceToolbar({
  selectedTool,
  onToolChange,
  selectedStickerKind = 'anchor',
  onStickerKindChange,
  zoom = 1,
  onZoomToFit,
  onZoomToSelection,
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
  boardMode: _boardMode = 'standard',
  polygonSides = 6,
  starMode = false,
  onPolygonSidesChange,
  onStarModeChange,
  onPortsToggle,
  gridType = 'square',
  onGridTypeChange,
  snapToGrid = false,
  onSnapToggle,
  fogEnabled = false,
  onFogToggle,
  revealRadius = 80,
  onRevealRadiusChange,
  inDrawer = false,
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
      <div style={{ ...styles.mainRow, ...(inDrawer ? styles.mainRowDrawer : {}) }}>
        <div style={{ ...styles.toolGroups, ...(inDrawer ? styles.toolGroupsDrawer : {}) }}>
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
              onClick={() => onToolChange('zoom-in')}
              style={{ ...styles.toolBtn, ...(selectedTool === 'zoom-in' ? styles.toolBtnActive : {}) }}
              title="Zoom In — drag to zoom into area"
            >
              {ToolIcons['zoom-in']}
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
            <button
              type="button"
              onClick={() => onToolChange('laser')}
              style={{ ...styles.toolBtn, ...(selectedTool === 'laser' ? styles.toolBtnActive : {}) }}
              title="Laser pointer — temporary trail visible to collaborators"
            >
              {ToolIcons.laser}
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
              <InsertMenu
                selectedTool={selectedTool}
                selectedStickerKind={selectedStickerKind}
                onSelect={selectAndClose}
                innerRef={insertRef}
              />
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
        <div style={{ ...styles.right, ...(inDrawer ? styles.rightDrawer : {}) }}>
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
          <div style={styles.gridPill}>
            {(['square', 'hex', 'none'] as const).map((type) => (
              <button
                key={type}
                type="button"
                style={{
                  ...styles.gridPillBtn,
                  ...(gridType === type ? styles.gridPillBtnActive : {}),
                }}
                onClick={() => onGridTypeChange?.(type)}
                title={type === 'square' ? 'Square grid' : type === 'hex' ? 'Hex grid' : 'No grid'}
              >
                {type === 'square' ? '□' : type === 'hex' ? '⬡' : '✕'}
              </button>
            ))}
          </div>
          <button
            type="button"
            style={{
              ...styles.toolBtn,
              fontSize: 14,
              opacity: snapToGrid ? 1 : 0.4,
              border: snapToGrid ? '1px solid #e5e7eb' : 'none',
            }}
            onClick={onSnapToggle}
            title={snapToGrid ? 'Snap to grid: on' : 'Snap to grid: off'}
          >
            🧲
          </button>
          {_boardMode === 'explorer' && (
            <button
              type="button"
              style={{ ...styles.toolBtn, fontSize: 14 }}
              onClick={onPortsToggle}
              title="Ports of Call"
            >
              🧭
            </button>
          )}
          {_boardMode === 'explorer' && (
            <button
              type="button"
              style={{
                ...styles.toolBtn,
                fontSize: 14,
                opacity: fogEnabled ? 1 : 0.4,
                border: fogEnabled ? '1px solid #e5e7eb' : 'none',
              }}
              onClick={onFogToggle}
              title={fogEnabled ? 'Fog of War: on' : 'Fog of War: off'}
            >
              ⛅
            </button>
          )}
          {_boardMode === 'explorer' && fogEnabled && (
            <button
              type="button"
              style={{ ...styles.toolBtn, ...(selectedTool === 'reveal' ? styles.toolBtnActive : {}), fontSize: 14 }}
              onClick={() => onToolChange('reveal')}
              title="Reveal — click to clear fog"
            >
              🔦
            </button>
          )}
          {_boardMode === 'explorer' && selectionStroke && (
            <select
              value={
                selectionStroke
                  ? (() => {
                      const d = (canvasRef?.current?.getActiveObjectData?.() ?? {}) as { minZoom?: number; maxZoom?: number }
                      const band = SCALE_BANDS.find((b) => b.minZoom === d.minZoom && b.maxZoom === d.maxZoom)
                      return band ? band.id : ALL_SCALES_ID
                    })()
                  : ALL_SCALES_ID
              }
              onChange={(e) => canvasRef?.current?.setActiveObjectScaleBand?.(e.target.value)}
              style={{
                fontSize: 11,
                padding: '2px 4px',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
              }}
              title="Visibility scale band"
            >
              <option value={ALL_SCALES_ID}>👁 All Scales</option>
              {SCALE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.emoji} {b.name}
                </option>
              ))}
            </select>
          )}
          <div style={styles.divider} />
          <div style={styles.zoomControls}>
            <input
              type="range"
              min={0}
              max={100}
              value={zoomToSliderValue(zoom)}
              onChange={(e) => onZoomSet?.(sliderValueToZoom(Number(e.target.value)))}
              style={{ ...styles.zoomSlider, ...(inDrawer ? styles.zoomSliderDrawer : {}) }}
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
                  {onZoomToSelection && (
                    <button
                      type="button"
                      style={styles.zoomItem}
                      onClick={() => {
                        onZoomToSelection()
                        setZoomOpen(false)
                      }}
                    >
                      Zoom to selection ⇧2
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

      {/* Contextual bar (selection controls or draw brush or reveal) */}
      {(selectionStroke != null || selectedTool === 'draw' || selectedTool === 'polygon' || selectedTool === 'reveal') && canvasRef && (
        <div style={styles.contextualRow}>
          <div style={styles.contextualLeft}>
            {selectedTool === 'draw' ? (
              <DrawBrushControl canvasRef={canvasRef} />
            ) : selectedTool === 'reveal' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151' }}>
                <label style={{ color: '#6b7280' }}>Reveal size</label>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={10}
                  value={revealRadius}
                  onChange={(e) => onRevealRadiusChange?.(Number(e.target.value))}
                  style={{ width: 120, height: 4, cursor: 'pointer', accentColor: '#4f46e5' }}
                  title="Reveal circle size"
                  aria-label="Reveal size"
                />
                <span style={{ color: '#6b7280', fontSize: 11, minWidth: 32 }}>{revealRadius}px</span>
              </div>
            ) : selectedTool === 'polygon' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151' }}>
                <label style={{ color: '#6b7280' }}>Sides</label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  value={polygonSides}
                  onChange={(e) => onPolygonSidesChange?.(Math.min(12, Math.max(3, Number(e.target.value) || 6)))}
                  style={{ width: 42, padding: '2px 4px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4, textAlign: 'center' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#6b7280' }}>
                  <input
                    type="checkbox"
                    checked={starMode}
                    onChange={(e) => onStarModeChange?.(e.target.checked)}
                  />
                  Star
                </label>
              </div>
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
  mainRowDrawer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  toolGroups: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  toolGroupsDrawer: {
    flexWrap: 'wrap',
    gap: 4,
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
  rightDrawer: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
  zoomSliderDrawer: {
    width: '100%',
    minWidth: 120,
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
  gridPill: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  gridPillBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: 13,
  },
  gridPillBtnActive: {
    background: '#f1f5f9',
    color: '#1e293b',
  },
}
