/**
 * Utilities for connector port positions (mid-point handles: top, right, bottom, left).
 * Used by Miro-style connectors to compute anchor points on objects.
 */

import { Point, type Canvas, type FabricObject } from 'fabric'

export type ConnectorPort = 'mt' | 'mr' | 'mb' | 'ml'

/** Relative position of each port. x,y in [-0.5,0.5] from center. */
const PORT_OFFSETS: Record<ConnectorPort, { x: number; y: number }> = {
  mt: { x: 0, y: -0.5 },
  mr: { x: 0.5, y: 0 },
  mb: { x: 0, y: 0.5 },
  ml: { x: -0.5, y: 0 },
}

/**
 * Get the scene position of a port on an object.
 * Handles groups and transformed objects via calcTransformMatrix.
 *
 * Fabric's calcTransformMatrix() always maps local (0,0) to the object's CENTER
 * in world space, regardless of originX/originY. So port offsets are simply
 * ox * width, oy * height — no origin correction needed.
 */
export function getPortScenePoint(obj: FabricObject, port: ConnectorPort): { x: number; y: number } {
  const { x: ox, y: oy } = PORT_OFFSETS[port]
  const w = (obj.get('width') as number) ?? 0
  const h = (obj.get('height') as number) ?? 0
  const matrix = obj.calcTransformMatrix()
  const pt = new Point(ox * w, oy * h).transform(matrix)
  return { x: pt.x, y: pt.y }
}

/**
 * Pick the connector port nearest to a given point (e.g. drop position).
 */
export function getNearestPort(obj: FabricObject, point: { x: number; y: number }): ConnectorPort {
  const ports: ConnectorPort[] = ['mt', 'mr', 'mb', 'ml']
  let nearest: ConnectorPort = 'mt'
  let minDist = Infinity
  for (const port of ports) {
    const p = getPortScenePoint(obj, port)
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2
    if (d < minDist) {
      minDist = d
      nearest = port
    }
  }
  return nearest
}

export interface ConnectorSnapResult {
  obj: FabricObject
  port: ConnectorPort
  scenePoint: { x: number; y: number }
}

/**
 * Port snap radius in scene pixels. When the cursor is within this distance of
 * a port, the preview line snaps to it and the object gets a highlight ring.
 */
export const CONNECTOR_SNAP_RADIUS = 40

/**
 * Find the best snap target for a connector endpoint near `scenePoint`.
 * Returns the nearest port of the nearest non-connector, non-excluded object
 * whose port is within CONNECTOR_SNAP_RADIUS, or null if none.
 */
export function findConnectorSnap(
  canvas: Canvas,
  scenePoint: { x: number; y: number },
  excludeIds: (string | null | undefined)[]
): ConnectorSnapResult | null {
  const excludeSet = new Set(excludeIds.filter(Boolean))
  let best: ConnectorSnapResult | null = null
  let bestDist = CONNECTOR_SNAP_RADIUS * CONNECTOR_SNAP_RADIUS

  for (const obj of canvas.getObjects()) {
    const data = obj.get('data') as { subtype?: string; id?: string } | undefined
    if (data?.subtype === 'connector') continue
    const id = data?.id as string | undefined
    if (id && excludeSet.has(id)) continue
    if (!obj.selectable) continue

    for (const port of ['mt', 'mr', 'mb', 'ml'] as ConnectorPort[]) {
      const p = getPortScenePoint(obj, port)
      const d = (p.x - scenePoint.x) ** 2 + (p.y - scenePoint.y) ** 2
      if (d < bestDist) {
        bestDist = d
        best = { obj, port, scenePoint: p }
      }
    }
  }
  return best
}

/**
 * Draw port circles + highlight ring on `obj` into `ctx` using the viewport transform.
 * Called from canvas `after:render` during connector draw hover.
 */
export function drawConnectorPortHighlight(
  ctx: CanvasRenderingContext2D,
  obj: FabricObject,
  activePort: ConnectorPort | null,
  vpt: [number, number, number, number, number, number]
): void {
  const zoom = vpt[0]
  const ports: ConnectorPort[] = ['mt', 'mr', 'mb', 'ml']

  // Draw a dashed bounding-box outline
  const w = (obj.get('width') as number) * (obj.get('scaleX') as number ?? 1)
  const h = (obj.get('height') as number) * (obj.get('scaleY') as number ?? 1)
  const center = obj.getCenterPoint()
  const angle = ((obj.get('angle') as number) ?? 0) * (Math.PI / 180)
  const screenCx = center.x * zoom + vpt[4]
  const screenCy = center.y * zoom + vpt[5]

  ctx.save()
  ctx.translate(screenCx, screenCy)
  ctx.rotate(angle)
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  ctx.strokeRect(-w * zoom / 2, -h * zoom / 2, w * zoom, h * zoom)
  ctx.restore()

  // Draw port circles
  for (const port of ports) {
    const sp = getPortScenePoint(obj, port)
    const sx = sp.x * zoom + vpt[4]
    const sy = sp.y * zoom + vpt[5]
    const isActive = port === activePort
    const r = isActive ? 7 : 5
    ctx.save()
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fillStyle = isActive ? '#2563eb' : 'rgba(37,99,235,0.25)'
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
