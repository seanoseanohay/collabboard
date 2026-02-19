/**
 * Utilities for connector port positions (mid-point handles: top, right, bottom, left).
 * Used by Miro-style connectors to compute anchor points on objects.
 */

import { Point, type FabricObject } from 'fabric'

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
 */
export function getPortScenePoint(obj: FabricObject, port: ConnectorPort): { x: number; y: number } {
  const { x: ox, y: oy } = PORT_OFFSETS[port]
  const w = (obj.get('width') as number) ?? 0
  const h = (obj.get('height') as number) ?? 0
  const originX = (obj.get('originX') as string) ?? 'left'
  const originY = (obj.get('originY') as string) ?? 'top'

  let cx: number
  let cy: number
  if (originX === 'center') cx = w / 2
  else cx = originX === 'right' ? w : 0
  if (originY === 'center') cy = h / 2
  else cy = originY === 'bottom' ? h : 0

  const portX = cx + ox * w
  const portY = cy + oy * h
  const matrix = obj.calcTransformMatrix()
  const pt = new Point(portX, portY).transform(matrix)
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
