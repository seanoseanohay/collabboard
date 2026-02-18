import { useState, useCallback } from 'react'
import { invokeAiInterpret } from '../api/aiInterpretApi'
import { executeAiCommands } from '../lib/executeAiCommands'

interface AiPromptBarProps {
  boardId: string
}

export function AiPromptBar({ boardId }: AiPromptBarProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask AI to draw... (e.g. add a blue rectangle at 100, 100)"
        disabled={loading}
        style={styles.input}
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
      {error && <span style={styles.error}>{error}</span>}
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 32,
    padding: '0 10px',
    fontSize: 13,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
  btn: {
    flexShrink: 0,
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
    fontSize: 12,
    color: '#dc2626',
  },
}
