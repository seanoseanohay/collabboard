import { useState, useCallback, useEffect, useRef } from 'react'
import type { BoardMeta } from '@/features/boards/api/boardsApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FabricCanvas, type FabricCanvasZoomHandle, type SelectionStrokeInfo } from './FabricCanvas'
import { ShareModal } from './ShareModal'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { CursorOverlay } from './CursorOverlay'
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
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasZoomRef = useRef<FabricCanvasZoomHandle>(null)

  const { user } = useAuth()
  const userName = user?.displayName ?? user?.email ?? 'Anonymous'
  const { others, updatePresence } = usePresence({
    boardId: board.id,
    userId: user?.uid ?? '',
    userName,
  })

  const handlePointerMove = useCallback(
    (scenePoint: { x: number; y: number }) => {
      updatePresence(scenePoint.x, scenePoint.y)
    },
    [updatePresence]
  )

  const handleViewportChange = useCallback((vpt: number[]) => {
    setViewportTransform(vpt)
  }, [])

  const handleSelectionChange = useCallback((info: SelectionStrokeInfo | null) => {
    setSelectionStroke(info)
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
      />
      <div ref={canvasContainerRef} style={styles.canvas}>
        <FabricCanvas
          ref={canvasZoomRef}
          selectedTool={selectedTool}
          boardId={board.id}
          userId={user?.uid}
          userName={userName}
          onPointerMove={user ? handlePointerMove : undefined}
          onViewportChange={handleViewportChange}
          onSelectionChange={handleSelectionChange}
        />
        <CursorOverlay
          cursors={others}
          viewportTransform={viewportTransform}
          width={canvasSize.width}
          height={canvasSize.height}
        />
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
  },
}
