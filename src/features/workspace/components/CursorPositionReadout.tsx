import { Z_INDEX } from '@/shared/constants/zIndex'

/**
 * tldraw-style cursor position readout. Displays scene (page) coordinates.
 */
interface CursorPositionReadoutProps {
  x: number
  y: number
}

export function CursorPositionReadout({ x, y }: CursorPositionReadoutProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        padding: '4px 8px',
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        color: '#6b7280',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        zIndex: Z_INDEX.CURSOR_READOUT,
        pointerEvents: 'none',
      }}
    >
      x: {Math.round(x)} &nbsp; y: {Math.round(y)}
    </div>
  )
}
