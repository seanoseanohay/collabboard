/**
 * Ornate treasure-map frame overlay — inspired by antique cartographic borders.
 * Layers: triple border (outer thick + dotted + inner thin) → corner scrollwork
 * SVGs → repeating edge vine patterns. All pointer-events: none, zoom-aware opacity.
 */

import type { CSSProperties } from 'react'

interface TreasureMapFrameProps {
  zoom?: number
  visible?: boolean
}

const INSET = 14
const CORNER = 100
const DARK = '#4a4520'
const MID = '#6b6330'
const LIGHT = '#8b7d3c'
const GOLD = '#a09050'

const hEdge = makeHEdgeSvg()
const vEdge = makeVEdgeSvg()

export function TreasureMapFrame({ zoom = 1, visible = true }: TreasureMapFrameProps) {
  if (!visible) return null
  const opacity = Math.min(0.50, 0.35 / Math.max(0.55, zoom))

  return (
    <div style={{ position: 'absolute', top: INSET, right: INSET, bottom: INSET, left: INSET, pointerEvents: 'none', zIndex: 4, opacity }}>
      {/* Triple-layer border — outer, dotted, inner */}
      <div style={{ ...abs, top: 0, right: 0, bottom: 0, left: 0, border: `3px solid ${DARK}`, borderRadius: 3, boxShadow: `inset 0 1px 0 ${GOLD}40, 0 1px 3px rgba(0,0,0,0.15)` }} />
      <div style={{ ...abs, top: 4, right: 4, bottom: 4, left: 4, borderStyle: 'dotted', borderWidth: 1, borderColor: MID, borderRadius: 2, opacity: 0.5 }} />
      <div style={{ ...abs, top: 8, right: 8, bottom: 8, left: 8, border: `1.5px solid ${MID}`, borderRadius: 2 }} />

      {/* Corner scrollwork ornaments */}
      {CORNERS.map(({ key, style }) => (
        <div key={key} style={{ ...abs, ...style, width: CORNER, height: CORNER }}>
          <CornerOrnament />
        </div>
      ))}

      {/* Repeating edge vine patterns between corners */}
      <div style={{ ...abs, top: -1, left: CORNER - 14, right: CORNER - 14, height: 14, backgroundImage: hEdge, backgroundRepeat: 'repeat-x', backgroundPosition: 'center' }} />
      <div style={{ ...abs, bottom: -1, left: CORNER - 14, right: CORNER - 14, height: 14, backgroundImage: hEdge, backgroundRepeat: 'repeat-x', backgroundPosition: 'center', transform: 'scaleY(-1)' }} />
      <div style={{ ...abs, left: -1, top: CORNER - 14, bottom: CORNER - 14, width: 14, backgroundImage: vEdge, backgroundRepeat: 'repeat-y', backgroundPosition: 'center' }} />
      <div style={{ ...abs, right: -1, top: CORNER - 14, bottom: CORNER - 14, width: 14, backgroundImage: vEdge, backgroundRepeat: 'repeat-y', backgroundPosition: 'center', transform: 'scaleX(-1)' }} />
    </div>
  )
}

/* ── Layout helpers ── */

const abs: CSSProperties = { position: 'absolute', pointerEvents: 'none' }

const CORNERS: { key: string; style: CSSProperties }[] = [
  { key: 'tl', style: { top: -8, left: -8 } },
  { key: 'tr', style: { top: -8, right: -8, transform: 'scaleX(-1)' } },
  { key: 'bl', style: { bottom: -8, left: -8, transform: 'scaleY(-1)' } },
  { key: 'br', style: { bottom: -8, right: -8, transform: 'scale(-1)' } },
]

/* ── Corner scrollwork SVG (top-left orientation; CSS-flipped for others) ── */

function CornerOrnament() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }} aria-hidden>
      {/* Primary volute A — sweeps along top edge, spirals into corner */}
      <path d="M 88,3 C 68,1 46,3 32,10 C 20,17 14,28 20,36 C 26,44 36,38 32,30 C 28,22 20,22 18,28"
        stroke={DARK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* Primary volute B — sweeps along left edge, spirals into corner */}
      <path d="M 3,88 C 1,68 3,46 10,32 C 17,20 28,14 36,20 C 44,26 38,36 30,32 C 22,28 22,20 28,18"
        stroke={DARK} strokeWidth="2.8" fill="none" strokeLinecap="round" />

      {/* Highlight echo — volute A (creates subtle emboss) */}
      <path d="M 88,2 C 68,0 46,2 32,9 C 21,15 15,26 20,34"
        stroke={GOLD} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.45" />
      {/* Highlight echo — volute B */}
      <path d="M 2,88 C 0,68 2,46 9,32 C 15,21 26,15 34,20"
        stroke={GOLD} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.45" />

      {/* Inner counter-scroll — top */}
      <path d="M 60,5 C 48,4 38,8 32,15"
        stroke={MID} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Inner counter-scroll — left */}
      <path d="M 5,60 C 4,48 8,38 15,32"
        stroke={MID} strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Leaf accent — top of scroll */}
      <path d="M 32,10 C 36,3 44,3 46,10 C 40,12 34,12 32,10 Z" fill={MID} opacity="0.8" />
      {/* Leaf accent — left of scroll */}
      <path d="M 10,32 C 3,36 3,44 10,46 C 12,40 12,34 10,32 Z" fill={MID} opacity="0.8" />
      {/* Small leaf — top inner */}
      <path d="M 52,5 C 54,1 59,1 60,5 C 57,7 53,7 52,5 Z" fill={MID} opacity="0.55" />
      {/* Small leaf — left inner */}
      <path d="M 5,52 C 1,54 1,59 5,60 C 7,57 7,53 5,52 Z" fill={MID} opacity="0.55" />

      {/* Junction diamond where scrolls meet */}
      <path d="M 22,14 L 28,22 L 22,30 L 16,22 Z" fill={DARK} />
      <path d="M 22,16 L 26,22 L 22,28 L 18,22 Z" fill={LIGHT} />
      {/* Rosette */}
      <circle cx={22} cy={22} r={3.5} fill="none" stroke={DARK} strokeWidth="1.2" />
      <circle cx={22} cy={22} r={1.5} fill={GOLD} />

      {/* Scroll terminus dots */}
      <circle cx={88} cy={3} r={2.2} fill={DARK} />
      <circle cx={3} cy={88} r={2.2} fill={DARK} />
      <circle cx={72} cy={2} r={1.2} fill={MID} opacity="0.7" />
      <circle cx={2} cy={72} r={1.2} fill={MID} opacity="0.7" />

      {/* Tiny flourish dots along curves */}
      <circle cx={46} cy={6} r={0.9} fill={MID} opacity="0.6" />
      <circle cx={6} cy={46} r={0.9} fill={MID} opacity="0.6" />
    </svg>
  )
}

/* ── Repeating edge vine patterns (SVG data URLs, computed once) ── */

function makeHEdgeSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="14" viewBox="0 0 60 14">` +
    `<path d="M0,7 C8,2 16,2 22,5.5 C28,9 32,9 38,5.5 C44,2 52,2 60,7" stroke="${DARK}" stroke-width="1.5" fill="none"/>` +
    `<path d="M20,4.5 C22,1.5 26,1.5 27,4.5 C24,5.8 21,5.8 20,4.5 Z" fill="${MID}" opacity="0.6"/>` +
    `<path d="M40,9.5 C38,12.5 34,12.5 33,9.5 C36,8.2 39,8.2 40,9.5 Z" fill="${MID}" opacity="0.6"/>` +
    `<circle cx="30" cy="7" r="1.2" fill="${LIGHT}"/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function makeVEdgeSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="60" viewBox="0 0 14 60">` +
    `<path d="M7,0 C2,8 2,16 5.5,22 C9,28 9,32 5.5,38 C2,44 2,52 7,60" stroke="${DARK}" stroke-width="1.5" fill="none"/>` +
    `<path d="M4.5,20 C1.5,22 1.5,26 4.5,27 C5.8,24 5.8,21 4.5,20 Z" fill="${MID}" opacity="0.6"/>` +
    `<path d="M9.5,40 C12.5,38 12.5,34 9.5,33 C8.2,36 8.2,39 9.5,40 Z" fill="${MID}" opacity="0.6"/>` +
    `<circle cx="7" cy="30" r="1.2" fill="${LIGHT}"/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
