/**
 * Boards feature module.
 * Board list, create, select. Private by default.
 */

export { BoardListPage } from './components/BoardListPage'
export { useUserBoards } from './hooks/useUserBoards'
export {
  createBoard,
  joinBoard,
  subscribeToUserBoards,
  type BoardMeta,
} from './api/boardsApi'
