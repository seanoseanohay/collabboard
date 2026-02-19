/**
 * Factory for Fabric canvas history event handlers.
 * Returns handlers that record local add/modify/remove operations into the
 * HistoryManager, while skipping changes that originated from remote sync.
 */

import type { MutableRefObject } from 'react'
import type { FabricObject } from 'fabric'
import type { HistoryManager } from './historyManager'
import { getObjectId } from './boardSync'

export interface HistoryHandlers {
  handleMoveForHistory: (e: { target?: FabricObject }) => void
  handleModifiedForHistory: (e: { target?: FabricObject }) => void
  handleAddedForHistory: (e: { target?: FabricObject }) => void
  handleSelectionClearedForHistory: () => void
  handleTextEditingEntered: (e: { target?: FabricObject }) => void
  handleTextEditingExited: (e: { target?: FabricObject }) => void
}

export function createHistoryEventHandlers(
  history: HistoryManager,
  isRemoteChangeRef: MutableRefObject<boolean>,
  preModifySnapshotsRef: MutableRefObject<Map<string, Record<string, unknown>>>,
  getObjectsToHistorize: (target: FabricObject) => FabricObject[]
): HistoryHandlers {
  let textBeforeSnapshot: { objectId: string; snapshot: Record<string, unknown> } | null = null

  const handleMoveForHistory = (e: { target?: FabricObject }) => {
    if (!e.target || isRemoteChangeRef.current || history.isPaused()) return
    getObjectsToHistorize(e.target).forEach((obj) => {
      const id = getObjectId(obj)
      if (id && !preModifySnapshotsRef.current.has(id)) {
        preModifySnapshotsRef.current.set(id, history.snapshot(obj))
      }
    })
  }

  const handleModifiedForHistory = (e: { target?: FabricObject }) => {
    if (!e.target || isRemoteChangeRef.current || history.isPaused()) return
    getObjectsToHistorize(e.target).forEach((obj) => {
      const id = getObjectId(obj)
      if (!id) return
      const before = preModifySnapshotsRef.current.get(id)
      if (!before) return
      history.pushModify(id, before, history.snapshot(obj))
    })
    preModifySnapshotsRef.current.clear()
  }

  const handleAddedForHistory = (e: { target?: FabricObject }) => {
    const obj = e.target
    if (!obj || isRemoteChangeRef.current || history.isPaused()) return
    history.pushAdd(obj)
  }

  const handleSelectionClearedForHistory = () => {
    preModifySnapshotsRef.current.clear()
  }

  const handleTextEditingEntered = (e: { target?: FabricObject }) => {
    const textObj = e.target
    if (!textObj || isRemoteChangeRef.current) return
    const parent = (textObj as unknown as { group?: FabricObject }).group || textObj
    const id = getObjectId(parent)
    if (!id) return
    textBeforeSnapshot = { objectId: id, snapshot: history.snapshot(parent) }
  }

  const handleTextEditingExited = (e: { target?: FabricObject }) => {
    const textObj = e.target
    if (!textObj || !textBeforeSnapshot || history.isPaused()) return
    const parent = (textObj as unknown as { group?: FabricObject }).group || textObj
    const id = getObjectId(parent)
    if (!id || id !== textBeforeSnapshot.objectId) return
    history.pushModify(id, textBeforeSnapshot.snapshot, history.snapshot(parent))
    textBeforeSnapshot = null
  }

  return {
    handleMoveForHistory,
    handleModifiedForHistory,
    handleAddedForHistory,
    handleSelectionClearedForHistory,
    handleTextEditingEntered,
    handleTextEditingExited,
  }
}
