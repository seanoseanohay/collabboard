import { useState, useCallback } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'
import { invokeAiInterpret, type AiUsage } from '../api/aiInterpretApi'
import { executeAiCommands } from '../lib/executeAiCommands'

const DRAW_EXAMPLES = [
  { label: 'Blue circle at 100, 100', prompt: 'Draw a blue circle at 100, 100' },
  { label: '5 green triangles in a row', prompt: 'Draw 5 green triangles in a horizontal row, evenly spaced' },
]

const TEMPLATE_EXAMPLES = [
  { label: 'Pros & cons grid', prompt: 'Create a 2 by 3 grid of sticky notes for pros and cons' },
  { label: 'SWOT analysis', prompt: 'Create a SWOT analysis template for 4 quadrants' },
  { label: 'User journey map (5 stages)', prompt: 'Build a user journey map with 5 stages' },
  { label: 'Retrospective board', prompt: "Set up a retrospective board of what went well, what didn't, and action items columns" },
  { label: 'Parrot spiral (zoom showcase)', prompt: 'Create parrot spiral' },
]

const SELECTION_EXAMPLES = [
  { label: 'Arrange in a grid', prompt: 'Arrange these sticky notes in a grid' },
  { label: 'Space evenly', prompt: 'Space these elements evenly' },
]

interface AiPromptBarProps {
  boardId: string
  getSelectedObjectIds?: () => string[]
  createFrame?: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => string
  setFrameChildren?: (frameId: string, childIds: string[]) => void
  createTable?: (params: {
    left: number; top: number; width: number; height: number
    title: string; showTitle: boolean; accentColor?: string
    formSchema: import('../lib/frameFormTypes').FormSchema | null
  }) => string
  createZoomSpiral?: (options?: { count?: number }) => void
  /** @deprecated Use createFrame instead. Kept for backward compatibility. */
  groupObjectIds?: (ids: string[]) => Promise<void>
  getViewportCenter?: () => { x: number; y: number }
}

interface LastResult {
  source: 'local' | 'template' | 'api'
  usage?: AiUsage
}

export function AiPromptBar({ boardId, getSelectedObjectIds, createFrame, setFrameChildren, createTable, createZoomSpiral, groupObjectIds, getViewportCenter }: AiPromptBarProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<LastResult | null>(null)

  const runPrompt = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      setLoading(true)
      setError(null)
      setLastResult(null)
      try {
        const selectedObjectIds = getSelectedObjectIds?.() ?? []
        const viewportCenter = getViewportCenter?.()
        const response = await invokeAiInterpret(boardId, text, {
          selectedObjectIds,
          viewportCenter,
        })
        const result = await executeAiCommands(boardId, response.commands, {
          createFrame: createFrame ?? undefined,
          setFrameChildren: setFrameChildren ?? undefined,
          createTable: createTable ?? undefined,
          createZoomSpiral: createZoomSpiral ?? undefined,
          getViewportCenter,
        })
        if (!result.ok) {
          setError(result.error ?? 'Failed to execute')
        } else {
          setPrompt('')
          setLastResult({ source: response.source ?? 'api', usage: response.usage })
          // Legacy fallback: groupCreated without createFrame
          if (result.shouldGroup && result.createdIds.length >= 2 && groupObjectIds && !createFrame) {
            void groupObjectIds(result.createdIds)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI request failed')
      } finally {
        setLoading(false)
      }
    },
    [boardId, loading, createFrame, setFrameChildren, createTable, createZoomSpiral, groupObjectIds, getViewportCenter]
  )

  const handleExampleClick = useCallback(
    (examplePrompt: string) => {
      runPrompt(examplePrompt)
    },
    [runPrompt]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      runPrompt(prompt)
    },
    [prompt, runPrompt]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setLastResult(null) }}
        style={styles.trigger}
        title="Ask AI to draw"
      >
        <span style={styles.triggerIcon}>✦</span>
        AI
      </button>

      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 style={styles.title}>Ask AI to draw</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={styles.closeBtn}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p style={styles.examplesLabel}>Draw</p>
            <div style={styles.examplesGrid}>
              {DRAW_EXAMPLES.map((ex) => (
                <button
                  key={ex.prompt}
                  type="button"
                  onClick={() => handleExampleClick(ex.prompt)}
                  disabled={loading}
                  style={styles.exampleBtn}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <p style={{ ...styles.examplesLabel, marginTop: 12 }}>Templates</p>
            <div style={styles.examplesGrid}>
              {TEMPLATE_EXAMPLES.map((ex) => (
                <button
                  key={ex.prompt}
                  type="button"
                  onClick={() => handleExampleClick(ex.prompt)}
                  disabled={loading}
                  style={styles.exampleBtn}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <p style={{ ...styles.examplesLabel, marginTop: 12 }}>Selection</p>
            <p style={styles.selectionHint}>Select objects on the canvas first, then run these.</p>
            <div style={styles.examplesGrid}>
              {SELECTION_EXAMPLES.map((ex) => (
                <button
                  key={ex.prompt}
                  type="button"
                  onClick={() => handleExampleClick(ex.prompt)}
                  disabled={loading}
                  style={styles.exampleBtn}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div style={styles.divider} />
            <p style={styles.customLabel}>Or type your own</p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. add a blue rectangle at 100, 100"
                disabled={loading}
                style={styles.input}
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                style={{ ...styles.drawBtn, ...(loading || !prompt.trim() ? styles.drawBtnDisabled : {}) }}
              >
                {loading ? '…' : 'Draw'}
              </button>
            </form>

            {error && <p style={styles.error}>{error}</p>}
            {lastResult && !error && (
              <p style={lastResult.source === 'local' ? styles.resultLocal : lastResult.source === 'template' ? styles.resultTemplate : styles.resultApi}>
                {lastResult.source === 'local'
                  ? '⚡ Generated locally — no API call'
                  : lastResult.source === 'template'
                  ? '📋 Template applied — no API call'
                  : lastResult.usage
                  ? `✦ AI · ${lastResult.usage.total_tokens} tokens (${lastResult.usage.prompt_tokens} in / ${lastResult.usage.completion_tokens} out)`
                  : '✦ AI generated'}
              </p>
            )}
            <p style={styles.hint}>Deploy ai-interpret if you see &quot;Not authorized&quot;</p>
          </div>
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  triggerIcon: {
    fontSize: 12,
    opacity: 0.9,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_INDEX.MODALS,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    minWidth: 360,
    maxWidth: 440,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: '#666',
    padding: '0 4px',
    lineHeight: 1,
  },
  examplesLabel: {
    margin: '0 0 8px',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  examplesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  exampleBtn: {
    padding: '10px 14px',
    fontSize: 13,
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
  },
  divider: {
    height: 1,
    background: '#e5e7eb',
    margin: '16px 0',
  },
  customLabel: {
    margin: '0 0 8px',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 40,
    padding: '0 12px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  drawBtn: {
    alignSelf: 'flex-end',
    height: 36,
    padding: '0 18px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#16213e',
    color: '#fff',
    cursor: 'pointer',
  },
  drawBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    margin: '12px 0 0',
    fontSize: 13,
    color: '#dc2626',
  },
  resultLocal: {
    margin: '12px 0 0',
    fontSize: 12,
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    borderRadius: 6,
    padding: '6px 10px',
  },
  resultTemplate: {
    margin: '12px 0 0',
    fontSize: 12,
    color: '#6b7280',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '6px 10px',
  },
  resultApi: {
    margin: '12px 0 0',
    fontSize: 12,
    color: '#065f46',
    background: '#ecfdf5',
    border: '1px solid #6ee7b7',
    borderRadius: 6,
    padding: '6px 10px',
  },
  hint: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#9ca3af',
  },
  selectionHint: {
    margin: '-4px 0 6px',
    fontSize: 12,
    color: '#9ca3af',
  },
}
