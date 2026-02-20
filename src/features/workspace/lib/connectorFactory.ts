/**
 * Creates and manages Miro-style connector objects (Polyline with subtype 'connector').
 * Connectors store source/target object IDs, ports, waypoints, arrow mode, and stroke style.
 * Connectors recalculate their path when source/target objects move; middle waypoints are
 * preserved so the user's layout intent is respected.
 */

import type { Canvas, FabricObject } from 'fabric'
import { Polyline } from 'fabric'
import { getObjectId, setObjectId } from './boardSync'
import { getPortScenePoint, type ConnectorPort } from './connectorPortUtils'

export type ArrowMode = 'none' | 'end' | 'both'
export type StrokeDash = 'solid' | 'dashed' | 'dotted'

export interface ConnectorData {
  sourceObjectId: string | null
  sourcePort: ConnectorPort
  targetObjectId: string | null
  targetPort: ConnectorPort
  arrowMode: ArrowMode
  strokeDash: StrokeDash
  /** User-placed middle waypoints in scene coordinates. */
  waypoints: { x: number; y: number }[]
  /** Last known scene position when source object was deleted. */
  sourceFloatPoint?: { x: number; y: number }
  /** Last known scene position when target object was deleted. */
  targetFloatPoint?: { x: number; y: number }
}

const CONNECTOR_STROKE = '#1a1a2e'

function findObjectById(canvas: Canvas, objectId: string | null): FabricObject | null {
  if (!objectId) return null
  return canvas.getObjects().find((o) => getObjectId(o) === objectId) ?? null
}

export function getStrokeDashArray(dash: StrokeDash): number[] {
  if (dash === 'dashed') return [10, 5]
  if (dash === 'dotted') return [2, 4]
  return []
}

/** Build all points in scene coordinates: [source, ...waypoints, target]. */
function buildAllPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  waypoints: { x: number; y: number }[]
): { x: number; y: number }[] {
  return [from, ...waypoints, to]
}

export function createConnector(
  canvas: Canvas,
  sourceObjectId: string,
  sourcePort: ConnectorPort,
  targetObjectId: string,
  targetPort: ConnectorPort,
  options: Partial<Pick<ConnectorData, 'arrowMode' | 'strokeDash' | 'waypoints'>> = {}
): FabricObject | null {
  const source = findObjectById(canvas, sourceObjectId)
  const target = findObjectById(canvas, targetObjectId)
  if (!source || !target) return null

  const arrowMode = options.arrowMode ?? 'end'
  const strokeDash = options.strokeDash ?? 'solid'
  const waypoints = options.waypoints ?? []

  const from = getPortScenePoint(source, sourcePort)
  const to = getPortScenePoint(target, targetPort)
  const points = buildAllPoints(from, to, waypoints)

  const id = crypto.randomUUID()
  const data: ConnectorData = {
    sourceObjectId,
    sourcePort,
    targetObjectId,
    targetPort,
    arrowMode,
    strokeDash,
    waypoints,
  }

  const connector = new Polyline(points, {
    originX: 'left',
    originY: 'top',
    stroke: CONNECTOR_STROKE,
    strokeWidth: 2,
    fill: '',
    selectable: true,
    evented: true,
    strokeDashArray: getStrokeDashArray(strokeDash),
    data: { subtype: 'connector', id, ...data },
  })
  setObjectId(connector, id)
  return connector
}

export function isConnector(obj: FabricObject): boolean {
  const data = obj.get('data') as { subtype?: string } | undefined
  return data?.subtype === 'connector'
}

export function getConnectorData(obj: FabricObject): ConnectorData | null {
  const data = obj.get('data') as (ConnectorData & { subtype?: string }) | undefined
  if (data?.subtype !== 'connector') return null
  return {
    sourceObjectId: data.sourceObjectId ?? null,
    sourcePort: data.sourcePort ?? 'mt',
    targetObjectId: data.targetObjectId ?? null,
    targetPort: data.targetPort ?? 'mt',
    arrowMode: data.arrowMode ?? 'end',
    strokeDash: data.strokeDash ?? 'solid',
    waypoints: data.waypoints ?? [],
    sourceFloatPoint: data.sourceFloatPoint,
    targetFloatPoint: data.targetFloatPoint,
  }
}

function setConnectorDataField(obj: FabricObject, patch: Partial<ConnectorData>): void {
  const existing = obj.get('data') as Record<string, unknown> | undefined
  obj.set('data', { ...(existing ?? {}), ...patch })
}

/**
 * Recalculate connector path from source and target positions.
 * Preserves user-placed waypoints (middle points). Only source/target anchors move.
 * When an endpoint object no longer exists, uses the float point if available.
 */
export function updateConnectorEndpoints(connector: FabricObject, canvas: Canvas): void {
  const data = getConnectorData(connector)
  if (!data || connector.type !== 'polyline') return

  const source = findObjectById(canvas, data.sourceObjectId)
  const target = findObjectById(canvas, data.targetObjectId)

  let from: { x: number; y: number } | undefined
  let to: { x: number; y: number } | undefined

  if (source) {
    from = getPortScenePoint(source, data.sourcePort)
  } else if (data.sourceFloatPoint) {
    from = data.sourceFloatPoint
  }

  if (target) {
    to = getPortScenePoint(target, data.targetPort)
  } else if (data.targetFloatPoint) {
    to = data.targetFloatPoint
  }

  if (!from || !to) return

  const points = buildAllPoints(from, to, data.waypoints)

  // Cast to Polyline internals. After replacing points, we MUST call setBoundingBox(true)
  // so pathOffset + width/height are recalculated and left/top are repositioned to match
  // the new bounding box. Without this, the line clips to the original tiny bbox.
  const poly = connector as unknown as {
    points: { x: number; y: number }[]
    setBoundingBox: (adjustPosition?: boolean) => void
    set: (k: string, v: unknown) => void
  }
  poly.points = points
  poly.setBoundingBox(true)
  connector.setCoords()
  connector.set('dirty', true)
}

/**
 * Float both connector endpoints (disconnect from source/target objects).
 * Used when duplicating or pasting connectors so the copy stands alone.
 * Optionally offsets the float points by dx, dy (e.g. +20 for duplicate offset).
 */
export function floatConnectorBothEndpoints(
  connector: FabricObject,
  canvas: Canvas,
  offset: { dx: number; dy: number } = { dx: 0, dy: 0 }
): void {
  const data = getConnectorData(connector)
  if (!data) return
  const source = findObjectById(canvas, data.sourceObjectId)
  const target = findObjectById(canvas, data.targetObjectId)
  const sourcePt = source
    ? getPortScenePoint(source, data.sourcePort)
    : data.sourceFloatPoint
  const targetPt = target
    ? getPortScenePoint(target, data.targetPort)
    : data.targetFloatPoint
  if (!sourcePt || !targetPt) return
  setConnectorDataField(connector, {
    sourceObjectId: null,
    sourceFloatPoint: { x: sourcePt.x + offset.dx, y: sourcePt.y + offset.dy },
    targetObjectId: null,
    targetFloatPoint: { x: targetPt.x + offset.dx, y: targetPt.y + offset.dy },
  })
  updateConnectorEndpoints(connector, canvas)
}

/**
 * After a source/target object is deleted, record the float point so the connector
 * keeps its last position and doesn't lose the endpoint.
 */
export function floatConnectorEndpoint(
  connector: FabricObject,
  canvas: Canvas,
  deletedObjectId: string
): void {
  const data = getConnectorData(connector)
  if (!data) return
  if (data.sourceObjectId === deletedObjectId) {
    const source = findObjectById(canvas, deletedObjectId)
    const floatPt = source ? getPortScenePoint(source, data.sourcePort) : undefined
    setConnectorDataField(connector, {
      sourceObjectId: null,
      sourceFloatPoint: floatPt ?? data.sourceFloatPoint,
    })
  }
  if (data.targetObjectId === deletedObjectId) {
    const target = findObjectById(canvas, deletedObjectId)
    const floatPt = target ? getPortScenePoint(target, data.targetPort) : undefined
    setConnectorDataField(connector, {
      targetObjectId: null,
      targetFloatPoint: floatPt ?? data.targetFloatPoint,
    })
  }
}

/**
 * Insert a waypoint at a segment. segmentIndex is the index of the starting point of the segment
 * in the full points array (0 = source anchor). The inserted waypoint will be at waypointIndex
 * = segmentIndex - 1 in the waypoints array (source anchor is at points[0], so waypoints start at
 * points[1]).
 */
export function insertWaypoint(
  connector: FabricObject,
  canvas: Canvas,
  segmentIndex: number,
  scenePoint: { x: number; y: number }
): void {
  const data = getConnectorData(connector)
  if (!data) return
  const newWaypoints = [...data.waypoints]
  // segmentIndex is the index in full points array (0=source, 1..N-1=waypoints, N=target)
  // waypoints[i] = points[i+1], so insert at waypoints position = segmentIndex - 0 (shift by source anchor)
  // Actually: between full points[segmentIndex] and points[segmentIndex+1] → insert at waypoints[segmentIndex]
  // because waypoints[0] = points[1], etc.
  const waypointInsertIdx = segmentIndex // insert at this index in waypoints array
  newWaypoints.splice(waypointInsertIdx, 0, scenePoint)
  setConnectorDataField(connector, { waypoints: newWaypoints })
  updateConnectorEndpoints(connector, canvas)
}

/**
 * Remove a waypoint by its index in the waypoints array.
 */
export function removeWaypoint(
  connector: FabricObject,
  canvas: Canvas,
  waypointIndex: number
): void {
  const data = getConnectorData(connector)
  if (!data) return
  const newWaypoints = [...data.waypoints]
  newWaypoints.splice(waypointIndex, 1)
  setConnectorDataField(connector, { waypoints: newWaypoints })
  updateConnectorEndpoints(connector, canvas)
}

/** Update a waypoint's scene position (called when user drags a waypoint handle). */
export function updateWaypoint(
  connector: FabricObject,
  canvas: Canvas,
  waypointIndex: number,
  scenePoint: { x: number; y: number }
): void {
  const data = getConnectorData(connector)
  if (!data) return
  const newWaypoints = [...data.waypoints]
  newWaypoints[waypointIndex] = scenePoint
  setConnectorDataField(connector, { waypoints: newWaypoints })
  updateConnectorEndpoints(connector, canvas)
}

/**
 * Lock or unlock body movement on a connector based on whether both endpoints are connected.
 * Connected endpoints should only be repositioned via waypoint handles, not by dragging the line.
 * Floating connectors (at least one null endpoint) remain freely draggable.
 */
/**
 * Update a floating endpoint's position (when user drags the endpoint handle on empty space).
 * `endpointKey` is 'source' or 'target'.
 */
export function moveFloatEndpoint(
  connector: FabricObject,
  canvas: Canvas,
  endpointKey: 'source' | 'target',
  scenePoint: { x: number; y: number }
): void {
  if (endpointKey === 'source') {
    setConnectorDataField(connector, { sourceFloatPoint: scenePoint })
  } else {
    setConnectorDataField(connector, { targetFloatPoint: scenePoint })
  }
  updateConnectorEndpoints(connector, canvas)
}

/**
 * Connect a floating endpoint to a canvas object at the nearest port,
 * or leave it floating if objectId is null (just update the float point).
 */
export function reconnectEndpoint(
  connector: FabricObject,
  canvas: Canvas,
  endpointKey: 'source' | 'target',
  objectId: string | null,
  port: ConnectorPort,
  floatPoint: { x: number; y: number }
): void {
  if (endpointKey === 'source') {
    setConnectorDataField(connector, {
      sourceObjectId: objectId,
      sourcePort: port,
      sourceFloatPoint: objectId ? undefined : floatPoint,
    })
  } else {
    setConnectorDataField(connector, {
      targetObjectId: objectId,
      targetPort: port,
      targetFloatPoint: objectId ? undefined : floatPoint,
    })
  }
  updateConnectorEndpoints(connector, canvas)
  syncConnectorMoveLock(connector)
}

export function syncConnectorMoveLock(connector: FabricObject): void {
  if (!isConnector(connector)) return
  const data = getConnectorData(connector)
  if (!data) return
  const fullyConnected = !!data.sourceObjectId && !!data.targetObjectId
  connector.set('lockMovementX', fullyConnected)
  connector.set('lockMovementY', fullyConnected)
  // Also suppress the default move cursor so the user isn't misled
  connector.set('hoverCursor', fullyConnected ? 'default' : 'move')
}

export function setConnectorArrowMode(connector: FabricObject, canvas: Canvas, mode: ArrowMode): void {
  setConnectorDataField(connector, { arrowMode: mode })
  updateConnectorEndpoints(connector, canvas)
  connector.canvas?.requestRenderAll()
}

export function setConnectorStrokeDash(connector: FabricObject, dash: StrokeDash): void {
  setConnectorDataField(connector, { strokeDash: dash })
  connector.set('strokeDashArray', getStrokeDashArray(dash))
  connector.canvas?.requestRenderAll()
}
