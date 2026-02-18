/**
 * Overlay showing other users' cursors with pirate icon badges and name labels.
 * Transforms scene (world) coords to screen coords via viewport.
 * Pirate icon is deterministically assigned per userId via hash.
 */

import { Z_INDEX } from '@/shared/constants/zIndex'
import type { PresenceEntry } from '../api/presenceApi'

interface CursorOverlayProps {
  cursors: PresenceEntry[]
  viewportTransform: number[] | null
  width: number
  height: number
}

const PIRATE_ICONS = ['⚓', '🦜', '🧭', '☠️', '🔱']

function getPirateIcon(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return PIRATE_ICONS[Math.abs(hash) % PIRATE_ICONS.length]
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
        const icon = getPirateIcon(c.userId)
        return (
          <div
            key={c.userId}
            style={{
              ...styles.cursor,
              left: x,
              top: y,
            }}
          >
            <span style={styles.pirateIcon}>{icon}</span>
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
    zIndex: Z_INDEX.CURSORS,
  },
  cursor: {
    position: 'absolute',
    transform: 'translate(-9px, -9px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  pirateIcon: {
    fontSize: 18,
    lineHeight: 1,
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
  },
  label: {
    marginTop: 3,
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 600,
    color: '#1a1a2e',
    background: 'white',
    borderRadius: 4,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    whiteSpace: 'nowrap',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}
