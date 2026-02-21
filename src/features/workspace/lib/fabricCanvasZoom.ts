/**
 * Zoom and pan helpers for the Fabric canvas.
 * createZoomHandlers returns applyZoom, zoomToFit, and handleWheel — all wired
 * to the same canvas/notifyViewport closure so callers stay minimal.
 */

import { Canvas, Point, type FabricObject } from 'fabric'

export const MIN_ZOOM = 0.00001 // 0.001%
export const MAX_ZOOM = 10      // 1000%
export const ZOOM_STEP = 1.25

export interface ZoomHandlers {
  applyZoom: (newZoom: number) => void
  zoomToFit: () => void
  zoomToSelection: () => void
  handleWheel: (opt: { e: WheelEvent }) => void
}

export function createZoomHandlers(
  canvas: Canvas,
  canvasWidth: number,
  canvasHeight: number,
  notifyViewport: () => void
): ZoomHandlers {
  const center = new Point(canvasWidth / 2, canvasHeight / 2)

  const applyZoom = (newZoom: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
    canvas.zoomToPoint(center, clamped)
    canvas.requestRenderAll()
    notifyViewport()
  }

  const zoomToFit = () => {
    const objs = canvas.getObjects() as Array<
      FabricObject & { getBoundingRect: (absolute?: boolean) => { left: number; top: number; width: number; height: number } }
    >
    if (objs.length === 0) {
      canvas.setZoom(1)
      if (canvas.viewportTransform) {
        canvas.viewportTransform[0] = 1
        canvas.viewportTransform[3] = 1
        canvas.viewportTransform[4] = 0
        canvas.viewportTransform[5] = 0
      }
      canvas.requestRenderAll()
      notifyViewport()
      return
    }
    const bounds = objs.reduce(
      (acc, obj) => {
        const b = obj.getBoundingRect(true)
        return {
          minX: Math.min(acc.minX, b.left),
          minY: Math.min(acc.minY, b.top),
          maxX: Math.max(acc.maxX, b.left + b.width),
          maxY: Math.max(acc.maxY, b.top + b.height),
        }
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )
    const padding = 40
    const contentW = bounds.maxX - bounds.minX + padding * 2
    const contentH = bounds.maxY - bounds.minY + padding * 2
    const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvasWidth / contentW, canvasHeight / contentH)))
    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    vpt[0] = fitZoom
    vpt[3] = fitZoom
    vpt[4] = canvasWidth / 2 - cx * fitZoom
    vpt[5] = canvasHeight / 2 - cy * fitZoom
    canvas.requestRenderAll()
    notifyViewport()
  }

  const zoomToSelection = () => {
    const active = canvas.getActiveObject()
    if (!active) return
    const objs = active.type === 'activeselection'
      ? (active as unknown as { getObjects: () => FabricObject[] }).getObjects()
      : [active]
    if (objs.length === 0) return
    const bounds = objs.reduce(
      (acc, obj) => {
        const b = (obj as FabricObject & { getBoundingRect: (absolute?: boolean) => { left: number; top: number; width: number; height: number } }).getBoundingRect(true)
        return {
          minX: Math.min(acc.minX, b.left),
          minY: Math.min(acc.minY, b.top),
          maxX: Math.max(acc.maxX, b.left + b.width),
          maxY: Math.max(acc.maxY, b.top + b.height),
        }
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )
    const padding = 60
    const contentW = bounds.maxX - bounds.minX + padding * 2
    const contentH = bounds.maxY - bounds.minY + padding * 2
    const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvasWidth / contentW, canvasHeight / contentH)))
    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    vpt[0] = fitZoom
    vpt[3] = fitZoom
    vpt[4] = canvasWidth / 2 - cx * fitZoom
    vpt[5] = canvasHeight / 2 - cy * fitZoom
    canvas.requestRenderAll()
    notifyViewport()
  }

  const handleWheel = (opt: { e: WheelEvent }) => {
    const e = opt.e
    e.preventDefault()
    // Trackpad: pinch sends ctrl+wheel (zoom); two-finger scroll sends plain wheel (pan).
    if (e.ctrlKey) {
      const delta = -e.deltaY * 0.006
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * (1 + delta)))
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), newZoom)
    } else {
      canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
    }
    canvas.requestRenderAll()
    notifyViewport()
  }

  return { applyZoom, zoomToFit, zoomToSelection, handleWheel }
}
