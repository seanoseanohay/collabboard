/**
 * tldraw-style grid drawing for the Fabric canvas.
 * Registered as a before:render listener so it stays in sync with every render frame.
 * Grid cells are 20px in scene-space; lines fade out when zoomed too far out.
 */

import { type Canvas } from 'fabric'

const GRID_SIZE = 20

export function drawCanvasGrid(canvas: Canvas): void {
  const ctx = canvas.getContext()
  const vpt = canvas.viewportTransform
  if (!ctx || !vpt) return
  const zoom = vpt[0]
  const panX = vpt[4]
  const panY = vpt[5]
  const cellPx = GRID_SIZE * zoom
  if (cellPx < 2) return // too zoomed out to render grid
  const w = canvas.width ?? 0
  const h = canvas.height ?? 0
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  const startX = ((panX % cellPx) + cellPx) % cellPx
  for (let x = startX; x <= w; x += cellPx) {
    const rx = Math.round(x) + 0.5
    ctx.moveTo(rx, 0)
    ctx.lineTo(rx, h)
  }
  const startY = ((panY % cellPx) + cellPx) % cellPx
  for (let y = startY; y <= h; y += cellPx) {
    const ry = Math.round(y) + 0.5
    ctx.moveTo(0, ry)
    ctx.lineTo(w, ry)
  }
  ctx.stroke()
  ctx.restore()
}
