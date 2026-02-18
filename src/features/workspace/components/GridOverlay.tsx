import { forwardRef } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'

/**
 * tldraw-style grid overlay. Tracks viewport via backgroundSize/backgroundPosition
 * (no CSS transform) so it never paints outside its bounds and stays in sync
 * with the Fabric canvas render without a separate compositing layer.
 */
interface GridOverlayProps {
  gridSize?: number
}

function makeGridSvg(size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><line x1="0" y1="0" x2="0" y2="${size}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/><line x1="0" y1="0" x2="${size}" y2="0" stroke="rgba(0,0,0,0.08)" stroke-width="1"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export const GridOverlay = forwardRef<HTMLDivElement, GridOverlayProps>(
  function GridOverlay({ gridSize = 20 }, ref) {
    const cellPx = `${gridSize}px ${gridSize}px`
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          backgroundImage: makeGridSvg(gridSize),
          backgroundSize: cellPx,
          backgroundPosition: '0px 0px',
          zIndex: Z_INDEX.GRID,
        }}
      />
    )
  }
)
