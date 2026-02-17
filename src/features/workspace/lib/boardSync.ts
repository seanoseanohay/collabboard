/**
 * Connects Fabric canvas to RTDB for delta sync.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'
import {
  subscribeToDocuments,
  writeDocument,
  deleteDocument,
} from '../api/documentsApi'

const OBJ_ID_KEY = 'id'

export function getObjectId(obj: FabricObject): string | null {
  const data = obj.get('data') as { id?: string } | undefined
  return (data?.id ?? null) as string | null
}

export function setObjectId(obj: FabricObject, id: string): void {
  obj.set('data', { ...(obj.get('data') as object), [OBJ_ID_KEY]: id })
}

export function setupBoardSync(
  canvas: Canvas,
  boardId: string
): () => void {
  let isApplyingRemote = false

  const stripSyncFields = (d: Record<string, unknown>) => {
    const { updatedAt, ...rest } = d
    return rest
  }

  const applyRemote = async (
    objectId: string,
    data: Record<string, unknown>
  ) => {
    const clean = stripSyncFields(data)
    const existing = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (existing) {
      try {
        const objData = { ...clean, data: { id: objectId } }
        const [revived] = await util.enlivenObjects<FabricObject>([objData])
        if (revived) {
          const serialized = revived.toObject(['data']) as Record<string, unknown>
          delete serialized.data
          existing.set(serialized)
          canvas.requestRenderAll()
        }
      } catch {
        // Ignore deserialization errors
      }
      return
    }
    try {
      const objData = { ...clean, data: { id: objectId } }
      const [revived] = await util.enlivenObjects<FabricObject>([objData])
      if (revived) {
        revived.set('data', { id: objectId })
        isApplyingRemote = true
        canvas.add(revived)
        canvas.requestRenderAll()
        isApplyingRemote = false
      }
    } catch {
      // Ignore deserialization errors
    }
  }

  const removeRemote = (objectId: string) => {
    const obj = canvas.getObjects().find((o) => getObjectId(o) === objectId)
    if (obj) {
      isApplyingRemote = true
      canvas.remove(obj)
      canvas.requestRenderAll()
      isApplyingRemote = false
    }
  }

  const emitAdd = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    const payload = obj.toObject(['data']) as Record<string, unknown>
    delete payload.data
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const emitModify = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    const payload = obj.toObject(['data']) as Record<string, unknown>
    delete payload.data
    writeDocument(boardId, id, payload).catch(console.error)
  }

  const emitRemove = (obj: FabricObject) => {
    const id = getObjectId(obj)
    if (!id || isApplyingRemote) return
    deleteDocument(boardId, id).catch(console.error)
  }

  const unsub = subscribeToDocuments(boardId, {
    onAdded: (objectId, data) => applyRemote(objectId, data),
    onChanged: (objectId, data) => applyRemote(objectId, data),
    onRemoved: removeRemote,
  })

  canvas.on('object:added', (e) => {
    if (e.target) emitAdd(e.target)
  })
  canvas.on('object:modified', (e) => {
    if (e.target) emitModify(e.target)
  })
  canvas.on('object:removed', (e) => {
    if (e.target) emitRemove(e.target)
  })

  return () => {
    unsub()
    canvas.off('object:added')
    canvas.off('object:modified')
    canvas.off('object:removed')
  }
}
