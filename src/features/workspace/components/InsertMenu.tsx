import { Z_INDEX } from '@/shared/constants/zIndex'
import type { ToolType } from '../types/tools'
import type { StickerKind } from '../lib/pirateStickerFactory'
import { TOOLS } from '../lib/toolbarConstants'
import { ToolIcons } from './ToolIcons'
import { STICKER_DEFS, STICKER_KINDS } from '../lib/pirateStickerFactory'

interface InsertMenuProps {
  selectedTool: ToolType
  selectedStickerKind: StickerKind
  onSelect: (tool: ToolType, stickerKind?: StickerKind) => void
  innerRef: React.Ref<HTMLDivElement>
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: '10px 12px',
    minWidth: 180,
    maxWidth: 260,
    zIndex: Z_INDEX.TOOLBAR_OVERLAY,
  },
  section: { marginBottom: 10 },
  header: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    marginBottom: 6,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 },
  item: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
    padding: '8px 4px',
    border: '1px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
  },
  itemActive: { background: '#f1f5f9', border: '1px solid #cbd5e1' },
  label: { fontSize: 10, color: '#6b7280', textAlign: 'center' as const, lineHeight: 1.2 },
  stickerIcon: { fontSize: 20, lineHeight: 1 },
}

export function InsertMenu({
  selectedTool,
  selectedStickerKind,
  onSelect,
  innerRef,
}: InsertMenuProps) {
  return (
    <div ref={innerRef} style={styles.menu}>
      <div style={styles.section}>
        <div style={styles.header}>Shapes</div>
        <div style={styles.grid}>
          {(['rect', 'circle', 'triangle', 'ellipse', 'polygon', 'polygon-draw', 'line', 'draw'] as const).map(
            (id) => (
              <button
                key={id}
                type="button"
                style={{ ...styles.item, ...(selectedTool === id ? styles.itemActive : {}) }}
                title={TOOLS.find((t) => t.id === id)?.label ?? id}
                onClick={() => onSelect(id)}
              >
                {ToolIcons[id]}
                <span style={styles.label}>{TOOLS.find((t) => t.id === id)?.label ?? id}</span>
              </button>
            )
          )}
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.header}>Text</div>
        <div style={styles.grid}>
          <button
            type="button"
            style={{ ...styles.item, ...(selectedTool === 'text' ? styles.itemActive : {}) }}
            title="Text"
            onClick={() => onSelect('text')}
          >
            {ToolIcons.text}
            <span style={styles.label}>Text</span>
          </button>
          <button
            type="button"
            style={{ ...styles.item, ...(selectedTool === 'sticky' ? styles.itemActive : {}) }}
            title="Sticky note"
            onClick={() => onSelect('sticky')}
          >
            {ToolIcons.sticky}
            <span style={styles.label}>Sticky note</span>
          </button>
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.header}>Containers</div>
        <div style={styles.grid}>
          <button
            type="button"
            style={{ ...styles.item, ...(selectedTool === 'frame' ? styles.itemActive : {}) }}
            title="Frame — drag to draw a spatial container"
            onClick={() => onSelect('frame')}
          >
            {ToolIcons.frame}
            <span style={styles.label}>Frame</span>
          </button>
          <button
            type="button"
            style={{ ...styles.item, ...(selectedTool === 'table' ? styles.itemActive : {}) }}
            title="Table — drag to draw a data table"
            onClick={() => onSelect('table')}
          >
            {ToolIcons.table}
            <span style={styles.label}>Table</span>
          </button>
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.header}>Pirate Plunder</div>
        <div style={styles.grid3}>
          {STICKER_KINDS.map((kind) => {
            const def = STICKER_DEFS[kind]
            return (
              <button
                key={kind}
                type="button"
                style={{
                  ...styles.item,
                  ...(selectedStickerKind === kind && selectedTool === 'sticker' ? styles.itemActive : {}),
                }}
                title={def.label}
                onClick={() => onSelect('sticker', kind)}
              >
                <span style={styles.stickerIcon}>{def.icon}</span>
                <span style={styles.label}>{def.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
