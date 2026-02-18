import { useState, useCallback, useEffect, useRef } from 'react'
import type { BoardMeta } from '@/features/boards/api/boardsApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FabricCanvas, type FabricCanvasZoomHandle, type SelectionStrokeInfo } from './FabricCanvas'
import { ShareModal } from './ShareModal'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { AiPromptBar } from './AiPromptBar'
import { CursorOverlay } from './CursorOverlay'
import { CursorPositionReadout } from './CursorPositionReadout'
import { GridOverlay } from './GridOverlay'
import { usePresence } from '../hooks/usePresence'
import type { ToolType } from '../types/tools'

interface WorkspacePageProps {
  board: BoardMeta
  onBack: () => void
}

export function WorkspacePage({ board, onBack }: WorkspacePageProps) {
  const [selectedTool, setSelectedTool] = useState<ToolType>('select')
  const [viewportTransform, setViewportTransform] = useState<number[] | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  const [shareOpen, setShareOpen] = useState(false)
  const [selectionStroke, setSelectionStroke] = useState<SelectionStrokeInfo | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
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
  const handleViewportChange = useCallback((vpt: number[]) => {
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
  }, [])

  const handleSelectionChange = useCallback((info: SelectionStrokeInfo | null) => {
    setSelectionStroke(info)
  }, [])

  const handleHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setHistoryState({ canUndo, canRedo })
  }, [])

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
        <button type="button" onClick={onBack} style={styles.backBtn}>
          ← Boards
        </button>
        <h1 style={styles.title}>{board.title}</h1>
        <AiPromptBar boardId={board.id} />
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
          <span style={styles.presence} title={`Viewing with: ${others.map((o) => o.name).join(', ')}`}>
            {others.length} {others.length === 1 ? 'other' : 'others'} viewing
            <span style={styles.presenceNames}> — {others.map((o) => o.name).join(', ')}</span>
          </span>
        )}
      </header>
      <WorkspaceToolbar
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        zoom={viewportTransform?.[0] ?? 1}
        onZoomToFit={() => canvasZoomRef.current?.zoomToFit()}
        onZoomSet={(z) => canvasZoomRef.current?.setZoom(z)}
        selectionStroke={selectionStroke}
        canvasRef={canvasZoomRef}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        onUndo={() => canvasZoomRef.current?.undo()}
        onRedo={() => canvasZoomRef.current?.redo()}
      />
      <div ref={canvasContainerRef} style={styles.canvas}>
        <GridOverlay ref={gridRef} />
        <FabricCanvas
          ref={canvasZoomRef}
          selectedTool={selectedTool}
          boardId={board.id}
          userId={user?.uid}
          userName={userName}
          onPointerMove={handlePointerMove}
          onViewportChange={handleViewportChange}
          onSelectionChange={handleSelectionChange}
          onHistoryChange={handleHistoryChange}
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
  presence: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#6b7280',
  },
  presenceNames: {
    marginLeft: 4,
    fontWeight: 500,
    color: '#4b5563',
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    verticalAlign: 'bottom',
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
}
