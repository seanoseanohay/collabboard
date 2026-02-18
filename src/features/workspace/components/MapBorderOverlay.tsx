/**
 * Subtle parchment/treasure-map border framing the infinite canvas.
 * Renders 4 gradient strips at the canvas edges. Pointer-events: none.
 * Opacity fades when zoomed in (focused work mode) and intensifies on zoom-out.
 */

interface MapBorderOverlayProps {
  zoom?: number
  visible?: boolean
}

export function MapBorderOverlay({ zoom = 1, visible = true }: MapBorderOverlayProps) {
  if (!visible) return null

  // At zoom=1 → opacity 0.18; fades toward 0 as zoom increases; up to ~0.28 when very zoomed out
  const opacity = Math.min(0.28, 0.18 / Math.max(0.65, zoom))

  const sepia = `rgba(160, 110, 30, ${opacity})`
  const transparent = 'transparent'

  return (
    <>
      {/* Top edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 72,
          background: `linear-gradient(to bottom, ${sepia}, ${transparent})`,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      {/* Bottom edge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 72,
          background: `linear-gradient(to top, ${sepia}, ${transparent})`,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      {/* Left edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 72,
          background: `linear-gradient(to right, ${sepia}, ${transparent})`,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      {/* Right edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 72,
          background: `linear-gradient(to left, ${sepia}, ${transparent})`,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      {/* Corner accent — tiny compass hints */}
      {[
        { top: 6, left: 6 },
        { top: 6, right: 6 },
        { bottom: 6, left: 6 },
        { bottom: 6, right: 6 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            fontSize: 16,
            opacity: opacity * 3.5,
            pointerEvents: 'none',
            zIndex: 5,
            userSelect: 'none',
            lineHeight: 1,
          }}
        >
          🧭
        </div>
      ))}
    </>
  )
}
