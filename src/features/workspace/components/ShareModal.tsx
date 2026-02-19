import { useState, useCallback, useEffect } from 'react'
import type { BoardMeta, BoardMember } from '@/features/boards/api/boardsApi'
import { updateBoardVisibility, getBoardMembers, removeBoardMember } from '@/features/boards/api/boardsApi'
import { Z_INDEX } from '@/shared/constants/zIndex'
import { getShareUrl } from '@/shared/lib/shareLinks'
import { inviteToBoard } from '../api/inviteApi'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface ShareModalProps {
  board: BoardMeta
  onClose: () => void
  onVisibilityChange?: (isPublic: boolean) => void
}

function looksLikeEmail(val: string): boolean {
  return val.includes('@')
}

export function ShareModal({ board, onClose, onVisibilityChange }: ShareModalProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPublic, setIsPublic] = useState(board.isPublic ?? false)
  const [visibilityUpdating, setVisibilityUpdating] = useState(false)
  const [members, setMembers] = useState<BoardMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const isOwner = user?.uid === board.ownerId

  useEffect(() => {
    let cancelled = false
    setMembersLoading(true)
    getBoardMembers(board.id)
      .then((data) => { if (!cancelled) setMembers(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMembersLoading(false) })
    return () => { cancelled = true }
  }, [board.id])

  const handleRemoveMember = useCallback(async (userId: string) => {
    setRemovingId(userId)
    try {
      await removeBoardMember(board.id, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch {
      // ignore
    } finally {
      setRemovingId(null)
    }
  }, [board.id])

  const handleAdd = useCallback(async () => {
    if (!input.trim()) {
      setMessage('Enter an email address')
      setStatus('error')
      return
    }
    if (!looksLikeEmail(input)) {
      setMessage('Enter a valid email address to add a collaborator')
      setStatus('error')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const result = await inviteToBoard(board.id, input.trim(), 'add')
      setMessage(result.message)
      setStatus('success')
      setInput('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add collaborator')
      setStatus('error')
    }
  }, [board.id, input])

  const handleEmail = useCallback(async () => {
    if (!input.trim()) {
      setMessage('Enter an email address')
      setStatus('error')
      return
    }
    if (!looksLikeEmail(input)) {
      setMessage('Enter a valid email address to send an invite')
      setStatus('error')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const result = await inviteToBoard(board.id, input.trim(), 'email')
      setMessage(result.message)
      setStatus('success')
      setInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite email'
      const needsDomain = /domain|verify|recipient|testing/i.test(msg)
      setMessage(
        needsDomain
          ? 'Resend free tier only emails your own address. Use "Copy share link" below, or verify a domain at resend.com/domains.'
          : msg
      )
      setStatus('error')
    }
  }, [board.id, input])

  const handleTogglePublic = useCallback(async () => {
    setVisibilityUpdating(true)
    const next = !isPublic
    try {
      await updateBoardVisibility(board.id, next)
      setIsPublic(next)
      onVisibilityChange?.(next)
    } catch {
      // ignore
    } finally {
      setVisibilityUpdating(false)
    }
  }, [board.id, isPublic, onVisibilityChange])

  const handleCopyLink = useCallback(async () => {
    const url = getShareUrl(board.id)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [board.id])

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h2 style={title}>Share board</h2>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>

        <label style={label}>Email address</label>
        <div style={inputRow}>
          <input
            type="text"
            placeholder="colleague@example.com"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setStatus('idle')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            style={inputStyle}
            autoFocus
          />
        </div>

        <p style={hint}>
          Add a collaborator who has an account, or send an invite email (with link) to anyone.
        </p>

        <div style={actions}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={status === 'loading'}
            style={primaryBtn}
          >
            Add to board
          </button>
          <button
            type="button"
            onClick={handleEmail}
            disabled={status === 'loading'}
            style={secondaryBtn}
          >
            Send invite email
          </button>
        </div>

        {status === 'success' && <p style={successMsg}>{message}</p>}
        {status === 'error' && <p style={errorMsg}>{message}</p>}

        <div style={divider} />
        <label style={label}>
          Members ({membersLoading ? '…' : members.length})
        </label>
        <div style={memberList}>
          {membersLoading ? (
            <p style={memberHint}>Loading…</p>
          ) : members.length === 0 ? (
            <p style={memberHint}>No members yet.</p>
          ) : (
            members.map((m) => (
              <div key={m.userId} style={memberRow}>
                <div style={memberInfo}>
                  <span style={memberName}>{m.displayName}</span>
                  {m.isOwner && <span style={ownerBadge}>Owner</span>}
                  <span style={memberEmail}>{m.email}</span>
                </div>
                {isOwner && !m.isOwner && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(m.userId)}
                    disabled={removingId === m.userId}
                    style={removeBtn}
                    title="Remove member"
                  >
                    {removingId === m.userId ? '…' : '×'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div style={divider} />

        <div style={visibilityRow}>
          <div>
            <div style={visibilityLabel}>
              {isPublic ? '🌐 Public' : '🔒 Private'}
            </div>
            <div style={visibilityHint}>
              {isPublic
                ? 'Anyone can view and edit this board'
                : 'Only invited members can access this board'}
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => void handleTogglePublic()}
              disabled={visibilityUpdating}
              style={isPublic ? toggleBtnPublic : toggleBtnPrivate}
            >
              {visibilityUpdating ? '…' : isPublic ? 'Make private' : 'Make public'}
            </button>
          )}
        </div>

        <div style={divider} />
        <label style={label}>Or copy link</label>
        <button type="button" onClick={handleCopyLink} style={copyBtn}>
          {copied ? 'Copied!' : 'Copy share link'}
        </button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: Z_INDEX.MODALS,
}
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  minWidth: 360,
  maxWidth: 420,
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
}
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
}
const title: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: '#1a1a2e',
}
const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 24,
  cursor: 'pointer',
  color: '#666',
  padding: '0 4px',
  lineHeight: 1,
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 8,
}
const inputRow: React.CSSProperties = {
  marginBottom: 12,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 14,
  border: '1px solid #e0e0e0',
  borderRadius: 8,
  boxSizing: 'border-box',
}
const hint: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 13,
  color: '#64748b',
}
const actions: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 12,
}
const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 500,
  border: 'none',
  borderRadius: 8,
  background: '#16213e',
  color: '#fff',
  cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 500,
  border: '1px solid #16213e',
  borderRadius: 8,
  background: '#fff',
  color: '#16213e',
  cursor: 'pointer',
}
const successMsg: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  color: '#059669',
}
const errorMsg: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  color: '#b91c1c',
}
const divider: React.CSSProperties = {
  height: 1,
  background: '#e5e7eb',
  margin: '20px 0 16px',
}
const copyBtn: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  border: '1px solid #e0e0e0',
  borderRadius: 8,
  background: '#f9fafb',
  cursor: 'pointer',
}
const visibilityRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 4,
}
const visibilityLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 2,
}
const visibilityHint: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
}
const toggleBtnPublic: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}
const toggleBtnPrivate: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  borderRadius: 8,
  background: '#374151',
  color: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}
const memberList: React.CSSProperties = {
  maxHeight: 160,
  overflowY: 'auto',
  marginBottom: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}
const memberRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  borderRadius: 6,
  background: '#f9fafb',
}
const memberInfo: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  flex: 1,
}
const memberName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const memberEmail: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const memberHint: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#9ca3af',
  padding: '8px 0',
}
const ownerBadge: React.CSSProperties = {
  fontSize: 11,
  color: '#6366f1',
  background: '#eef2ff',
  padding: '1px 6px',
  borderRadius: 4,
  flexShrink: 0,
}
const removeBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: '#9ca3af',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  lineHeight: 1,
}
