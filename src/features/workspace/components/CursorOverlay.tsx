/**
 * Overlay showing other users' cursors with name labels.
 * Transforms scene (world) coords to screen coords via viewport.
 */

import type { PresenceEntry } from '../api/presenceApi'

interface CursorOverlayProps {
  cursors: PresenceEntry[]
  viewportTransform: number[] | null
  width: number
  height: number
}

function sceneToScreen(
  x: number,
  y: number,
  vpt: number[]
): { x: number; y: number } {
  const zoom = vpt[0] ?? 1
  const panX = vpt[4] ?? 0
  const panY = vpt[5] ?? 0
  return {
    x: x * zoom + panX,
    y: y * zoom + panY,
  }
}

export function CursorOverlay({
  cursors,
  viewportTransform,
  width,
  height,
}: CursorOverlayProps) {
  if (!viewportTransform || cursors.length === 0) return null

  return (
    <div style={styles.overlay}>
      {cursors.map((c) => {
        const { x, y } = sceneToScreen(c.x, c.y, viewportTransform)
        const inView =
          x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20
        if (!inView) return null
        return (
          <div
            key={c.userId}
            style={{
              ...styles.cursor,
              left: x,
              top: y,
              ['--cursor-color' as string]: c.color,
            }}
          >
            <div style={styles.dot} />
            <div style={styles.label}>{c.name}</div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  cursor: {
    position: 'absolute',
    transform: 'translate(-4px, -4px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: 'var(--cursor-color, #6366f1)',
    border: '2px solid white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  },
  label: {
    marginTop: 2,
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 500,
    color: '#1a1a2e',
    background: 'white',
    borderRadius: 4,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    whiteSpace: 'nowrap',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}
