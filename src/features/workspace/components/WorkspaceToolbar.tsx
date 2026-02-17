import type { ToolType } from '../types/tools'

interface WorkspaceToolbarProps {
  selectedTool: ToolType
  onToolChange: (tool: ToolType) => void
}

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'line', label: 'Line' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky' },
]

export function WorkspaceToolbar({ selectedTool, onToolChange }: WorkspaceToolbarProps) {
  return (
    <div style={styles.container}>
      {TOOLS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onToolChange(id)}
          style={{
            ...styles.btn,
            ...(selectedTool === id ? styles.btnActive : {}),
          }}
          title={label}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
  },
  btn: {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    color: '#333',
    cursor: 'pointer',
  },
  btnActive: {
    background: '#1a1a2e',
    color: '#fff',
    borderColor: '#1a1a2e',
  },
}
