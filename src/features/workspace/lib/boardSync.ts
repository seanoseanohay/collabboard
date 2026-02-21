/**
 * Connects Fabric canvas to Supabase for delta sync.
 * Document sync: always runs for position/add/remove updates.
 * Lock sync: optional, acquire on selection, release on deselection.
 * Split so document sync is NOT torn down when auth (lock options) changes.
 *
 * Re-exports from boardSyncUtils, documentSync, and lockSync for backward compatibility.
 */

import type { Canvas } from 'fabric'
import {
  getObjectId,
  setObjectId,
  getObjectZIndex,
  setObjectZIndex,
  sortCanvasByZIndex,
  applyLockState,
  type BoardSyncLockOptions,
  type LockStateCallbackRef,
  type MoveDeltaPayload,
} from './boardSyncUtils'
import { setupDocumentSync } from './documentSync'
import { setupLockSync } from './lockSync'

export {
  getObjectId,
  setObjectId,
  getObjectZIndex,
  setObjectZIndex,
  sortCanvasByZIndex,
  applyLockState,
  setupDocumentSync,
  setupLockSync,
}
export type { BoardSyncLockOptions, LockStateCallbackRef, MoveDeltaPayload }

/** Single-call setup for document + optional lock sync. Used by FabricCanvas. */
export function setupBoardSync(
  canvas: Canvas,
  boardId: string,
  lockOptions?: BoardSyncLockOptions
): () => void {
  const applyLockStateCallbackRef: LockStateCallbackRef = { current: null }
  const docCleanup = setupDocumentSync(canvas, boardId, applyLockStateCallbackRef)
  if (!lockOptions) return docCleanup
  const lockCleanup = setupLockSync(canvas, boardId, lockOptions, applyLockStateCallbackRef)
  return () => {
    lockCleanup()
    docCleanup()
  }
}
