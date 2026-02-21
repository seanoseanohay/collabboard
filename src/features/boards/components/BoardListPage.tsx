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
import { formatLastAccessed } from '../lib/boardListUtils'
import { boardListStyles } from '../lib/boardListStyles'
import { NavBar } from '@/shared/components/NavBar'
import { Footer } from '@/shared/components/Footer'
import { ParrotMascot } from './ParrotMascot'
import { WelcomeToast } from './WelcomeToast'
import { usePirateJokes } from '../hooks/usePirateJokes'

const WELCOME_MESSAGE =
  "Ahoy, new crew member! MeBoard is yer real-time pirate canvas. Hit '+ New Board' to chart yer first treasure map, then share the link with yer crew to draw, plan, and plunder ideas together! 🏴‍☠️"

type SortKey = 'recent' | 'name' | 'count'
type TabKey = 'my' | 'public' | 'all'
type BoardTypeFilter = 'all' | 'standard' | 'explorer'

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
  const [boardTypeFilter, setBoardTypeFilter] = useState<BoardTypeFilter>('all')
  const [activeTab, setActiveTab] = useState<TabKey>('my')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const [publicBoards, setPublicBoards] = useState<BoardMeta[]>([])
  const [publicLoading, setPublicLoading] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const createBtnRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (!createMenuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (createMenuRef.current?.contains(target)) return
      if (createBtnRef.current?.contains(target)) return
      setCreateMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [createMenuOpen])

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

  const handleCreate = async (mode: 'standard' | 'explorer' = 'standard') => {
    setCreating(true)
    setCreateMenuOpen(false)
    try {
      const title = mode === 'explorer' ? 'Untitled Expedition' : 'Untitled Board'
      const boardId = await createBoard(userId, title, mode)
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
  useEffect(() => { setPage(0) }, [activeTab, searchQuery, sortBy, boardTypeFilter])

  const myBoardIds = new Set(boards.map((b) => b.id))
  const tabBoards: BoardMeta[] =
    activeTab === 'my'
      ? boards
      : activeTab === 'public'
        ? publicBoards
        : // 'all' — user's boards + public boards not already in user's list
          [...boards, ...publicBoards.filter((b) => !myBoardIds.has(b.id))]

  const filteredBoards = tabBoards.filter((b) => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType =
      boardTypeFilter === 'all' ||
      boardTypeFilter === (b.boardMode ?? 'standard')
    return matchesSearch && matchesType
  })
  const sortedBoards =
    sortBy === 'name'
      ? [...filteredBoards].sort((a, b) => a.title.localeCompare(b.title))
      : sortBy === 'count'
        ? [...filteredBoards].sort((a, b) => (b.objectCount ?? 0) - (a.objectCount ?? 0))
        : filteredBoards // 'recent' is already ordered by last_accessed_at from the API

  const totalPages = Math.ceil(sortedBoards.length / PAGE_SIZE)
  const visibleBoards = sortedBoards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={boardListStyles.container}>
      <NavBar isAuthenticated={!!user} onSignOut={() => signOutUser()} />
      <WelcomeToast />
      <header style={boardListStyles.header}>
        <h1 style={boardListStyles.title}>⚓ MeBoard</h1>
        <div style={boardListStyles.userRow}>
          <span style={boardListStyles.email}>{user?.email ?? 'Signed in'}</span>
        </div>
      </header>
      <main style={boardListStyles.main}>
        <div style={boardListStyles.tabBar}>
          {(['my', 'public', 'all'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? { ...boardListStyles.tabBtn, ...boardListStyles.tabBtnActive } : boardListStyles.tabBtn}
            >
              {tab === 'my' ? 'My Boards' : tab === 'public' ? 'Public' : 'All'}
            </button>
          ))}
        </div>

        <div style={boardListStyles.toolbar}>
          <div style={boardListStyles.toolbarTop}>
            <input
              type="text"
              placeholder="Search boards…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={boardListStyles.searchInput}
              aria-label="Search boards"
            />
            <div style={boardListStyles.sortGroup}>
              <button
                type="button"
                onClick={() => setSortBy('recent')}
                style={sortBy === 'recent' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortBy('name')}
                style={sortBy === 'name' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                Name
              </button>
              <button
                type="button"
                onClick={() => setSortBy('count')}
                style={sortBy === 'count' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                Count
              </button>
            </div>
            <div style={boardListStyles.sortGroup} role="group" aria-label="Filter by board type">
              <button
                type="button"
                onClick={() => setBoardTypeFilter('all')}
                style={boardTypeFilter === 'all' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setBoardTypeFilter('standard')}
                style={boardTypeFilter === 'standard' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                ⚓ Boards
              </button>
              <button
                type="button"
                onClick={() => setBoardTypeFilter('explorer')}
                style={boardTypeFilter === 'explorer' ? { ...boardListStyles.sortBtn, ...boardListStyles.sortBtnActive } : boardListStyles.sortBtn}
              >
                🗺️ Expeditions
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                ref={createBtnRef}
                type="button"
                onClick={() => setCreateMenuOpen((v) => !v)}
                disabled={creating}
                style={boardListStyles.createBtn}
              >
                {creating ? 'Creating…' : '+ New Board ▾'}
              </button>
              {createMenuOpen && (
                <div ref={createMenuRef} style={boardListStyles.createMenu}>
                  <button
                    type="button"
                    style={boardListStyles.createMenuItem}
                    onClick={() => void handleCreate('standard')}
                  >
                    ⚓ New Board
                  </button>
                  <button
                    type="button"
                    style={boardListStyles.createMenuItem}
                    onClick={() => void handleCreate('explorer')}
                  >
                    🗺️ New Expedition
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={boardListStyles.joinRow}>
            <input
              type="text"
              placeholder="Paste board link or ID to join"
              value={joinInput}
              onChange={(e) => {
                setJoinInput(e.target.value)
                setJoinError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              style={boardListStyles.joinInput}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              style={boardListStyles.joinBtn}
            >
              {joining ? 'Joining…' : 'Join Board'}
            </button>
          </div>
          {joinError && <p style={boardListStyles.joinError}>{joinError}</p>}
        </div>

        {loading || (publicLoading && activeTab !== 'my') ? (
          <div style={boardListStyles.grid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={boardListStyles.skeletonCard} />
            ))}
          </div>
        ) : tabBoards.length === 0 ? (
          <div style={boardListStyles.emptyWrap}>
            {activeTab === 'public' ? (
              <p style={boardListStyles.empty}>No public boards yet.</p>
            ) : (
              <>
                <p style={boardListStyles.empty}>No boards yet. Create one to get started.</p>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => setCreateMenuOpen((v) => !v)}
                    disabled={creating}
                    style={boardListStyles.emptyCreateBtn}
                  >
                    {creating ? 'Creating…' : '+ New Board ▾'}
                  </button>
                  {createMenuOpen && (
                    <div ref={createMenuRef} style={boardListStyles.createMenu}>
                      <button
                        type="button"
                        style={boardListStyles.createMenuItem}
                        onClick={() => void handleCreate('standard')}
                      >
                        ⚓ New Board
                      </button>
                      <button
                        type="button"
                        style={boardListStyles.createMenuItem}
                        onClick={() => void handleCreate('explorer')}
                      >
                        🗺️ New Expedition
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : visibleBoards.length === 0 ? (
          <div style={boardListStyles.emptyWrap}>
            <p style={boardListStyles.empty}>
              {searchQuery && boardTypeFilter !== 'all'
                ? 'No boards match your filters.'
                : searchQuery
                  ? `No boards match "${searchQuery}".`
                  : boardTypeFilter === 'explorer'
                    ? 'No expeditions found.'
                    : boardTypeFilter === 'standard'
                      ? 'No boards found.'
                      : 'No boards found.'}
            </p>
          </div>
        ) : (
          <div style={boardListStyles.grid}>
            {visibleBoards.map((board) => (
              <div key={board.id} style={boardListStyles.gridItem}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectBoard(board)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleSelectBoard(board)
                  }
                  style={boardListStyles.boardCard}
                >
                  <div style={boardListStyles.boardThumb}>
                    {board.thumbnailUrl ? (
                      <img
                        src={board.thumbnailUrl}
                        alt={board.title}
                        style={boardListStyles.boardThumbImg}
                        draggable={false}
                      />
                    ) : (
                      <div style={boardListStyles.boardThumbPlaceholder} />
                    )}
                  </div>
                  <div style={boardListStyles.boardCardHeader}>
                    <div style={boardListStyles.boardCardMain}>
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
                          style={boardListStyles.renameInput}
                          autoFocus
                          aria-label="Rename board"
                        />
                      ) : (
                        <span style={boardListStyles.boardTitle}>{board.title}</span>
                      )}
                    </div>
                    <div style={boardListStyles.actionsWrap}>
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
                        style={boardListStyles.kebabBtn}
                        aria-label="Board actions"
                        aria-expanded={menuBoardId === board.id}
                        data-board-kebab-anchor={menuBoardId === board.id ? '' : undefined}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                  <div style={boardListStyles.boardMeta}>
                    <span style={boardListStyles.boardDate}>
                      {formatLastAccessed(board.lastAccessedAt ?? board.createdAt)}
                    </span>
                    {board.objectCount !== undefined && board.objectCount > 0 && (
                      <span style={boardListStyles.objectCount}>
                        {board.objectCount} {board.objectCount === 1 ? 'object' : 'objects'}
                      </span>
                    )}
                    {board.boardMode === 'explorer' && (
                      <span style={boardListStyles.explorerBadge}>🗺️ Expedition</span>
                    )}
                    {board.isPublic && (
                      <span style={boardListStyles.publicBadge}>🌐 Public</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={boardListStyles.pagination}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={page === 0 ? { ...boardListStyles.pageBtn, ...boardListStyles.pageBtnDisabled } : boardListStyles.pageBtn}
            >
              ← Prev
            </button>
            <span style={boardListStyles.pageInfo}>
              {page + 1} / {totalPages}
              <span style={boardListStyles.pageTotal}> ({sortedBoards.length} boards)</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={page >= totalPages - 1 ? { ...boardListStyles.pageBtn, ...boardListStyles.pageBtnDisabled } : boardListStyles.pageBtn}
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
              bottom: window.innerHeight - menuAnchorRect.top + 4,
              right: window.innerWidth - menuAnchorRect.right,
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
              style={boardListStyles.menuItem}
              onClick={(e) => handleCopyLink(e, board.id)}
            >
              {copiedId === board.id ? 'Copied!' : 'Copy share link'}
            </button>
            {board.ownerId === userId && (
              <>
                <button
                  type="button"
                  style={boardListStyles.menuItem}
                  onClick={(e) => handleRenameClick(e, board)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  style={boardListStyles.menuItem}
                  onClick={(e) => void handleTogglePublic(e, board)}
                >
                  {board.isPublic ? '🔒 Make private' : '🌐 Make public'}
                </button>
              </>
            )}
            <button
              type="button"
              style={{ ...boardListStyles.menuItem, ...boardListStyles.menuItemDanger }}
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
          <div style={boardListStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div style={boardListStyles.modal}>
              <h2 id="delete-title" style={boardListStyles.modalTitle}>
                {isOwner ? 'Delete this board?' : 'Leave this board?'}
              </h2>
              <p style={boardListStyles.modalBody}>
                {isOwner
                  ? "This can\u2019t be undone."
                  : 'This board will be removed from your list. You can rejoin later with the share link.'}
              </p>
              <div style={boardListStyles.modalActions}>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  style={boardListStyles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  style={boardListStyles.deleteBtn}
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

