/**
 * Prompt shown when canvas is empty — one-click to create the parrot spiral showcase.
 * Centered overlay with a single CTA; disappears once objectCount > 0.
 */

interface EmptyCanvasPromptProps {
  objectCount: number
  boardReady?: boolean
  onCreateZoomSpiral: () => void
}

export function EmptyCanvasPrompt({ objectCount, boardReady = true, onCreateZoomSpiral }: EmptyCanvasPromptProps) {
  if (objectCount > 0 || !boardReady) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'auto',
        zIndex: 1,
      }}
    >
      <button
        type="button"
        onClick={onCreateZoomSpiral}
        style={{
          padding: '12px 20px',
          fontSize: 15,
          fontWeight: 600,
          color: '#1e293b',
          background: 'linear-gradient(135deg, #fef08a 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          borderRadius: 8,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #fef08a 0%, #fde68a 100%)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)'
        }}
      >
        🦜 Create parrot spiral
      </button>
      <span style={{ fontSize: 12, color: '#64748b' }}>
        Showcase zoom range from 0.001% to 1000%
      </span>
    </div>
  )
}
