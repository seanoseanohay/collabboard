/**
 * Shared utilities for board sync (document + lock). Used by documentSync and lockSync.
 */

import type { Canvas, FabricObject } from 'fabric'
import { util } from 'fabric'
import type { LockEntry } from '../api/locksApi'

const OBJ_ID_KEY = 'id'
const ZINDEX_KEY = 'zIndex'

export function getObjectId(obj: FabricObject): string | null {
  const data = obj.get('data') as { id?: string } | undefined
  return (data?.id ?? null) as string | null
}

export function setObjectId(obj: FabricObject, id: string): void {
  obj.set('data', { ...(obj.get('data') as object), [OBJ_ID_KEY]: id })
}

export function getObjectZIndex(obj: FabricObject): number {
  const z = obj.get(ZINDEX_KEY) as number | undefined
  return typeof z === 'number' && !Number.isNaN(z) ? z : 0
}

export function setObjectZIndex(obj: FabricObject, z: number): void {
  obj.set(ZINDEX_KEY, z)
}

/** Sort canvas objects by zIndex (ascending); reorder so lowest is at back. */
export function sortCanvasByZIndex(canvas: Canvas): void {
  const internal = canvas as unknown as { _objects: FabricObject[] }
  if (internal._objects) {
    internal._objects.sort((a: FabricObject, b: FabricObject) => getObjectZIndex(a) - getObjectZIndex(b))
  } else {
    const objects = canvas.getObjects().slice()
    objects.sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
    objects.forEach((obj) => canvas.bringObjectToFront(obj))
  }
  canvas.requestRenderAll()
}

export interface BoardSyncLockOptions {
  userId: string
  userName: string
}

export type LockStateCallbackRef = { current: (() => void) | null }

export function applyLockState(
  canvas: Canvas,
  locks: LockEntry[],
  currentUserId: string
): void {
  const lockedByOthers = new Set(
    locks.filter((l) => l.userId !== currentUserId).map((l) => l.objectId)
  )

  for (const obj of canvas.getObjects()) {
    const id = getObjectId(obj)
    if (!id) continue
    const locked = lockedByOthers.has(id)

    obj.set({
      selectable: !locked,
      evented: !locked,
      hoverCursor: locked ? 'not-allowed' : undefined,
    })

    if (obj.type === 'group' && 'getObjects' in obj) {
      const children = (obj as { getObjects: () => unknown[] }).getObjects()
      children.forEach((child: unknown) => {
        if (child && typeof child === 'object' && 'set' in child) {
          (child as { set: (props: { selectable: boolean; evented: boolean }) => void }).set({
            selectable: false,
            evented: false,
          })
        }
      })
    }
  }

  canvas.requestRenderAll()
}

/** Override payload with scene (absolute) coords when object is inside a group. */
export function payloadWithSceneCoords(
  obj: FabricObject,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const group = (obj as unknown as { group?: FabricObject & { calcOwnMatrix: () => number[] } }).group
  if (!group) return payload
  const origProps = {
    left: obj.left, top: obj.top, angle: obj.angle,
    scaleX: obj.scaleX, scaleY: obj.scaleY,
    skewX: obj.skewX, skewY: obj.skewY,
    flipX: obj.flipX, flipY: obj.flipY,
  }
  util.addTransformToObject(obj, group.calcOwnMatrix())
  const result = {
    ...payload,
    left: obj.left, top: obj.top, angle: obj.angle,
    scaleX: obj.scaleX, scaleY: obj.scaleY,
    skewX: obj.skewX, skewY: obj.skewY,
    flipX: obj.flipX, flipY: obj.flipY,
  }
  obj.set(origProps)
  return result
}

/** Scene position of event target (single object or ActiveSelection centroid). */
export function getTargetSceneCenter(target: FabricObject): { x: number; y: number } {
  if ('getObjects' in target) {
    const children = (target as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o))
    if (children.length > 0) {
      let sx = 0
      let sy = 0
      for (const obj of children) {
        const matrix = obj.calcTransformMatrix()
        const d = util.qrDecompose(matrix)
        sx += d.translateX
        sy += d.translateY
      }
      return { x: sx / children.length, y: sy / children.length }
    }
  }
  const matrix = target.calcTransformMatrix()
  const d = util.qrDecompose(matrix)
  return { x: d.translateX, y: d.translateY }
}

export type MoveDeltaPayload = {
  userId: string
  objectIds: string[]
  dx: number
  dy: number
}

export const fireCanvasCustom = (canvas: Canvas, event: string, payload: object) =>
  (canvas as unknown as { fire: (e: string, p: object) => void }).fire(event, payload)

export const onCanvasCustom = (canvas: Canvas, event: string, handler: (e: object) => void) =>
  (canvas as unknown as { on: (e: string, h: (p: object) => void) => void }).on(event, handler)

export const offCanvasCustom = (canvas: Canvas, event: string, handler: (e: object) => void) =>
  (canvas as unknown as { off: (e: string, h: (p: object) => void) => void }).off(event, handler)
