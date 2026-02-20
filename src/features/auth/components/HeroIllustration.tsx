const CX = 230
const CY = 190
const toRad = (deg: number) => (deg * Math.PI) / 180
const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315]

const CREW = [
  { deg: 270, emoji: '🦜', color: '#f97316' },
  { deg: 30,  emoji: '🧭', color: '#3b82f6' },
  { deg: 150, emoji: '⚓', color: '#0d9488' },
  { deg: 210, emoji: '☠️', color: '#8b5cf6' },
]
const AVATAR_DIST = 163

// [x, y, radius, opacity]
const STARS: [number, number, number, number][] = [
  [28,  20,  1.8, 0.9], [75,  10, 1.2, 0.6], [130, 32, 1.5, 0.7],
  [310, 15,  1.8, 0.8], [370, 28, 1.2, 0.6], [420, 48, 1.5, 0.7],
  [52,  60,  1.2, 0.5], [185, 18, 1.8, 0.9], [395, 10, 1.2, 0.6],
  [14,  88,  1.5, 0.7], [440, 75, 1.8, 0.8], [345, 58, 1.2, 0.6],
  [458, 130, 1.5, 0.5], [68, 125, 1.2, 0.7], [440, 170, 1.8, 0.6],
  [160, 50,  1.2, 0.8], [280, 40, 1.5, 0.6], [450, 38, 1.2, 0.9],
]

export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 460 380"
      width="460"
      height="380"
      aria-label="Pirate ship's wheel with collaborative canvas"
      role="img"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d4a017" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#d4a017" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="oceanGrad" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.03" />
        </radialGradient>
        <linearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf6e3" />
          <stop offset="100%" stopColor="#d4a017" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Stars */}
      {STARS.map(([x, y, r, opacity], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#d4a017" opacity={opacity} />
      ))}

      {/* Crescent moon — top-right */}
      <circle cx={402} cy={42} r={22} fill="url(#moonGrad)" opacity="0.9" />
      <circle cx={415} cy={34} r={18} fill="#0d1117" />

      {/* Faint compass rose lines behind wheel */}
      {[0, 45, 90, 135].map((deg) => {
        const r = toRad(deg)
        return (
          <line
            key={`cr-${deg}`}
            x1={CX - 182 * Math.cos(r)}
            y1={CY - 182 * Math.sin(r)}
            x2={CX + 182 * Math.cos(r)}
            y2={CY + 182 * Math.sin(r)}
            stroke="#d4a017"
            strokeWidth="0.5"
            strokeOpacity="0.1"
          />
        )
      })}

      {/* Radial glow */}
      <circle cx={CX} cy={CY} r={188} fill="url(#heroGlow)" />

      {/* Outer decorative rings */}
      <circle cx={CX} cy={CY} r={158} fill="none" stroke="#c9a84c" strokeWidth="1" strokeOpacity="0.1" />
      <circle cx={CX} cy={CY} r={154} fill="none" stroke="#c9a84c" strokeWidth="4" strokeOpacity="0.22" />

      {/* Main wheel ring */}
      <circle cx={CX} cy={CY} r={143} fill="none" stroke="#d4a017" strokeWidth="15" strokeLinecap="round" />

      {/* Rim grip notches between spokes */}
      {SPOKES.map((deg) => {
        const r = toRad(deg + 22.5)
        return (
          <circle
            key={`notch-${deg}`}
            cx={CX + 143 * Math.cos(r)}
            cy={CY + 143 * Math.sin(r)}
            r={3.5}
            fill="#fdf6e3"
            opacity="0.55"
          />
        )
      })}

      {/* 8 Spokes */}
      {SPOKES.map((deg) => {
        const r = toRad(deg)
        return (
          <line
            key={deg}
            x1={CX + 56 * Math.cos(r)}
            y1={CY + 56 * Math.sin(r)}
            x2={CX + 134 * Math.cos(r)}
            y2={CY + 134 * Math.sin(r)}
            stroke="#d4a017"
            strokeWidth="9"
            strokeLinecap="round"
          />
        )
      })}

      {/* Hub */}
      <circle cx={CX} cy={CY} r={54} fill="#fdf6e3" stroke="#c9a84c" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={50} fill="none" stroke="#d4a017" strokeWidth="1.5" strokeOpacity="0.3" />
      <circle cx={CX} cy={CY} r={6}  fill="#d4a017" />

      {/* Hub mini canvas — yellow sticky */}
      <rect x={CX - 24} y={CY - 25} width={20} height={18} rx={2} fill="#fbbf24" />
      <rect x={CX - 21} y={CY - 21} width={12} height={2} rx={1} fill="rgba(0,0,0,0.2)" />
      <rect x={CX - 21} y={CY - 17} width={8}  height={2} rx={1} fill="rgba(0,0,0,0.2)" />

      {/* Hub mini canvas — green sticky */}
      <rect x={CX + 4}  y={CY - 23} width={18} height={16} rx={2} fill="#6ee7b7" />
      <rect x={CX + 7}  y={CY - 19} width={10} height={2}  rx={1} fill="rgba(0,0,0,0.15)" />
      <rect x={CX + 7}  y={CY - 15} width={7}  height={2}  rx={1} fill="rgba(0,0,0,0.15)" />

      {/* Hub mini canvas — blue shape outline */}
      <rect x={CX - 22} y={CY + 6} width={20} height={13} rx={2} fill="none" stroke="#3b82f6" strokeWidth="1.5" />

      {/* Hub mini canvas — connector with arrowhead */}
      <line x1={CX} y1={CY + 12} x2={CX + 24} y2={CY + 12} stroke="#1a1a2e" strokeWidth="1.5" />
      <polygon
        points={`${CX + 24},${CY + 9} ${CX + 28},${CY + 12} ${CX + 24},${CY + 15}`}
        fill="#1a1a2e"
      />

      {/* Crew presence avatars */}
      {CREW.map(({ deg, emoji, color }) => {
        const r = toRad(deg)
        const ax = CX + AVATAR_DIST * Math.cos(r)
        const ay = CY + AVATAR_DIST * Math.sin(r)
        return (
          <g key={deg}>
            <circle cx={ax} cy={ay} r={25} fill={color} opacity="0.12" />
            <circle cx={ax} cy={ay} r={18} fill={color} stroke="#fff" strokeWidth="2.5" />
            <text x={ax} y={ay + 6} textAnchor="middle" fontSize="15" style={{ userSelect: 'none' }}>
              {emoji}
            </text>
          </g>
        )
      })}

      {/* Ocean gradient fill */}
      <ellipse cx={CX} cy={368} rx={225} ry={22} fill="url(#oceanGrad)" />

      {/* Wave lines */}
      <path
        d="M 10 352 Q 75 343, 140 352 Q 205 361, 270 352 Q 335 343, 400 352 Q 435 357, 450 352"
        fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.22"
      />
      <path
        d="M 10 364 Q 80 356, 155 364 Q 230 372, 305 364 Q 375 356, 450 364"
        fill="none" stroke="#0ea5e9" strokeWidth="1.2" strokeOpacity="0.15"
      />

      {/* Distant ship silhouette on waves */}
      <g transform="translate(375, 336) scale(0.85)" opacity="0.32">
        <path d="M-26 20 Q0 26 26 20 L20 8 L-20 8 Z" fill="#0d1117" />
        <line x1="0" y1="8" x2="0" y2="-30" stroke="#0d1117" strokeWidth="2" />
        <path d="M2 -28 L20 -8 L2 -8 Z" fill="#d4a017" opacity="0.75" />
        <path d="M1 -30 L11 -23 L1 -16" fill="none" stroke="#0d1117" strokeWidth="1.5" />
      </g>
    </svg>
  )
}
