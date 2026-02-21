import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { signOutUser } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUserBoards } from '@/features/boards/hooks/useUserBoards'
import {
  createBoard,
  joinBoard,
  deleteBoard,
  leaveBoard,
  updateBoardTitle,
  fetchPublicBoards,
  updateBoardVisibility,
} from '@/features/boards/api/boardsApi'
import { parseBoardIdFromShareInput, getShareUrl } from '@/shared/lib/shareLinks'
import { Z_INDEX } from '@/shared/constants/zIndex'
import type { BoardMeta } from '@/features/boards/api/boardsApi'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'
import { ParrotMascot } from './ParrotMascot'
import { WelcomeToast } from './WelcomeToast'
import { usePirateJokes } from '../hooks/usePirateJokes'

const WELCOME_MESSAGE =
  "Ahoy, new crew member! MeBoard is yer real-time pirate canvas. Hit '+ New Board' to chart yer first treasure map, then share the link with yer crew to draw, plan, and plunder ideas together! 🏴‍☠️"

type SortKey = 'recent' | 'name' | 'count'
type TabKey = 'my' | 'public' | 'all'

export function BoardListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { boards, loading } = useUserBoards(user?.uid)
  const [creating, setCreating] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null)
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [activeTab, setActiveTab] = useState<TabKey>('my')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const [publicBoards, setPublicBoards] = useState<BoardMeta[]>([])
  const [publicLoading, setPublicLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null)
  const parrotInitialized = useRef(false)
  const [parrotMsg, setParrotMsg] = useState<string | undefined>(undefined)
  const [showParrot, setShowParrot] = useState(true)
  const { pickJoke, loading: jokesLoading } = usePirateJokes()

  const userId = user?.uid ?? ''

  const closeMenu = useCallback(() => {
    setMenuBoardId(null)
    setMenuAnchorRect(null)
  }, [])

  useEffect(() => {
    if (parrotInitialized.current || loading || jokesLoading || !userId) return
    parrotInitialized.current = true
    const welcomeKey = `meboard:welcomed:${userId}`
    if (!localStorage.getItem(welcomeKey) && boards.length === 0) {
      setParrotMsg(WELCOME_MESSAGE)
      localStorage.setItem(welcomeKey, '1')
    } else {
      setParrotMsg(pickJoke())
    }
  }, [loading, jokesLoading, userId, boards.length, pickJoke])

  useEffect(() => {
    if (!menuBoardId) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      const anchor = document.querySelector('[data-board-kebab-anchor]')
      if (anchor?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuBoardId, closeMenu])

  const loadPublicBoards = useCallback(async () => {
    setPublicLoading(true)
    try {
      const data = await fetchPublicBoards()
      setPublicBoards(data)
    } catch {
      // silently fail — public tab just shows empty
    } finally {
      setPublicLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'public' || activeTab === 'all') {
      void loadPublicBoards()
    }
  }, [activeTab, loadPublicBoards])

  const handleTogglePublic = async (e: React.MouseEvent, board: BoardMeta) => {
    e.stopPropagation()
    closeMenu()
    const next = !board.isPublic
    try {
      await updateBoardVisibility(board.id, next)
      // publicBoards list will refresh next time the tab is visited
    } catch {
      // ignore
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const boardId = await createBoard(userId, 'Untitled Board')
      navigate(`/board/${boardId}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectBoard = (board: BoardMeta) => {
    if (renameBoardId) return
    navigate(`/board/${board.id}`)
  }

  const handleJoin = async () => {
    const boardId = parseBoardIdFromShareInput(joinInput)
    if (!boardId || !userId) {
      setJoinError('Paste a board link or ID')
      return
    }
    setJoinError(null)
    setJoining(true)
    try {
      await joinBoard(boardId, userId)
      navigate(`/board/${boardId}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Board not found')
    } finally {
      setJoining(false)
    }
  }

  const handleCopyLink = (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation()
    closeMenu()
    const url = getShareUrl(boardId)
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(boardId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleRenameClick = (e: React.MouseEvent, board: BoardMeta) => {
    e.stopPropagation()
    closeMenu()
    setRenameBoardId(board.id)
    setRenameValue(board.title)
  }

  const handleRenameSubmit = (boardId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed || !userId) {
      setRenameBoardId(null)
      return
    }
    void updateBoardTitle(boardId, userId, trimmed).then(() => {
      setRenameBoardId(null)
    })
  }

  const handleDeleteClick = (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation()
    closeMenu()
    setDeleteConfirmId(boardId)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !userId) return
    setDeleting(true)
    try {
      const board = [...boards, ...publicBoards].find((b) => b.id === deleteConfirmId)
      if (board?.ownerId === userId) {
        await deleteBoard(deleteConfirmId)
      } else {
        await leaveBoard(deleteConfirmId, userId)
      }
      setDeleteConfirmId(null)
    } finally {
      setDeleting(false)
    }
  }

  // Reset to page 0 whenever the filter/sort/tab changes
  useEffect(() => { setPage(0) }, [activeTab, searchQuery, sortBy])

  const myBoardIds = new Set(boards.map((b) => b.id))
  const tabBoards: BoardMeta[] =
    activeTab === 'my'
      ? boards
      : activeTab === 'public'
        ? publicBoards
        : // 'all' — user's boards + public boards not already in user's list
          [...boards, ...publicBoards.filter((b) => !myBoardIds.has(b.id))]

  const filteredBoards = tabBoards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const sortedBoards =
    sortBy === 'name'
      ? [...filteredBoards].sort((a, b) => a.title.localeCompare(b.title))
      : sortBy === 'count'
        ? [...filteredBoards].sort((a, b) => (b.objectCount ?? 0) - (a.objectCount ?? 0))
        : filteredBoards // 'recent' is already ordered by last_accessed_at from the API

  const totalPages = Math.ceil(sortedBoards.length / PAGE_SIZE)
  const visibleBoards = sortedBoards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={styles.container}>
      <NavBar isAuthenticated={!!user} onSignOut={() => signOutUser()} />
      <WelcomeToast />
      <header style={styles.header}>
        <h1 style={styles.title}>⚓ MeBoard</h1>
        <div style={styles.userRow}>
          <span style={styles.email}>{user?.email ?? 'Signed in'}</span>
        </div>
      </header>
      <main style={styles.main}>
        <div style={styles.tabBar}>
          {(['my', 'public', 'all'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
            >
              {tab === 'my' ? 'My Boards' : tab === 'public' ? 'Public' : 'All'}
            </button>
          ))}
        </div>

        <div style={styles.toolbar}>
          <div style={styles.toolbarTop}>
            <input
              type="text"
              placeholder="Search boards…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              aria-label="Search boards"
            />
            <div style={styles.sortGroup}>
              <button
                type="button"
                onClick={() => setSortBy('recent')}
                style={sortBy === 'recent' ? { ...styles.sortBtn, ...styles.sortBtnActive } : styles.sortBtn}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortBy('name')}
                style={sortBy === 'name' ? { ...styles.sortBtn, ...styles.sortBtnActive } : styles.sortBtn}
              >
                Name
              </button>
              <button
                type="button"
                onClick={() => setSortBy('count')}
                style={sortBy === 'count' ? { ...styles.sortBtn, ...styles.sortBtnActive } : styles.sortBtn}
              >
                Count
              </button>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              style={styles.createBtn}
            >
              {creating ? 'Creating…' : '+ New Board'}
            </button>
          </div>
          <div style={styles.joinRow}>
            <input
              type="text"
              placeholder="Paste board link or ID to join"
              value={joinInput}
              onChange={(e) => {
                setJoinInput(e.target.value)
                setJoinError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              style={styles.joinInput}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              style={styles.joinBtn}
            >
              {joining ? 'Joining…' : 'Join Board'}
            </button>
          </div>
          {joinError && <p style={styles.joinError}>{joinError}</p>}
        </div>

        {loading || (publicLoading && activeTab !== 'my') ? (
          <div style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={styles.skeletonCard} />
            ))}
          </div>
        ) : tabBoards.length === 0 ? (
          <div style={styles.emptyWrap}>
            {activeTab === 'public' ? (
              <p style={styles.empty}>No public boards yet.</p>
            ) : (
              <>
                <p style={styles.empty}>No boards yet. Create one to get started.</p>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  style={styles.emptyCreateBtn}
                >
                  + New Board
                </button>
              </>
            )}
          </div>
        ) : visibleBoards.length === 0 ? (
          <div style={styles.emptyWrap}>
            <p style={styles.empty}>No boards match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {visibleBoards.map((board) => (
              <div key={board.id} style={styles.gridItem}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectBoard(board)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleSelectBoard(board)
                  }
                  style={styles.boardCard}
                >
                  <div style={styles.boardThumb}>
                    {board.thumbnailUrl ? (
                      <img
                        src={board.thumbnailUrl}
                        alt={board.title}
                        style={styles.boardThumbImg}
                        draggable={false}
                      />
                    ) : (
                      <div style={styles.boardThumbPlaceholder} />
                    )}
                  </div>
                  <div style={styles.boardCardHeader}>
                    <div style={styles.boardCardMain}>
                      {renameBoardId === board.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(board.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur()
                            }
                            if (e.key === 'Escape') {
                              setRenameBoardId(null)
                              setRenameValue(board.title)
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={styles.renameInput}
                          autoFocus
                          aria-label="Rename board"
                        />
                      ) : (
                        <span style={styles.boardTitle}>{board.title}</span>
                      )}
                    </div>
                    <div style={styles.actionsWrap}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const btn = e.currentTarget as HTMLButtonElement
                          if (menuBoardId === board.id) {
                            setMenuBoardId(null)
                            setMenuAnchorRect(null)
                          } else {
                            setMenuBoardId(board.id)
                            setMenuAnchorRect(btn.getBoundingClientRect())
                          }
                        }}
                        style={styles.kebabBtn}
                        aria-label="Board actions"
                        aria-expanded={menuBoardId === board.id}
                        data-board-kebab-anchor={menuBoardId === board.id ? '' : undefined}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                  <div style={styles.boardMeta}>
                    <span style={styles.boardDate}>
                      {formatLastAccessed(board.lastAccessedAt ?? board.createdAt)}
                    </span>
                    {board.objectCount !== undefined && board.objectCount > 0 && (
                      <span style={styles.objectCount}>
                        {board.objectCount} {board.objectCount === 1 ? 'object' : 'objects'}
                      </span>
                    )}
                    {board.isPublic && (
                      <span style={styles.publicBadge}>🌐 Public</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={page === 0 ? { ...styles.pageBtn, ...styles.pageBtnDisabled } : styles.pageBtn}
            >
              ← Prev
            </button>
            <span style={styles.pageInfo}>
              {page + 1} / {totalPages}
              <span style={styles.pageTotal}> ({sortedBoards.length} boards)</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={page >= totalPages - 1 ? { ...styles.pageBtn, ...styles.pageBtnDisabled } : styles.pageBtn}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {menuBoardId && menuAnchorRect && (() => {
        const board = [...boards, ...publicBoards].find((b) => b.id === menuBoardId)
        if (!board) return null
        return createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuAnchorRect.top - 4,
              right: typeof window !== 'undefined' ? window.innerWidth - menuAnchorRect.right : menuAnchorRect.right,
              transform: 'translateY(-100%)',
              minWidth: 160,
              padding: 4,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: Z_INDEX.DROPDOWN,
            }}
          >
            <button
              type="button"
              style={styles.menuItem}
              onClick={(e) => handleCopyLink(e, board.id)}
            >
              {copiedId === board.id ? 'Copied!' : 'Copy share link'}
            </button>
            {board.ownerId === userId && (
              <>
                <button
                  type="button"
                  style={styles.menuItem}
                  onClick={(e) => handleRenameClick(e, board)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  style={styles.menuItem}
                  onClick={(e) => void handleTogglePublic(e, board)}
                >
                  {board.isPublic ? '🔒 Make private' : '🌐 Make public'}
                </button>
              </>
            )}
            <button
              type="button"
              style={{ ...styles.menuItem, ...styles.menuItemDanger }}
              onClick={(e) => handleDeleteClick(e, board.id)}
            >
              {board.ownerId === userId ? 'Delete' : 'Leave board'}
            </button>
          </div>,
          document.body
        )
      })()}

      {deleteConfirmId && (() => {
        const target = [...boards, ...publicBoards].find((b) => b.id === deleteConfirmId)
        const isOwner = target?.ownerId === userId
        return (
          <div style={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div style={styles.modal}>
              <h2 id="delete-title" style={styles.modalTitle}>
                {isOwner ? 'Delete this board?' : 'Leave this board?'}
              </h2>
              <p style={styles.modalBody}>
                {isOwner
                  ? "This can\u2019t be undone."
                  : 'This board will be removed from your list. You can rejoin later with the share link.'}
              </p>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  style={styles.deleteBtn}
                >
                  {deleting ? (isOwner ? 'Deleting\u2026' : 'Leaving\u2026') : (isOwner ? 'Delete' : 'Leave')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {showParrot && (
        <ParrotMascot
          message={parrotMsg}
          onDismiss={() => setShowParrot(false)}
          onNewMessage={() => setParrotMsg(pickJoke())}
        />
      )}
      <Footer />
    </div>
  )
}

function formatLastAccessed(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Opened just now'
  if (diff < 3600_000) return `Opened ${Math.floor(diff / 60000)}m ago`
  if (diff < 86400_000) return `Opened ${Math.floor(diff / 3600000)}h ago`
  if (diff < 7 * 86400_000) return `Opened ${Math.floor(diff / 86400000)}d ago`
  return `Opened ${d.toLocaleDateString()}`
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 56,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1e293b',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  email: {
    fontSize: 13,
    color: '#6b7280',
  },
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
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
  main: {
    flex: 1,
    padding: '24px 24px 24px',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    paddingRight: 245,
  },
  tabBtn: {
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabBtnActive: {
    background: '#374151',
    color: '#fff',
    borderColor: '#374151',
  },
  toolbar: {
    marginBottom: 20,
    paddingRight: 245,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  toolbarTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: '9px 14px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#374151',
    outline: 'none',
  },
  sortGroup: {
    display: 'flex',
    gap: 4,
    background: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
  },
  sortBtn: {
    padding: '5px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
  },
  sortBtnActive: {
    background: '#fff',
    color: '#374151',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  joinRow: {
    display: 'flex',
    gap: 8,
  },
  joinInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#374151',
  },
  joinBtn: {
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  joinError: {
    margin: 0,
    fontSize: 13,
    color: '#b91c1c',
  },
  createBtn: {
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    background: '#374151',
    color: '#fff',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gridAutoRows: 'auto',
    columnGap: 16,
    rowGap: 20,
    alignItems: 'stretch',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    paddingRight: 245,
  },
  gridItem: {
    minWidth: 0,
    display: 'flex',
  },
  skeletonCard: {
    aspectRatio: '4/3',
    borderRadius: 12,
    background: '#e5e7eb',
    minHeight: 140,
  },
  emptyWrap: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  empty: {
    color: '#6b7280',
    fontSize: 16,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    background: '#374151',
    color: '#fff',
    cursor: 'pointer',
  },
  boardCard: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  boardThumb: {
    width: '100%',
    height: 130,
    flexShrink: 0,
    background: '#f3f4f6',
    overflow: 'hidden',
  },
  boardThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  boardThumbPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)',
  },
  boardCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
    padding: '10px 12px 0',
  },
  boardCardMain: {
    flex: 1,
    minWidth: 0,
  },
  boardTitle: {
    fontWeight: 500,
    color: '#374151',
    fontSize: 15,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  renameInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: 15,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
  },
  boardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
    padding: '0 12px',
    flexWrap: 'wrap' as const,
  },
  boardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  objectCount: {
    fontSize: 11,
    color: '#9ca3af',
  },
  publicBadge: {
    fontSize: 11,
    color: '#059669',
    background: '#ecfdf5',
    padding: '1px 6px',
    borderRadius: 4,
  },
  actionsWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  kebabBtn: {
    width: 32,
    height: 32,
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#6b7280',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
  },
  menu: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: 4,
    minWidth: 160,
    padding: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: Z_INDEX.DROPDOWN,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: 13,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#374151',
    cursor: 'pointer',
  },
  menuItemDanger: {
    color: '#b91c1c',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    maxWidth: 360,
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#374151',
  },
  modalBody: {
    margin: '12px 0 20px',
    fontSize: 14,
    color: '#6b7280',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
    paddingRight: 245,
  },
  pageBtn: {
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  pageBtnDisabled: {
    color: '#d1d5db',
    cursor: 'not-allowed',
  },
  pageInfo: {
    fontSize: 13,
    color: '#374151',
    fontWeight: 500,
  },
  pageTotal: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  deleteBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: '#b91c1c',
    color: '#fff',
    cursor: 'pointer',
  },
}
