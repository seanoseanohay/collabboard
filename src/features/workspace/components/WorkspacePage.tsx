import { useState, useCallback, useEffect, useRef } from 'react'
import { saveViewport } from '../lib/viewportPersistence'

const MAX_PRESENCE_ICONS = 4
const VIEWPORT_SAVE_DEBOUNCE_MS = 400
import type { BoardMeta } from '@/features/boards/api/boardsApi'
import { updateBoardTitle } from '@/features/boards/api/boardsApi'
import { saveBoardThumbnail } from '../api/thumbnailApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FabricCanvas, type FabricCanvasZoomHandle, type SelectionStrokeInfo } from './FabricCanvas'
import { ShareModal } from './ShareModal'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { AiPromptBar } from './AiPromptBar'
import { CursorOverlay, getPirateIcon } from './CursorOverlay'
import { CursorPositionReadout } from './CursorPositionReadout'
import { GridOverlay } from './GridOverlay'
import { MapBorderOverlay } from './MapBorderOverlay'
import { EmptyCanvasX } from './EmptyCanvasX'
import { DebugConsole } from './DebugConsole'
import { FrameFormOverlay } from './FrameFormOverlay'
import type { FormFrameSceneInfo, FormSchema } from '../lib/frameFormTypes'
import { usePresence } from '../hooks/usePresence'
import type { ToolType } from '../types/tools'
import type { StickerKind } from '../lib/pirateStickerFactory'

interface WorkspacePageProps {
  board: BoardMeta
  onBack: () => void
  onBoardTitleChange?: (title: string) => void
}

export function WorkspacePage({ board, onBack, onBoardTitleChange }: WorkspacePageProps) {
  const [selectedTool, setSelectedTool] = useState<ToolType>('select')
  const [selectedStickerKind, setSelectedStickerKind] = useState<StickerKind>('anchor')
  const [showMapBorder, setShowMapBorder] = useState(true)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(board.title)
  const [viewportTransform, setViewportTransform] = useState<number[] | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  const [shareOpen, setShareOpen] = useState(false)
  const [selectionStroke, setSelectionStroke] = useState<SelectionStrokeInfo | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [presenceHovered, setPresenceHovered] = useState(false)
  const [objectCount, setObjectCount] = useState(0)
  const [selectedCount, setSelectedCount] = useState(0)
  const [boardReady, setBoardReady] = useState(false)
  const [showDebugConsole, setShowDebugConsole] = useState(false)
  const [canvasFps, setCanvasFps] = useState(0)
  const [syncLatency, setSyncLatency] = useState<number | null>(null)
  const [formFrames, setFormFrames] = useState<FormFrameSceneInfo[]>([])
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasZoomRef = useRef<FabricCanvasZoomHandle>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const userName = user?.displayName ?? user?.email ?? 'Anonymous'
  const { others, updatePresence } = usePresence({
    boardId: board.id,
    userId: user?.uid ?? '',
    userName,
  })

  const handlePointerMove = useCallback(
    (scenePoint: { x: number; y: number }) => {
      setCursorPosition(scenePoint)
      if (user) updatePresence(scenePoint.x, scenePoint.y)
    },
    [user, updatePresence]
  )

  const GRID_SIZE = 20
  const saveViewportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleViewportChange = useCallback(
    (vpt: number[]) => {
      setViewportTransform(vpt)
      // Update grid directly via DOM ref — no React re-render on the hot path
      const el = gridRef.current
      if (el) {
        const zoom = vpt[0] ?? 1
        const panX = vpt[4] ?? 0
        const panY = vpt[5] ?? 0
        const cellPx = GRID_SIZE * zoom
        el.style.backgroundSize = `${cellPx}px ${cellPx}px`
        el.style.backgroundPosition = `${panX % cellPx}px ${panY % cellPx}px`
      }
      // Debounced persistence
      if (saveViewportTimeoutRef.current) clearTimeout(saveViewportTimeoutRef.current)
      saveViewportTimeoutRef.current = setTimeout(() => {
        saveViewportTimeoutRef.current = null
        saveViewport(board.id, vpt)
      }, VIEWPORT_SAVE_DEBOUNCE_MS)
    },
    [board.id]
  )

  useEffect(() => {
    return () => {
      if (saveViewportTimeoutRef.current) clearTimeout(saveViewportTimeoutRef.current)
    }
  }, [])

  const handleSelectionChange = useCallback((info: SelectionStrokeInfo | null) => {
    setSelectionStroke(info)
  }, [])

  const handleHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setHistoryState({ canUndo, canRedo })
  }, [])

  const handleObjectCountChange = useCallback((count: number) => {
    setObjectCount(count)
  }, [])

  const handleSelectedCountChange = useCallback((count: number) => {
    setSelectedCount(count)
  }, [])

  const handleBoardReady = useCallback(() => {
    setBoardReady(true)
  }, [])

  const handleFpsChange = useCallback((fps: number) => {
    setCanvasFps(fps)
  }, [])

  const handleSyncLatency = useCallback((ms: number) => {
    setSyncLatency(ms)
  }, [])

  const handleFormFramesChange = useCallback((frames: FormFrameSceneInfo[]) => {
    setFormFrames(frames)
  }, [])

  const handleFrameFormSchemaChange = useCallback((objectId: string, schema: FormSchema | null) => {
    canvasZoomRef.current?.updateFrameFormData(objectId, schema)
  }, [])

  // Sync title when board prop changes (e.g. after joinBoard)
  useEffect(() => {
    setTitleValue(board.title)
  }, [board.title])

  // Capture thumbnail while canvas is still alive (before navigation / tab close)
  const boardIdRef = useRef(board.id)
  useEffect(() => {
    boardIdRef.current = board.id
  }, [board.id])

  const captureThumbnail = useCallback(() => {
    const dataUrl = canvasZoomRef.current?.captureDataUrl()
    if (dataUrl) void saveBoardThumbnail(boardIdRef.current, dataUrl)
  }, [])

  // beforeunload covers tab close / browser refresh
  useEffect(() => {
    const handler = () => captureThumbnail()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [captureThumbnail])

  // Backtick toggles debug console
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '`') setShowDebugConsole((v) => !v)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleBack = useCallback(() => {
    captureThumbnail() // canvas still alive here — capture before navigating
    onBack()
  }, [captureThumbnail, onBack])

  const handleTitleClick = () => {
    setTitleValue(board.title)
    setTitleEditing(true)
  }

  const handleTitleSave = () => {
    setTitleEditing(false)
    const trimmed = titleValue.trim()
    if (!trimmed || trimmed === board.title || !user?.uid) return
    void updateBoardTitle(board.id, user.uid, trimmed)
      .then(() => onBoardTitleChange?.(trimmed))
      .catch(() => setTitleValue(board.title))
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSave()
    }
    if (e.key === 'Escape') {
      setTitleValue(board.title)
      setTitleEditing(false)
    }
  }

  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setCanvasSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" onClick={handleBack} style={styles.backBtn}>
          ← Boards
        </button>
        {titleEditing ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            style={styles.titleInput}
            aria-label="Board name"
          />
        ) : (
          <h1
            style={styles.title}
            onClick={handleTitleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
            aria-label={`Board name: ${board.title}. Click to rename.`}
          >
            {board.title}
          </h1>
        )}
        <AiPromptBar
          boardId={board.id}
          getSelectedObjectIds={() => canvasZoomRef.current?.getSelectedObjectIds() ?? []}
          createFrame={(params) => canvasZoomRef.current?.createFrame(params)}
          getViewportCenter={() => canvasZoomRef.current?.getViewportCenter() ?? { x: 400, y: 300 }}
        />
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          style={styles.shareBtn}
          title="Share board"
        >
          Share
        </button>
        {shareOpen && (
          <ShareModal
            board={board}
            onClose={() => setShareOpen(false)}
          />
        )}
        {others.length > 0 && (
          <div
            style={styles.presenceCluster}
            onMouseEnter={() => setPresenceHovered(true)}
            onMouseLeave={() => setPresenceHovered(false)}
          >
            {presenceHovered && (
              <span style={styles.presenceCount}>
                {others.length} {others.length === 1 ? 'other' : 'others'}
              </span>
            )}
            {others.slice(0, MAX_PRESENCE_ICONS).map((o) => (
              <button
                key={o.userId}
                type="button"
                title={o.name}
                style={styles.presenceIconBtn}
                onClick={() => canvasZoomRef.current?.panToScene(o.x, o.y)}
              >
                {getPirateIcon(o.userId)}
              </button>
            ))}
            {others.length > MAX_PRESENCE_ICONS && (
              <span style={styles.presenceOverflow}>+{others.length - MAX_PRESENCE_ICONS}</span>
            )}
          </div>
        )}
      </header>
      <WorkspaceToolbar
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        selectedStickerKind={selectedStickerKind}
        onStickerKindChange={setSelectedStickerKind}
        zoom={viewportTransform?.[0] ?? 1}
        onZoomToFit={() => canvasZoomRef.current?.zoomToFit()}
        onResetView={() => canvasZoomRef.current?.resetView()}
        onZoomSet={(z) => canvasZoomRef.current?.setZoom(z)}
        selectionStroke={selectionStroke}
        canvasRef={canvasZoomRef}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        onUndo={() => canvasZoomRef.current?.undo()}
        onRedo={() => canvasZoomRef.current?.redo()}
        showMapBorder={showMapBorder}
        onToggleMapBorder={() => setShowMapBorder((v) => !v)}
      />
      <div ref={canvasContainerRef} style={styles.canvas}>
        <GridOverlay ref={gridRef} />
        <EmptyCanvasX objectCount={objectCount} zoom={viewportTransform?.[0] ?? 1} />
        <MapBorderOverlay zoom={viewportTransform?.[0] ?? 1} visible={showMapBorder} />
        <FabricCanvas
          ref={canvasZoomRef}
          selectedTool={selectedTool}
          boardId={board.id}
          userId={user?.uid}
          userName={userName}
          selectedStickerKind={selectedStickerKind}
          onPointerMove={handlePointerMove}
          onViewportChange={handleViewportChange}
          onSelectionChange={handleSelectionChange}
          onHistoryChange={handleHistoryChange}
          onObjectCountChange={handleObjectCountChange}
          onSelectedCountChange={handleSelectedCountChange}
          onBoardReady={handleBoardReady}
          onToolChange={setSelectedTool}
          onFpsChange={handleFpsChange}
          onSyncLatency={handleSyncLatency}
          onFormFramesChange={handleFormFramesChange}
        />
        <FrameFormOverlay
          frames={formFrames}
          viewportTransform={viewportTransform}
          onSchemaChange={handleFrameFormSchemaChange}
        />
        <CursorOverlay
          cursors={others}
          viewportTransform={viewportTransform}
          width={canvasSize.width}
          height={canvasSize.height}
        />
        {cursorPosition && (
          <CursorPositionReadout x={cursorPosition.x} y={cursorPosition.y} />
        )}
        <DebugConsole
          visible={showDebugConsole}
          fps={canvasFps}
          objectCount={objectCount}
          selectedCount={selectedCount}
          zoom={viewportTransform?.[0] ?? 1}
          presenceCount={others.length}
          objectSyncLatency={syncLatency}
          boardId={board.id}
        />
        {!boardReady && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingContent}>
              <div style={styles.spinner} />
              <span style={styles.loadingText}>Loading board…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#fafafa',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1e293b',
    cursor: 'pointer',
  },
  titleInput: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1e293b',
    border: '1px solid #94a3b8',
    borderRadius: 4,
    padding: '2px 6px',
    outline: 'none',
    minWidth: 120,
    maxWidth: 320,
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  presenceCluster: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  presenceCount: {
    fontSize: 11,
    color: '#6b7280',
    whiteSpace: 'nowrap',
    marginRight: 4,
  },
  presenceIconBtn: {
    width: 28,
    height: 28,
    padding: 0,
    border: '1.5px solid #e5e7eb',
    borderRadius: '50%',
    background: '#f9fafb',
    fontSize: 15,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceOverflow: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    border: '1.5px solid #e5e7eb',
    borderRadius: '50%',
    background: '#f3f4f6',
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fafafa',
    zIndex: 10000,
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: 500,
    color: '#6b7280',
  },
}
