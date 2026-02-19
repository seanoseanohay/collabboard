/**
 * Z-order operations for the Fabric canvas (bring to front/back, step forward/back).
 * Each function operates on the current active object and fires object:modified so
 * boardSync picks up the change automatically.
 */

import { Canvas, type FabricObject } from 'fabric'
import { getObjectId, getObjectZIndex, setObjectZIndex, sortCanvasByZIndex } from './boardSync'

function getTargetObjects(canvas: Canvas): { active: FabricObject; objects: FabricObject[] } | null {
  const active = canvas.getActiveObject()
  if (!active) return null
  const objects =
    'getObjects' in active
      ? (active as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o))
      : [active]
  if (objects.length === 0) return null
  return { active, objects }
}

export function bringToFront(canvas: Canvas): void {
  const result = getTargetObjects(canvas)
  if (!result) return
  const { active, objects } = result
  const all = canvas.getObjects()
  const maxZ = all.reduce((m, o) => Math.max(m, getObjectZIndex(o)), 0)
  objects.forEach((obj, i) => {
    setObjectZIndex(obj, maxZ + 1 + i)
    canvas.bringObjectToFront(obj)
  })
  canvas.fire('object:modified', { target: active })
  canvas.requestRenderAll()
}

export function sendToBack(canvas: Canvas): void {
  const result = getTargetObjects(canvas)
  if (!result) return
  const { active, objects } = result
  const all = canvas.getObjects()
  const minZ = all.reduce((m, o) => Math.min(m, getObjectZIndex(o)), Number.MAX_SAFE_INTEGER)
  objects.forEach((obj, i) => {
    setObjectZIndex(obj, Math.max(0, minZ - objects.length + i))
    canvas.sendObjectToBack(obj)
  })
  canvas.fire('object:modified', { target: active })
  canvas.requestRenderAll()
}

export function bringForward(canvas: Canvas): void {
  const result = getTargetObjects(canvas)
  if (!result) return
  const { active, objects } = result
  const all = canvas.getObjects().slice().sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
  const maxZ = all.length > 0 ? getObjectZIndex(all[all.length - 1]!) : 0
  const currentZ = Math.max(...objects.map((o) => getObjectZIndex(o)))
  if (currentZ >= maxZ) {
    objects.forEach((obj, i) => {
      setObjectZIndex(obj, maxZ + 1 + i)
      canvas.bringObjectToFront(obj)
    })
  } else {
    const nextIdx = all.findIndex((o) => getObjectZIndex(o) > currentZ)
    if (nextIdx === -1) return
    const nextZ = getObjectZIndex(all[nextIdx]!)
    objects.forEach((obj, i) => {
      setObjectZIndex(obj, nextZ + 1 + i)
      canvas.bringObjectToFront(obj)
    })
  }
  sortCanvasByZIndex(canvas)
  canvas.fire('object:modified', { target: active })
  canvas.requestRenderAll()
}

export function sendBackward(canvas: Canvas): void {
  const result = getTargetObjects(canvas)
  if (!result) return
  const { active, objects } = result
  const all = canvas.getObjects().slice().sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
  const minZ = all.length > 0 ? getObjectZIndex(all[0]!) : 0
  const currentZ = Math.min(...objects.map((o) => getObjectZIndex(o)))
  if (currentZ <= minZ) {
    objects.forEach((obj, i) => {
      setObjectZIndex(obj, Math.max(0, minZ - objects.length + i))
      canvas.sendObjectToBack(obj)
    })
  } else {
    const prevIdx = all.findIndex((o) => getObjectZIndex(o) >= currentZ) - 1
    if (prevIdx < 0) return
    const prevObj = all[prevIdx]!
    const prevZ = getObjectZIndex(prevObj)
    setObjectZIndex(prevObj, currentZ)
    canvas.bringObjectToFront(prevObj)
    objects.forEach((obj, i) => {
      setObjectZIndex(obj, prevZ + i)
      canvas.sendObjectToBack(obj)
    })
  }
  sortCanvasByZIndex(canvas)
  canvas.fire('object:modified', { target: active })
  canvas.requestRenderAll()
}
