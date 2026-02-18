/**
 * tldraw-style grid overlay on the canvas. Major lines every gridSize pixels
 * in scene space; transforms with viewport pan/zoom.
 */
interface GridOverlayProps {
  width: number
  height: number
  viewportTransform: number[]
  gridSize?: number
}

function makeGridSvg(size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><line x1="0" y1="0" x2="0" y2="${size}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/><line x1="0" y1="0" x2="${size}" y2="0" stroke="rgba(0,0,0,0.08)" stroke-width="1"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function GridOverlay({
  width,
  height,
  viewportTransform,
  gridSize = 20,
}: GridOverlayProps) {
  const [a, b, c, d, e, f] = viewportTransform
  return (
    <div
      role="presentation"
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        background: '#fafafa',
        backgroundImage: makeGridSvg(gridSize),
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundRepeat: 'repeat',
        transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
        transformOrigin: '0 0',
        zIndex: 0,
      }}
    />
  )
}
