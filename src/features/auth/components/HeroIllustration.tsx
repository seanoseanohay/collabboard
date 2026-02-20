const CX = 210
const CY = 180
const toRad = (deg: number) => (deg * Math.PI) / 180
const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315]
const CREW = [
  { deg: 270, emoji: '🦜', color: '#f97316' }, // top
  { deg: 135, emoji: '⚓', color: '#0d9488' }, // lower-left
  { deg: 45,  emoji: '🧭', color: '#3b82f6' }, // lower-right
]
const AVATAR_DIST = 160 // px from center to avatar midpoint (beyond ring at 140)

export function HeroIllustration() {

  return (
    <svg
      viewBox="0 0 420 360"
      width="420"
      height="360"
      aria-label="Ship's wheel with collaborative canvas"
      role="img"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d4a017" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#d4a017" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft radial glow */}
      <circle cx={CX} cy={CY} r={175} fill="url(#heroGlow)" />

      {/* Outer decorative ring */}
      <circle cx={CX} cy={CY} r={148} fill="none" stroke="#c9a84c" strokeWidth="5" strokeOpacity="0.3" />

      {/* Main wheel ring */}
      <circle cx={CX} cy={CY} r={140} fill="none" stroke="#d4a017" strokeWidth="14" strokeLinecap="round" />

      {/* 8 Spokes */}
      {SPOKES.map((deg) => {
        const r = toRad(deg)
        return (
          <line
            key={deg}
            x1={CX + 54 * Math.cos(r)}
            y1={CY + 54 * Math.sin(r)}
            x2={CX + 132 * Math.cos(r)}
            y2={CY + 132 * Math.sin(r)}
            stroke="#d4a017"
            strokeWidth="9"
            strokeLinecap="round"
          />
        )
      })}

      {/* Hub */}
      <circle cx={CX} cy={CY} r={52} fill="#fdf6e3" stroke="#c9a84c" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={48} fill="none" stroke="#d4a017" strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Mini canvas — sticky notes */}
      <rect x={CX - 22} y={CY - 24} width={19} height={19} rx={2} fill="#fbbf24" />
      <rect x={CX - 19} y={CY - 20} width={12} height={2} rx={1} fill="rgba(0,0,0,0.2)" />
      <rect x={CX - 19} y={CY - 16} width={8}  height={2} rx={1} fill="rgba(0,0,0,0.2)" />
      <rect x={CX + 3}  y={CY - 20} width={17} height={17} rx={2} fill="#6ee7b7" />

      {/* Shape outline */}
      <rect x={CX - 20} y={CY + 5} width={22} height={14} rx={2} fill="none" stroke="#1a1a2e" strokeWidth="1.5" />

      {/* Connector with arrowhead */}
      <line x1={CX + 5} y1={CY + 12} x2={CX + 20} y2={CY + 12} stroke="#1a1a2e" strokeWidth="1.5" />
      <polygon
        points={`${CX + 20},${CY + 9} ${CX + 24},${CY + 12} ${CX + 20},${CY + 15}`}
        fill="#1a1a2e"
      />

      {/* Crew presence circles at spoke positions */}
      {CREW.map(({ deg, emoji, color }) => {
        const r = toRad(deg)
        const ax = CX + AVATAR_DIST * Math.cos(r)
        const ay = CY + AVATAR_DIST * Math.sin(r)
        return (
          <g key={deg}>
            <circle cx={ax} cy={ay} r={16} fill={color} stroke="#fff" strokeWidth="2.5" />
            <text x={ax} y={ay + 5} textAnchor="middle" fontSize="14" style={{ userSelect: 'none' }}>
              {emoji}
            </text>
          </g>
        )
      })}

      {/* Ocean hint */}
      <ellipse cx={CX} cy={345} rx={155} ry={18} fill="rgba(14,165,233,0.09)" />
    </svg>
  )
}
