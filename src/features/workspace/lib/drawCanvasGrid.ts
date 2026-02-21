/**
 * tldraw-style grid drawing for the Fabric canvas.
 * Registered as a before:render listener so it stays in sync with every render frame.
 * Grid cells are 20px in scene-space; lines fade out when zoomed too far out.
 */

import { type Canvas } from 'fabric'

const GRID_SIZE = 20
const HEX_SIZE = 20

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

export function drawHexGrid(canvas: Canvas): void {
  const ctx = canvas.getContext()
  const vpt = canvas.viewportTransform
  if (!ctx || !vpt) return
  const zoom = vpt[0]
  const panX = vpt[4]
  const panY = vpt[5]
  const hexW = HEX_SIZE * 1.5 * zoom
  const hexH = HEX_SIZE * Math.sqrt(3) * zoom
  if (hexH < 4) return // too small to render

  const w = canvas.width ?? 0
  const h = canvas.height ?? 0

  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 0.5

  const cols = Math.ceil(w / hexW) + 2
  const rows = Math.ceil(h / hexH) + 2
  const startCol = Math.floor(-panX / hexW) - 1
  const startRow = Math.floor(-panY / hexH) - 1

  for (let row = startRow; row < startRow + rows; row++) {
    for (let col = startCol; col < startCol + cols; col++) {
      const cx = col * hexW + panX + (row % 2 ? hexW / 2 : 0)
      const cy = row * hexH + panY
      drawHexagon(ctx, cx, cy, HEX_SIZE * zoom)
    }
  }

  ctx.restore()
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}
