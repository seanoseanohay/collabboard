import type { FabricCanvasZoomHandle } from './FabricCanvas'

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
] as const

interface FontControlProps {
  fontFamily: string
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  disabled?: boolean
}

export function FontControl({ fontFamily, canvasRef, disabled }: FontControlProps) {
  const options = FONT_OPTIONS.includes(fontFamily as (typeof FONT_OPTIONS)[number])
    ? [...FONT_OPTIONS]
    : [fontFamily, ...FONT_OPTIONS]
  return (
    <div style={styles.wrap}>
      <span style={styles.label}>Font</span>
      <select
        value={fontFamily}
        onChange={(e) => canvasRef.current?.setActiveObjectFontFamily(e.target.value)}
        disabled={disabled}
        style={styles.select}
        title="Font family"
        aria-label="Font family"
      >
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 32,
    padding: '0 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
  },
  label: {
    color: '#6b7280',
  },
  select: {
    minWidth: 120,
    padding: '4px 8px',
    fontSize: 12,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#374151',
    outline: 'none',
    cursor: 'pointer',
  },
}
