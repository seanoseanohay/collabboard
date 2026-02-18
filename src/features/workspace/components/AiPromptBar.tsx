import { useState, useCallback, useRef, useEffect } from 'react'
import { invokeAiInterpret } from '../api/aiInterpretApi'
import { executeAiCommands } from '../lib/executeAiCommands'

interface AiPromptBarProps {
  boardId: string
}

export function AiPromptBar({ boardId }: AiPromptBarProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = prompt.trim()
      if (!trimmed || loading) return
      setLoading(true)
      setError(null)
      try {
        const { commands } = await invokeAiInterpret(boardId, trimmed)
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
    [boardId, prompt, loading]
  )

  return (
    <div style={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...styles.trigger,
          ...(open ? styles.triggerActive : {}),
        }}
        title="Ask AI to draw"
      >
        <span style={styles.triggerIcon}>✦</span>
        AI
      </button>
      {open && (
        <div ref={panelRef} style={styles.dropdown}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI to draw... (e.g. add a blue rectangle at 100, 100)"
              disabled={loading}
              style={styles.input}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              style={{
                ...styles.btn,
                ...(loading || !prompt.trim() ? styles.btnDisabled : {}),
              }}
            >
              {loading ? '…' : 'Draw'}
            </button>
          </form>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.hint}>Describe what to draw. Deploy ai-interpret if you see "Not authorized".</div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
  },
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
  triggerActive: {
    background: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  triggerIcon: {
    fontSize: 12,
    opacity: 0.9,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    minWidth: 320,
    padding: 12,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 100,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 36,
    padding: '0 10px',
    fontSize: 13,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
  btn: {
    alignSelf: 'flex-end',
    height: 32,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#f8fafc',
    color: '#374151',
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc2626',
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    color: '#9ca3af',
  },
}
