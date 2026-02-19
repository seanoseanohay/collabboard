/**
 * Animated SVG parrot mascot for the boards page.
 * Sits fixed in the upper-right corner with an optional speech bubble.
 */

interface ParrotMascotProps {
  message?: string
  onDismiss?: () => void
  onNewMessage?: () => void
}

export function ParrotMascot({ message, onDismiss, onNewMessage }: ParrotMascotProps) {
  return (
    <div style={styles.root}>
      <style>{ANIMATION_CSS}</style>

      {/* Parrot always at top */}
      <div style={styles.birdWrap} className="parrot-bob">
        <ParrotSvg />
      </div>

      {/* Speech bubble hangs below the parrot, pointing up */}
      {message && (
        <div style={styles.bubble}>
          {/* Triangle pointer pointing up toward the parrot */}
          <div style={styles.bubblePointer} />
          <p style={styles.bubbleText}>{message}</p>
          <div style={styles.bubbleActions}>
            {onNewMessage && (
              <button style={styles.newBtn} onClick={onNewMessage} title="Another one!">
                🦜
              </button>
            )}
            {onDismiss && (
              <button style={styles.dismissBtn} onClick={onDismiss} title="Dismiss">
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ParrotSvg() {
  return (
    <svg
      width={90}
      height={153}
      viewBox="0 0 90 153"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pirate parrot mascot"
      role="img"
    >
      {/* ── Branch ── */}
      <rect x="8" y="130" width="74" height="11" rx="5" fill="#7c4f1e" />
      <rect x="8" y="130" width="74" height="4" rx="2" fill="rgba(0,0,0,0.12)" />

      {/* ── Tail feathers (rendered behind body) ── */}
      {/* Left outer feather */}
      <path
        d="M 42,118 Q 28,132 22,152 Q 28,145 36,137 Q 37,127 44,120 Z"
        fill="#1b5e20"
      />
      {/* Centre feather */}
      <path
        d="M 47,120 Q 43,136 40,153 Q 46,146 52,153 Q 50,136 51,120 Z"
        fill="#2e7d32"
      />
      {/* Right outer feather */}
      <path
        d="M 55,118 Q 64,131 68,151 Q 61,144 57,136 Q 55,126 53,120 Z"
        fill="#43a047"
      />

      {/* ── Legs ── */}
      <rect x="38" y="116" width="4" height="16" rx="2" fill="#ffa726" />
      <rect x="50" y="116" width="4" height="16" rx="2" fill="#ffa726" />

      {/* ── Toes (left foot) ── */}
      <line x1="38" y1="131" x2="28" y2="136" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="40" y1="131" x2="35" y2="139" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="42" y1="131" x2="44" y2="140" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />

      {/* ── Toes (right foot) ── */}
      <line x1="50" y1="131" x2="43" y2="139" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="52" y1="131" x2="54" y2="140" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="54" y1="131" x2="62" y2="136" stroke="#ffa726" strokeWidth="2.2" strokeLinecap="round" />

      {/* ── Wing (right side, slightly behind body) ── */}
      <path
        d="M 56,70 Q 76,76 73,106 Q 66,114 59,114 Q 68,100 66,79 Q 62,72 56,70 Z"
        fill="#388e3c"
      />
      <path
        d="M 57,74 Q 72,82 70,104 Q 65,111 61,110"
        fill="none"
        stroke="#2e7d32"
        strokeWidth="1"
        opacity="0.4"
      />

      {/* ── Body ── */}
      <ellipse cx="47" cy="91" rx="22" ry="28" fill="#2e7d32" />

      {/* ── Belly (lighter patch) ── */}
      <ellipse cx="43" cy="95" rx="12" ry="19" fill="#66bb6a" />

      {/* ── Head ── */}
      <circle cx="49" cy="57" r="21" fill="#2e7d32" />

      {/* ── Crest feathers ── */}
      <path d="M 43,39 Q 37,24 42,12 Q 47,24 48,39 Z" fill="#1b5e20" />
      <path d="M 52,38 Q 52,22 58,10 Q 60,23 58,38 Z" fill="#2e7d32" />
      <path d="M 48,39 Q 45,23 48,11 Q 51,23 52,38 Z" fill="#4caf50" />

      {/* ── Cheek patch ── */}
      <ellipse cx="61" cy="61" rx="9" ry="7" fill="#e65100" />

      {/* ── Eye (white sclera, pupil, shine) ── */}
      <circle cx="57" cy="52" r="7.5" fill="white" />
      <circle cx="57" cy="52" r="5" fill="#111111" />
      <circle cx="59" cy="50" r="2" fill="white" />

      {/* ── Beak ── */}
      {/* Upper beak */}
      <path
        d="M 58,58 Q 73,60 69,68 Q 61,67 56,62 Z"
        fill="#ffa726"
      />
      {/* Lower beak */}
      <path
        d="M 56,62 Q 67,67 63,74 Q 57,73 54,67 Z"
        fill="#f57c00"
      />
      {/* Beak ridge */}
      <path
        d="M 58,58 Q 68,60 66,63"
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.8"
      />
    </svg>
  )
}

const ANIMATION_CSS = `
  @keyframes parrot-bob {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    30%       { transform: translateY(-6px) rotate(-1.5deg); }
    70%       { transform: translateY(-3px) rotate(1deg); }
  }
  .parrot-bob {
    animation: parrot-bob 3s ease-in-out infinite;
    transform-origin: bottom center;
  }
  .parrot-bob:hover {
    animation-duration: 0.8s;
  }
`

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    right: 20,
    top: 58,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    zIndex: 90,
    pointerEvents: 'none',
  },
  birdWrap: {
    flexShrink: 0,
    cursor: 'default',
    pointerEvents: 'auto',
  },
  bubble: {
    position: 'relative',
    background: '#fdf6e3',
    border: '1.5px solid #c9a84c',
    borderRadius: 12,
    padding: '12px 14px',
    maxWidth: 220,
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    marginTop: 4,
    pointerEvents: 'auto',
  },
  bubblePointer: {
    position: 'absolute',
    top: -10,
    right: 28,
    width: 0,
    height: 0,
    borderLeft: '9px solid transparent',
    borderRight: '9px solid transparent',
    borderBottom: '10px solid #c9a84c',
  },
  bubbleText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: '#2c1a00',
    fontStyle: 'italic',
  },
  bubbleActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  newBtn: {
    background: 'none',
    border: '1px solid #c9a84c',
    borderRadius: 6,
    fontSize: 13,
    padding: '2px 8px',
    cursor: 'pointer',
    color: '#8b6914',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    color: '#8b6914',
    padding: '0 4px',
    lineHeight: 1,
  },
}
