/**
 * Parchment / treasure-map border framing the infinite canvas.
 * Layers:  vignette → edge gradients → worn-edge inner highlight → compass roses.
 * All pointer-events: none. Opacity fades on zoom-in, intensifies on zoom-out.
 */

interface MapBorderOverlayProps {
  zoom?: number
  visible?: boolean
}

const EDGE_WIDTH = 80
const INNER_EDGE_WIDTH = 48

export function MapBorderOverlay({ zoom = 1, visible = true }: MapBorderOverlayProps) {
  if (!visible) return null

  const base = Math.min(0.30, 0.20 / Math.max(0.6, zoom))
  const inner = base * 0.45
  const vignetteAlpha = base * 0.65

  const sepia = (a: number) => `rgba(140, 100, 30, ${a})`
  const warm  = (a: number) => `rgba(180, 130, 50, ${a})`

  const shared: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 4,
  }

  return (
    <>
      {/* Vignette — radial darkening toward all edges */}
      <div
        style={{
          ...shared,
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, ${sepia(vignetteAlpha)} 100%)`,
        }}
      />

      {/* ── Primary edge gradients ── */}
      <div style={{ ...shared, top: 0, left: 0, right: 0, height: EDGE_WIDTH,
        background: `linear-gradient(to bottom, ${sepia(base)}, transparent)`,
      }} />
      <div style={{ ...shared, bottom: 0, left: 0, right: 0, height: EDGE_WIDTH,
        background: `linear-gradient(to top, ${sepia(base)}, transparent)`,
      }} />
      <div style={{ ...shared, top: 0, left: 0, bottom: 0, width: EDGE_WIDTH,
        background: `linear-gradient(to right, ${sepia(base)}, transparent)`,
      }} />
      <div style={{ ...shared, top: 0, right: 0, bottom: 0, width: EDGE_WIDTH,
        background: `linear-gradient(to left, ${sepia(base)}, transparent)`,
      }} />

      {/* ── Warm inner highlight — "worn parchment" glow just inside edges ── */}
      <div style={{ ...shared, top: 0, left: 0, right: 0, height: INNER_EDGE_WIDTH,
        background: `linear-gradient(to bottom, ${warm(inner)}, transparent)`,
      }} />
      <div style={{ ...shared, bottom: 0, left: 0, right: 0, height: INNER_EDGE_WIDTH,
        background: `linear-gradient(to top, ${warm(inner)}, transparent)`,
      }} />
      <div style={{ ...shared, top: 0, left: 0, bottom: 0, width: INNER_EDGE_WIDTH,
        background: `linear-gradient(to right, ${warm(inner)}, transparent)`,
      }} />
      <div style={{ ...shared, top: 0, right: 0, bottom: 0, width: INNER_EDGE_WIDTH,
        background: `linear-gradient(to left, ${warm(inner)}, transparent)`,
      }} />

      {/* ── Corner compass roses (SVG, not emoji) ── */}
      <CompassRose top={8} left={8} opacity={base * 2.8} />
      <CompassRose top={8} right={8} opacity={base * 2.8} rotate={90} />
      <CompassRose bottom={8} right={8} opacity={base * 2.8} rotate={180} />
      <CompassRose bottom={8} left={8} opacity={base * 2.8} rotate={270} />
    </>
  )
}

/* ── Tiny SVG compass rose ── */

interface CompassProps {
  opacity: number
  rotate?: number
  top?: number
  bottom?: number
  left?: number
  right?: number
}

function CompassRose({ opacity, rotate = 0, ...pos }: CompassProps) {
  const posStyle: Record<string, number | undefined> = {}
  if (pos.top    !== undefined) posStyle.top    = pos.top
  if (pos.bottom !== undefined) posStyle.bottom = pos.bottom
  if (pos.left   !== undefined) posStyle.left   = pos.left
  if (pos.right  !== undefined) posStyle.right  = pos.right

  return (
    <svg
      viewBox="0 0 28 28"
      width={28}
      height={28}
      style={{
        position: 'absolute',
        ...posStyle,
        opacity: Math.min(opacity, 0.55),
        pointerEvents: 'none',
        zIndex: 5,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
      aria-hidden
    >
      {/* Outer ring */}
      <circle cx={14} cy={14} r={12} fill="none" stroke="#8b6914" strokeWidth="0.8" />
      {/* Cardinal points */}
      <polygon points="14,2 15.2,11 14,10 12.8,11"  fill="#8b6914" />
      <polygon points="14,26 15.2,17 14,18 12.8,17"  fill="#c9a84c" />
      <polygon points="2,14 11,12.8 10,14 11,15.2"   fill="#c9a84c" />
      <polygon points="26,14 17,12.8 18,14 17,15.2"   fill="#c9a84c" />
      {/* Ordinal ticks */}
      {[45, 135, 225, 315].map((deg) => {
        const r = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={14 + 9 * Math.cos(r)}
            y1={14 + 9 * Math.sin(r)}
            x2={14 + 12 * Math.cos(r)}
            y2={14 + 12 * Math.sin(r)}
            stroke="#c9a84c"
            strokeWidth="0.6"
          />
        )
      })}
      {/* Center hub */}
      <circle cx={14} cy={14} r={2} fill="#8b6914" />
      <circle cx={14} cy={14} r={1} fill="#fdf6e3" />
    </svg>
  )
}
