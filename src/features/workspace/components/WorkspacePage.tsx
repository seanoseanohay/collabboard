import { useState, useCallback, useEffect, useRef } from 'react'
import type { BoardMeta } from '@/features/boards/api/boardsApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FabricCanvas } from './FabricCanvas'
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
  const canvasContainerRef = useRef<HTMLDivElement>(null)

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
        {others.length > 0 && (
          <span style={styles.presence}>
            {others.length} {others.length === 1 ? 'other' : 'others'} viewing
          </span>
        )}
      </header>
      <WorkspaceToolbar selectedTool={selectedTool} onToolChange={setSelectedTool} />
      <div ref={canvasContainerRef} style={styles.canvas}>
        <FabricCanvas
          selectedTool={selectedTool}
          boardId={board.id}
          userId={user?.uid}
          userName={userName}
          onPointerMove={user ? handlePointerMove : undefined}
          onViewportChange={handleViewportChange}
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
    background: '#f5f5f5',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  backBtn: {
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  presence: {
    marginLeft: 'auto',
    fontSize: 13,
    color: '#64748b',
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
}
