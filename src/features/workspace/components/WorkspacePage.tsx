import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import type { BoardMeta } from '@/features/boards/api/boardsApi'

interface WorkspacePageProps {
  board: BoardMeta
  onBack: () => void
}

export function WorkspacePage({ board, onBack }: WorkspacePageProps) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          ← Boards
        </button>
        <h1 style={styles.title}>{board.title}</h1>
      </header>
      <div style={styles.canvas}>
        <Tldraw />
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
  canvas: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
}
