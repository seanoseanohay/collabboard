# Branding Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hero SVG illustration (ship's wheel + mini canvas + crew presence circles) to the LoginPage and add gold→red hover states to primary buttons in LoginPage and NavBar.

**Architecture:** New `HeroIllustration` component (inline SVG, no dependencies). CSS hover classes appended to the existing `src/index.css` (already globally imported in `main.tsx`). LoginPage and NavBar gain `className` props on their buttons; the `background` and `color` inline style props for those buttons move into CSS so `:hover` pseudo-class works without `!important`.

**Tech Stack:** React + TypeScript, inline SVG, plain CSS in `src/index.css`

---

## Task 1: Add hover CSS classes to `src/index.css`

**Files:**
- Modify: `src/index.css`

**Step 1: Read the current file**

Open `src/index.css`. It currently contains only `:root` and `body`. Append the following at the end.

**Step 2: Append these classes**

```css
/* ── MeBoard button hover states ── */

/* Gold CTA buttons — Google sign-in, hero CTA, features CTA */
.btn-gold {
  background: #d4a017;
  color: #0d1117;
  transition: background 0.15s, color 0.15s;
}
.btn-gold:hover:not(:disabled) {
  background: #b91c1c;
  color: #fff;
}

/* Dark submit button — Enter the Ship / Sign Up Free */
.btn-dark {
  background: #1a1a2e;
  color: #d4a017;
  transition: background 0.15s;
}
.btn-dark:hover:not(:disabled) {
  background: #16213e;
}

/* NavBar Log In button (gold text at rest) */
.btn-nav-gold {
  color: #d4a017;
  transition: background 0.15s, border-color 0.15s;
}
.btn-nav-gold:hover:not(:disabled) {
  background: rgba(212, 160, 23, 0.12);
  border-color: #f59e0b;
}

/* NavBar Sign out button (white text at rest) */
.btn-nav-white {
  color: rgba(255, 255, 255, 0.9);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-nav-white:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.7);
  color: #fff;
}
```

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add btn-gold, btn-dark, btn-nav hover classes"
```

---

## Task 2: Create `HeroIllustration` component

**Files:**
- Create: `src/features/auth/components/HeroIllustration.tsx`

**Step 1: Write the component**

SVG layout: center (210, 180), ship's wheel outer ring r=140, 8 spokes at 45° intervals, parchment hub r=52 containing mini sticky notes + shape + connector. Three crew presence circles at spoke positions 270° (top), 135° (lower-left), 45° (lower-right).

```tsx
export function HeroIllustration() {
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
```

**Step 2: Check lints**

```bash
npx eslint src/features/auth/components/HeroIllustration.tsx
```

Fix any warnings. Common one: `userSelect` — in React inline styles it's fine.

**Step 3: Commit**

```bash
git add src/features/auth/components/HeroIllustration.tsx
git commit -m "feat: add HeroIllustration SVG component"
```

---

## Task 3: Write and run `HeroIllustration` test

**Files:**
- Create: `src/features/auth/components/HeroIllustration.test.tsx`

**Step 1: Write the test**

```tsx
import { render, screen } from '@testing-library/react'
import { HeroIllustration } from './HeroIllustration'

describe('HeroIllustration', () => {
  it('renders an accessible SVG illustration', () => {
    render(<HeroIllustration />)
    const svg = screen.getByRole('img', { name: /ship.*wheel/i })
    expect(svg).toBeInTheDocument()
  })
})
```

**Step 2: Run the test**

```bash
npx jest src/features/auth/components/HeroIllustration.test.tsx --no-coverage
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/features/auth/components/HeroIllustration.test.tsx
git commit -m "test: HeroIllustration render test"
```

---

## Task 4: Update `LoginPage.tsx`

**Files:**
- Modify: `src/features/auth/components/LoginPage.tsx`

### Step 1: Add import

After the existing imports add:

```tsx
import { HeroIllustration } from './HeroIllustration'
```

### Step 2: Add `HeroIllustration` to the hero section

The hero section currently has two flex children: `heroContent` div and the `card` div (login form). Insert the illustration between them:

```tsx
{/* Hero illustration — sits between text and login card */}
<div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
  <HeroIllustration />
</div>
```

The existing `flexWrap: 'wrap'` on `styles.hero` ensures mobile stacking.

### Step 3: Apply `className="btn-gold"` to gold buttons; remove `background`/`color` from their inline styles

Three buttons: `googleBtn`, `heroBtn`, `ctaBtn`.

**googleBtn button element** — add className:
```tsx
<button
  type="button"
  onClick={handleGoogleSignIn}
  disabled={loading}
  style={styles.googleBtn}
  className="btn-gold"
>
```

**googleBtn styles object** — remove `background` and `color`:
```ts
googleBtn: {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  // background/color owned by .btn-gold
},
```

**heroBtn button element** — add className:
```tsx
<button onClick={scrollToForm} style={styles.heroBtn} className="btn-gold">
  Claim yer canvas →
</button>
```

**heroBtn styles object** — remove `background: '#d4a017'` and `color: '#0d1117'`.

**ctaBtn button element** — add className:
```tsx
<button onClick={scrollToForm} style={styles.ctaBtn} className="btn-gold">
  Sign up free — claim yer treasure map canvas today 🗺️
</button>
```

**ctaBtn styles object** — remove `background: '#d4a017'` and `color: '#0d1117'`.

### Step 4: Apply `className="btn-dark"` to submit button; remove `background`/`color` from its inline style

```tsx
<button
  type="submit"
  disabled={loading}
  style={styles.submitBtn}
  className="btn-dark"
  data-testid="login-submit"
>
```

**submitBtn styles object** — remove `background: '#1a1a2e'` and `color: '#d4a017'`.

### Step 5: Run all tests

```bash
npx jest --no-coverage
```

Expected: all pass. The `login-submit` button is found by `data-testid`, not by color, so removing inline color/background won't break any test.

### Step 6: Commit

```bash
git add src/features/auth/components/LoginPage.tsx
git commit -m "feat: hero illustration on login page + gold/dark button hover states"
```

---

## Task 5: Update `NavBar.tsx`

**Files:**
- Modify: `src/shared/components/NavBar.tsx`

### Step 1: Apply `className="btn-nav-gold"` to signInBtn; remove `color` from its inline style

```tsx
<button onClick={onSignInClick} style={styles.signInBtn} className="btn-nav-gold">
  Log In
</button>
```

**signInBtn styles object** — remove `color: '#d4a017'` and `background: 'transparent'`:
```ts
signInBtn: {
  padding: '8px 18px',
  fontSize: 14,
  fontWeight: 600,
  border: '1px solid #d4a017',
  borderRadius: 6,
  cursor: 'pointer',
  // color/background owned by .btn-nav-gold
},
```

### Step 2: Apply `className="btn-nav-white"` to signOutBtn; remove `color`/`background` from its inline style

```tsx
<button onClick={onSignOut} style={styles.signOutBtn} className="btn-nav-white">
  Sign out
</button>
```

**signOutBtn styles object** — remove `color: 'rgba(255,255,255,0.9)'` and `background: 'transparent'`.

### Step 3: Run all tests

```bash
npx jest --no-coverage
```

Expected: all pass.

### Step 4: Commit

```bash
git add src/shared/components/NavBar.tsx
git commit -m "style: hover states on NavBar Log In / Sign out buttons"
```

---

## Final Check

```bash
npx jest --no-coverage
npx eslint src/features/auth/components/HeroIllustration.tsx src/features/auth/components/LoginPage.tsx src/shared/components/NavBar.tsx
```

All tests pass, no lint errors. Done.
