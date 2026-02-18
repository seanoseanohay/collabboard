import { useState, useCallback } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'
import { invokeAiInterpret } from '../api/aiInterpretApi'
import { executeAiCommands } from '../lib/executeAiCommands'

const EXAMPLES = [
  { label: 'Blue circle at 100, 100', prompt: 'Draw a blue circle at 100, 100' },
  { label: '5 green triangles in a row', prompt: 'Draw 5 green triangles in a horizontal row, evenly spaced' },
  { label: 'Red rectangle at 200, 150', prompt: 'Add a red rectangle at 200, 150' },
  { label: 'Sticky note: Hello', prompt: 'Create a sticky note that says Hello' },
  { label: 'Purple line', prompt: 'Draw a purple line from 50, 50 to 250, 250' },
]

interface AiPromptBarProps {
  boardId: string
}

export function AiPromptBar({ boardId }: AiPromptBarProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPrompt = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      setLoading(true)
      setError(null)
      try {
        const { commands } = await invokeAiInterpret(boardId, text)
        const result = await executeAiCommands(boardId, commands)
        if (!result.ok) {
          setError(result.error ?? 'Failed to execute')
        } else {
          setPrompt('')
          setOpen(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI request failed')
      } finally {
        setLoading(false)
      }
    },
    [boardId, loading]
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
        onClick={() => setOpen(true)}
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

            <p style={styles.examplesLabel}>Examples</p>
            <div style={styles.examplesGrid}>
              {EXAMPLES.map((ex) => (
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
  hint: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#9ca3af',
  },
}
