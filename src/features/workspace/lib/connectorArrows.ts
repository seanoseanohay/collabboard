/**
 * Draws arrowheads for connectors on the Fabric canvas.
 * Called in the canvas `after:render` event to paint filled triangles over connector endpoints.
 * Uses the canvas viewport transform so arrowheads always match the scene coordinates.
 */

import type { Canvas } from 'fabric'
import { getConnectorData, isConnector, type ArrowMode } from './connectorFactory'
import type { FabricObject } from 'fabric'

const ARROW_SIZE = 12
const ARROW_HALF_ANGLE = Math.PI / 6  // 30° half-opening

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeColor: string,
  strokeWidth: number
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return
  const angle = Math.atan2(dy, dx)
  const size = ARROW_SIZE + strokeWidth

  ctx.save()
  ctx.fillStyle = strokeColor
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - size * Math.cos(angle - ARROW_HALF_ANGLE),
    to.y - size * Math.sin(angle - ARROW_HALF_ANGLE)
  )
  ctx.lineTo(
    to.x - size * Math.cos(angle + ARROW_HALF_ANGLE),
    to.y - size * Math.sin(angle + ARROW_HALF_ANGLE)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Draw arrowheads for all connectors on the canvas.
 * This should be called in the `after:render` event.
 * Pass a pre-filtered connector list to avoid O(N) scan on every frame.
 */
export function drawConnectorArrows(canvas: Canvas, connectorCache?: FabricObject[]): void {
  const ctx = canvas.getContext()
  const vpt = canvas.viewportTransform
  if (!ctx || !vpt) return

  const connectors = connectorCache ?? canvas.getObjects().filter((obj: FabricObject) => isConnector(obj))
  if (connectors.length === 0) return

  ctx.save()
  // Apply viewport transform so we work in scene coordinates
  ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])

  for (const connector of connectors) {
    const data = getConnectorData(connector)
    if (!data || data.arrowMode === 'none') continue

    const poly = connector as unknown as { points: { x: number; y: number }[] }
    const pts = poly.points
    if (!pts || pts.length < 2) continue

    // Polyline points are in the polyline's internal coord system.
    // We need scene coords: subtract pathOffset, then apply calcTransformMatrix.
    const polyFull = connector as unknown as {
      pathOffset: { x: number; y: number }
      calcTransformMatrix: () => [number, number, number, number, number, number]
    }
    const pathOffset = polyFull.pathOffset ?? { x: 0, y: 0 }
    const mat = polyFull.calcTransformMatrix?.() ?? ([1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number])

    const toScene = (p: { x: number; y: number }): { x: number; y: number } => {
      const lx = p.x - pathOffset.x
      const ly = p.y - pathOffset.y
      return {
        x: mat[0] * lx + mat[2] * ly + mat[4],
        y: mat[1] * lx + mat[3] * ly + mat[5],
      }
    }

    const strokeColor = (connector.get('stroke') as string | undefined) ?? '#1a1a2e'
    const strokeWidth = (connector.get('strokeWidth') as number | undefined) ?? 2

    const arrowMode = data.arrowMode as ArrowMode
    const n = pts.length

    // End arrow (at target): from second-to-last to last point
    if (arrowMode === 'end' || arrowMode === 'both') {
      const from = toScene(pts[n - 2]!)
      const to = toScene(pts[n - 1]!)
      drawArrowHead(ctx, from, to, strokeColor, strokeWidth)
    }

    // Start arrow (at source): from second point to first point
    if (arrowMode === 'both') {
      const from = toScene(pts[1]!)
      const to = toScene(pts[0]!)
      drawArrowHead(ctx, from, to, strokeColor, strokeWidth)
    }
  }

  ctx.restore()
}
