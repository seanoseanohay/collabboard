/**
 * Local undo/redo history for canvas operations.
 * Tracks add, remove, and modify actions for the local user only.
 * Remote changes (from other users) must pause tracking via the remoteChangeRef.
 *
 * Snapshots use scene (absolute) coordinates so that restoring objects that were
 * inside an ActiveSelection during capture lands them in the correct position.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'
import { getObjectId } from './boardSync'

type HistoryAction =
  | { type: 'add'; objectId: string; snapshot: Record<string, unknown> }
  | { type: 'remove'; objectId: string; snapshot: Record<string, unknown> }
  | { type: 'modify'; objectId: string; before: Record<string, unknown>; after: Record<string, unknown> }

const MAX_HISTORY = 100

export function createHistoryManager(
  canvas: Canvas,
  onStackChange?: (canUndo: boolean, canRedo: boolean) => void
) {
  const undoStack: HistoryAction[] = []
  const redoStack: HistoryAction[] = []
  let paused = false

  const notify = () => onStackChange?.(undoStack.length > 0, redoStack.length > 0)

  const pushAction = (action: HistoryAction) => {
    if (paused) return
    undoStack.push(action)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
    notify()
  }

  /** Serialize object with scene (absolute) coordinates — safe even when inside an ActiveSelection. */
  const snapshotWithSceneCoords = (obj: FabricObject): Record<string, unknown> => {
    const group = (obj as unknown as { group?: FabricObject & { calcOwnMatrix: () => number[] } }).group
    let payload = obj.toObject(['data', 'objects']) as Record<string, unknown>
    delete (payload as { layoutManager?: unknown }).layoutManager
    delete payload.data

    if (group) {
      const origProps = {
        left: obj.left, top: obj.top, angle: obj.angle,
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        skewX: obj.skewX, skewY: obj.skewY,
        flipX: obj.flipX, flipY: obj.flipY,
      }
      util.addTransformToObject(obj, group.calcOwnMatrix())
      payload = {
        ...payload,
        left: obj.left, top: obj.top, angle: obj.angle,
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        skewX: obj.skewX, skewY: obj.skewY,
        flipX: obj.flipX, flipY: obj.flipY,
      }
      obj.set(origProps)
    }

    return payload
  }

  const reAddObject = async (objectId: string, snapshot: Record<string, unknown>) => {
    try {
      const [revived] = await util.enlivenObjects<FabricObject>([{ ...snapshot, data: { id: objectId } }])
      if (revived) {
        revived.set('data', { id: objectId })
        canvas.add(revived)
        canvas.setActiveObject(revived)
        revived.setCoords()
        canvas.requestRenderAll()
      }
    } catch { /* ignore */ }
  }

  const removeObject = (objectId: string) => {
    const obj = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (obj) {
      canvas.discardActiveObject()
      canvas.remove(obj)
      canvas.requestRenderAll()
    }
  }

  const restoreModify = async (objectId: string, state: Record<string, unknown>) => {
    const obj = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (!obj) return
    try {
      const [revived] = await util.enlivenObjects<FabricObject>([{ ...state, data: { id: objectId } }])
      if (revived) {
        const serialized = revived.toObject(['data', 'objects']) as Record<string, unknown>
        delete serialized.data
        delete serialized.type
        delete (serialized as { layoutManager?: unknown }).layoutManager
        obj.set(serialized as Partial<FabricObject>)
        obj.setCoords()
        canvas.fire('object:modified', { target: obj })
        canvas.requestRenderAll()
      }
    } catch { /* ignore */ }
  }

  return {
    snapshot: snapshotWithSceneCoords,

    pushAdd(obj: FabricObject) {
      const id = getObjectId(obj)
      if (!id) return
      pushAction({ type: 'add', objectId: id, snapshot: snapshotWithSceneCoords(obj) })
    },

    pushRemove(objectId: string, snapshot: Record<string, unknown>) {
      pushAction({ type: 'remove', objectId, snapshot })
    },

    pushModify(objectId: string, before: Record<string, unknown>, after: Record<string, unknown>) {
      if (JSON.stringify(before) === JSON.stringify(after)) return
      pushAction({ type: 'modify', objectId, before, after })
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    async undo() {
      const action = undoStack.pop()
      if (!action) return
      redoStack.push(action)
      notify()
      paused = true
      try {
        if (action.type === 'add') removeObject(action.objectId)
        else if (action.type === 'remove') await reAddObject(action.objectId, action.snapshot)
        else if (action.type === 'modify') await restoreModify(action.objectId, action.before)
      } finally {
        paused = false
      }
    },

    async redo() {
      const action = redoStack.pop()
      if (!action) return
      undoStack.push(action)
      notify()
      paused = true
      try {
        if (action.type === 'add') await reAddObject(action.objectId, action.snapshot)
        else if (action.type === 'remove') removeObject(action.objectId)
        else if (action.type === 'modify') await restoreModify(action.objectId, action.after)
      } finally {
        paused = false
      }
    },

    clear() {
      undoStack.length = 0
      redoStack.length = 0
      notify()
    },

    pause() { paused = true },
    resume() { paused = false },
    isPaused() { return paused },
  }
}

export type HistoryManager = ReturnType<typeof createHistoryManager>
