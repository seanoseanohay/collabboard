/**
 * FrameFormOverlay — HTML overlay positioned over DataTable canvas objects.
 * Renders a structured table (column headers + data rows) inside each DataTable.
 * Handles all CRUD: add column, rename column, change type, add row, edit cell, delete row.
 */
import { useState, useRef, useCallback } from 'react'
import { TABLE_HEADER_HEIGHT } from '../lib/dataTableFactory'
import type { FormFrameSceneInfo, FormSchema, FormColumn, FormRow, FormFieldType } from '../lib/frameFormTypes'

/** Sits above the canvas (zIndex=1) but below cursor readout (10). */
const FORM_Z_INDEX = 5

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Text',
  number: 'Number',
  dropdown: 'Select',
  checkbox: 'Check',
  date: 'Date',
}

const FIELD_TYPE_OPTIONS: FormFieldType[] = ['text', 'number', 'dropdown', 'checkbox', 'date']

function generateId() {
  return crypto.randomUUID()
}

interface FrameFormOverlayProps {
  frames: FormFrameSceneInfo[]
  viewportTransform: number[] | null
  /** Called whenever form data changes; the caller should persist via updateFrameFormData. */
  onSchemaChange: (objectId: string, schema: FormSchema | null) => void
}

interface FormState {
  /** objectId → current schema (local optimistic state) */
  [objectId: string]: FormSchema | null
}

export function FrameFormOverlay({ frames, viewportTransform, onSchemaChange }: FrameFormOverlayProps) {
  const [localSchemas, setLocalSchemas] = useState<FormState>({})
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [colTypeMenuId, setColTypeMenuId] = useState<string | null>(null)
  const [dropdownOptionsEditing, setDropdownOptionsEditing] = useState<string | null>(null)
  const editColInputRef = useRef<HTMLInputElement>(null)

  const getSchema = useCallback(
    (frame: FormFrameSceneInfo): FormSchema => {
      if (localSchemas[frame.objectId] !== undefined) {
        return localSchemas[frame.objectId] ?? { columns: [], rows: [] }
      }
      return frame.formSchema ?? { columns: [], rows: [] }
    },
    [localSchemas]
  )

  const updateSchema = useCallback(
    (objectId: string, schema: FormSchema | null) => {
      setLocalSchemas((prev) => ({ ...prev, [objectId]: schema }))
      onSchemaChange(objectId, schema)
    },
    [onSchemaChange]
  )

  // Fall back to identity transform if viewport hasn't been reported yet
  const vpt = viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const zoom = vpt[0] ?? 1
  const panX = vpt[4] ?? 0
  const panY = vpt[5] ?? 0

  return (
    <>
      {frames.map((frame) => {
        const schema = getSchema(frame)
        // Form area occupies the table body below the title bar
        const headerH = TABLE_HEADER_HEIGHT * frame.scaleY * zoom
        const screenLeft = frame.sceneLeft * zoom + panX
        const screenTop = frame.sceneTop * zoom + panY + headerH
        const screenWidth = frame.sceneWidth * frame.scaleX * zoom
        const screenHeight = frame.sceneHeight * frame.scaleY * zoom - headerH

        // Hide if zoomed too small to interact
        if (zoom < 0.15) return null

        return (
          <FrameFormPanel
            key={frame.objectId}
            frameId={frame.objectId}
            schema={schema}
            screenLeft={screenLeft}
            screenTop={screenTop}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            zoom={zoom}
            editingColId={editingColId}
            colTypeMenuId={colTypeMenuId}
            dropdownOptionsEditing={dropdownOptionsEditing}
            editColInputRef={editColInputRef}
            onSetEditingColId={setEditingColId}
            onSetColTypeMenuId={setColTypeMenuId}
            onSetDropdownOptionsEditing={setDropdownOptionsEditing}
            onUpdateSchema={(s) => updateSchema(frame.objectId, s)}
          />
        )
      })}
    </>
  )
}

interface PanelProps {
  frameId: string
  schema: FormSchema
  screenLeft: number
  screenTop: number
  screenWidth: number
  screenHeight: number
  zoom: number
  editingColId: string | null
  colTypeMenuId: string | null
  dropdownOptionsEditing: string | null
  editColInputRef: React.RefObject<HTMLInputElement | null>
  onSetEditingColId: (id: string | null) => void
  onSetColTypeMenuId: (id: string | null) => void
  onSetDropdownOptionsEditing: (id: string | null) => void
  onUpdateSchema: (schema: FormSchema) => void
}

function FrameFormPanel({
  frameId,
  schema,
  screenLeft,
  screenTop,
  screenWidth,
  screenHeight,
  zoom,
  editingColId,
  colTypeMenuId,
  dropdownOptionsEditing,
  editColInputRef,
  onSetEditingColId,
  onSetColTypeMenuId,
  onSetDropdownOptionsEditing,
  onUpdateSchema,
}: PanelProps) {
  const { columns, rows } = schema
  const baseFontSize = Math.min(Math.max(zoom * 12, 9), 13)
  const minWidth = 320

  // ─── Column helpers ───────────────────────────────────────────────
  const addColumn = () => {
    const col: FormColumn = {
      id: generateId(),
      name: `Column ${columns.length + 1}`,
      type: 'text',
    }
    const newSchema: FormSchema = {
      columns: [...columns, col],
      rows: rows.map((r) => ({ ...r, values: { ...r.values, [col.id]: '' } })),
    }
    onUpdateSchema(newSchema)
    onSetEditingColId(col.id)
  }

  const renameColumn = (colId: string, newName: string) => {
    onUpdateSchema({
      ...schema,
      columns: columns.map((c) => (c.id === colId ? { ...c, name: newName } : c)),
    })
  }

  const setColumnType = (colId: string, type: FormFieldType) => {
    onUpdateSchema({
      ...schema,
      columns: columns.map((c) => (c.id === colId ? { ...c, type } : c)),
    })
    onSetColTypeMenuId(null)
  }

  const deleteColumn = (colId: string) => {
    onUpdateSchema({
      columns: columns.filter((c) => c.id !== colId),
      rows: rows.map((r) => {
        const values = { ...r.values }
        delete values[colId]
        return { ...r, values }
      }),
    })
    onSetEditingColId(null)
  }

  // ─── Row helpers ──────────────────────────────────────────────────
  const addRow = () => {
    const row: FormRow = {
      id: generateId(),
      values: Object.fromEntries(columns.map((c) => [c.id, c.type === 'checkbox' ? false : ''])),
    }
    onUpdateSchema({ ...schema, rows: [...rows, row] })
  }

  const updateCell = (rowId: string, colId: string, value: string | number | boolean) => {
    onUpdateSchema({
      ...schema,
      rows: rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r)),
    })
  }

  const deleteRow = (rowId: string) => {
    onUpdateSchema({ ...schema, rows: rows.filter((r) => r.id !== rowId) })
  }

  // ─── Dropdown column options ──────────────────────────────────────
  const setColumnOptions = (colId: string, rawText: string) => {
    const options = rawText.split('\n').map((s) => s.trim()).filter(Boolean)
    onUpdateSchema({
      ...schema,
      columns: columns.map((c) => (c.id === colId ? { ...c, options } : c)),
    })
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: screenLeft,
    top: screenTop,
    width: Math.max(screenWidth, minWidth),
    height: screenHeight,
    background: '#ffffff',
    borderTop: '1px solid #e2e8f0',
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    borderBottom: '1px solid #e2e8f0',
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
  }

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    fontSize: baseFontSize,
  }

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: '4px 6px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
    flexShrink: 0,
  }

  const btnStyle: React.CSSProperties = {
    fontSize: Math.max(baseFontSize - 1, 9),
    padding: '2px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#475569',
    whiteSpace: 'nowrap',
  }

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    gap: 8,
    padding: 16,
    fontSize: baseFontSize,
  }

  if (columns.length === 0) {
    return (
      <div key={frameId} style={{ ...overlayStyle, zIndex: FORM_Z_INDEX }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={emptyStyle}>
          <span style={{ fontSize: 24 }}>📋</span>
          <span>No columns yet</span>
          <button style={{ ...btnStyle, borderColor: '#6366f1', color: '#6366f1' }} onClick={addColumn}>
            + Add Column
          </button>
        </div>
      </div>
    )
  }

  const COL_MIN_W = Math.max(80, screenWidth / Math.max(columns.length + 1, 3))
  const DEL_COL_W = 28

  const thStyle: React.CSSProperties = {
    minWidth: COL_MIN_W,
    maxWidth: COL_MIN_W * 2,
    padding: '3px 6px',
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
    fontWeight: 600,
    textAlign: 'left',
    position: 'relative',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  }

  const tdStyle: React.CSSProperties = {
    minWidth: COL_MIN_W,
    maxWidth: COL_MIN_W * 2,
    padding: '2px 4px',
    border: '1px solid #e2e8f0',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ ...overlayStyle, zIndex: FORM_Z_INDEX }} onMouseDown={(e) => e.stopPropagation()}>
      <div style={scrollAreaStyle}>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} style={thStyle}>
                  {editingColId === col.id ? (
                    <input
                      ref={editColInputRef as React.RefObject<HTMLInputElement>}
                      autoFocus
                      defaultValue={col.name}
                      style={{ width: '100%', fontSize: 'inherit', border: 'none', background: 'transparent', outline: '1px solid #6366f1', padding: '1px 2px' }}
                      onBlur={(e) => { renameColumn(col.id, e.target.value); onSetEditingColId(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { renameColumn(col.id, (e.target as HTMLInputElement).value); onSetEditingColId(null) }
                        if (e.key === 'Escape') onSetEditingColId(null)
                      }}
                    />
                  ) : (
                    <span
                      title={col.name}
                      style={{ cursor: 'pointer', display: 'block' }}
                      onClick={() => onSetEditingColId(col.id)}
                    >
                      {col.name}
                      <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4, fontSize: '0.85em' }}>
                        {FIELD_TYPE_LABELS[col.type]}
                      </span>
                    </span>
                  )}
                  <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2 }}>
                    <button
                      title="Change type"
                      style={{ fontSize: 9, padding: '0 3px', border: '1px solid #e2e8f0', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => onSetColTypeMenuId(colTypeMenuId === col.id ? null : col.id)}
                    >
                      ▾
                    </button>
                    <button
                      title="Delete column"
                      style={{ fontSize: 9, padding: '0 3px', border: '1px solid #e2e8f0', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#ef4444' }}
                      onClick={() => deleteColumn(col.id)}
                    >
                      ✕
                    </button>
                  </div>
                  {colTypeMenuId === col.id && (
                    <TypeMenu
                      currentType={col.type}
                      onSelect={(t) => setColumnType(col.id, t)}
                      onClose={() => onSetColTypeMenuId(null)}
                    />
                  )}
                </th>
              ))}
              <th style={{ ...thStyle, width: DEL_COL_W, minWidth: DEL_COL_W }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.id} style={tdStyle}>
                    <CellInput
                      col={col}
                      value={row.values[col.id]}
                      onChange={(v) => updateCell(row.id, col.id, v)}
                      fontSize={baseFontSize}
                    />
                    {dropdownOptionsEditing === col.id && (
                      <DropdownOptionEditor
                        col={col}
                        onSave={(text) => { setColumnOptions(col.id, text); onSetDropdownOptionsEditing(null) }}
                        onClose={() => onSetDropdownOptionsEditing(null)}
                      />
                    )}
                  </td>
                ))}
                <td style={{ ...tdStyle, width: DEL_COL_W, minWidth: DEL_COL_W, textAlign: 'center' }}>
                  <button
                    title="Delete row"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, lineHeight: 1, padding: 2 }}
                    onClick={() => deleteRow(row.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={footerStyle}>
        <button style={btnStyle} onClick={addRow}>+ Row</button>
        <button style={btnStyle} onClick={addColumn}>+ Column</button>
        {columns.some((c) => c.type === 'dropdown') && (
          <button
            style={btnStyle}
            onClick={() => {
              const dc = columns.find((c) => c.type === 'dropdown')
              if (dc) onSetDropdownOptionsEditing(dc.id)
            }}
          >
            Edit Options
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────

interface CellInputProps {
  col: FormColumn
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean) => void
  fontSize: number
}

function CellInput({ col, value, onChange, fontSize }: CellInputProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '1px 2px',
    boxSizing: 'border-box',
  }

  if (col.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: 'pointer', margin: '0 auto', display: 'block' }}
      />
    )
  }

  if (col.type === 'dropdown') {
    const options = col.options ?? []
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    )
  }

  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    )
  }

  if (col.type === 'number') {
    return (
      <input
        type="number"
        value={value === '' || value === undefined ? '' : Number(value)}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
        style={inputStyle}
      />
    )
  }

  // text
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  )
}

interface TypeMenuProps {
  currentType: FormFieldType
  onSelect: (t: FormFieldType) => void
  onClose: () => void
}

function TypeMenu({ currentType, onSelect, onClose }: TypeMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        minWidth: 110,
        padding: '4px 0',
      }}
    >
      {FIELD_TYPE_OPTIONS.map((t) => (
        <div
          key={t}
          style={{
            padding: '5px 12px',
            cursor: 'pointer',
            background: t === currentType ? '#f1f5f9' : 'transparent',
            fontWeight: t === currentType ? 600 : 400,
            fontSize: 12,
            color: '#334155',
          }}
          onClick={() => onSelect(t)}
          onMouseLeave={() => {}}
        >
          {FIELD_TYPE_LABELS[t]}
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 2, paddingTop: 2 }}>
        <div
          style={{ padding: '4px 12px', cursor: 'pointer', fontSize: 11, color: '#94a3b8' }}
          onClick={onClose}
        >
          Cancel
        </div>
      </div>
    </div>
  )
}

interface DropdownOptionEditorProps {
  col: FormColumn
  onSave: (text: string) => void
  onClose: () => void
}

function DropdownOptionEditor({ col, onSave, onClose }: DropdownOptionEditorProps) {
  const defaultText = (col.options ?? []).join('\n')
  const [text, setText] = useState(defaultText)

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 10000,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: 12,
        minWidth: 200,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#334155' }}>
        Options for "{col.name}"
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>One option per line</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{ width: '100%', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 6px', resize: 'vertical', boxSizing: 'border-box' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button
          style={{ fontSize: 12, padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          style={{ fontSize: 12, padding: '3px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#6366f1', color: '#fff' }}
          onClick={() => onSave(text)}
        >
          Save
        </button>
      </div>
    </div>
  )
}
