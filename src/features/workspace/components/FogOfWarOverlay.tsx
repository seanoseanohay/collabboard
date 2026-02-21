/**
 * Fog of War overlay — dark mask with circular cutouts for revealed areas.
 * Transforms scene coords to screen coords via viewport.
 */

import type { FogReveal } from '../lib/fogOfWarStorage'

interface FogOfWarOverlayProps {
  reveals: FogReveal[]
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

export function FogOfWarOverlay({
  reveals,
  viewportTransform,
  width,
  height,
}: FogOfWarOverlayProps) {
  if (!viewportTransform) return null

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      <defs>
        <mask id="fog-mask">
          <rect width="100%" height="100%" fill="white" />
          {reveals.map((r, i) => {
            const { x: sx, y: sy } = sceneToScreen(r.cx, r.cy, viewportTransform)
            const sr = r.radius * viewportTransform[0]
            return (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={sr}
                fill="black"
              />
            )
          })}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(15,10,25,0.82)"
        mask="url(#fog-mask)"
      />
    </svg>
  )
}
