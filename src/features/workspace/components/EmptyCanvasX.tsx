/**
 * Easter egg: faint central "X" (treasure map style) on empty zoomed-out boards.
 * Disappears when the board has objects (from sync or user edit).
 */
interface EmptyCanvasXProps {
  objectCount: number
  zoom: number
}

const ZOOM_THRESHOLD = 0.6

export function EmptyCanvasX({ objectCount, zoom }: EmptyCanvasXProps) {
  const show = objectCount === 0 && zoom < ZOOM_THRESHOLD
  if (!show) return null

  // Fade in more when zoomed out (zoom 0.01 = very visible, zoom 0.5 = faint)
  const opacity = Math.max(0.03, 0.12 * (1 - zoom / ZOOM_THRESHOLD))

  return (
    <div
      role="presentation"
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 0,
        fontSize: 120,
        fontWeight: 200,
        color: 'rgba(139, 90, 43, 0.25)',
        opacity,
        userSelect: 'none',
      }}
    >
      ✕
    </div>
  )
}
