/**
 * RTDB delta sync for board documents. Object-level patches only.
 */

import {
  ref,
  update,
  remove,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database'
import { getDatabaseInstance } from '@/shared/lib/firebase/config'

const DOCUMENTS_PATH = 'documents'

export type DocumentDelta = { objectId: string; data: Record<string, unknown> | null }

export function getDocumentsPath(boardId: string): string {
  return `boards/${boardId}/${DOCUMENTS_PATH}`
}

export async function writeDocument(
  boardId: string,
  objectId: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = getDatabaseInstance()
  const path = `${getDocumentsPath(boardId)}/${objectId}`
  await update(ref(db), {
    [path]: {
      ...data,
      updatedAt: serverTimestamp(),
    },
  })
}

export async function deleteDocument(
  boardId: string,
  objectId: string
): Promise<void> {
  const db = getDatabaseInstance()
  const docRef = ref(db, `${getDocumentsPath(boardId)}/${objectId}`)
  await remove(docRef)
}

export function subscribeToDocuments(
  boardId: string,
  callbacks: {
    onAdded: (objectId: string, data: Record<string, unknown>) => void
    onChanged: (objectId: string, data: Record<string, unknown>) => void
    onRemoved: (objectId: string) => void
  }
): Unsubscribe {
  const db = getDatabaseInstance()
  const docsRef = ref(db, getDocumentsPath(boardId))

  const unsubAdded = onChildAdded(docsRef, (snapshot) => {
    const val = snapshot.val()
    if (val && typeof val === 'object') {
      callbacks.onAdded(snapshot.key!, val)
    }
  })
  const unsubChanged = onChildChanged(docsRef, (snapshot) => {
    const val = snapshot.val()
    if (val && typeof val === 'object') {
      callbacks.onChanged(snapshot.key!, val)
    }
  })
  const unsubRemoved = onChildRemoved(docsRef, (snapshot) => {
    callbacks.onRemoved(snapshot.key!)
  })

  return () => {
    unsubAdded()
    unsubChanged()
    unsubRemoved()
  }
}
