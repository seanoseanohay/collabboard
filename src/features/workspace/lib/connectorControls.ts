/**
 * Connector control handles for Miro-style connectors.
 * Two modes:
 *   1. Source-initiation controls: Replace ml/mr/mt/mb on connectable objects with blue circles
 *      that fire `connector:draw:start` on drag.
 *   2. Waypoint controls: Applied to connector Polylines when selected. Shows:
 *      - One draggable handle per user waypoint (filled blue circle with subtle ✕)
 *      - One phantom handle per segment midpoint (hollow circle) — drag to insert a waypoint
 */

import { Control, controlsUtils, Point } from 'fabric'
import type { Canvas, FabricObject, Polyline } from 'fabric'
import type { ConnectorPort } from './connectorPortUtils'
import { isConnector, getConnectorData, insertWaypoint, updateWaypoint } from './connectorFactory'

// --------------------------------------------------------------------------
// Connector-initiation controls (on connectable objects)
// --------------------------------------------------------------------------

const CONNECTOR_CONTROL_COLOR = '#2563eb'
const CONNECTOR_CONTROL_SIZE = 10

function createConnectorInitControl(port: ConnectorPort): Control {
  const pos = { mt: { x: 0, y: -0.5 }, mr: { x: 0.5, y: 0 }, mb: { x: 0, y: 0.5 }, ml: { x: -0.5, y: 0 } }[port]
  return new Control({
    x: pos.x,
    y: pos.y,
    cursorStyle: 'crosshair',
    sizeX: CONNECTOR_CONTROL_SIZE,
    sizeY: CONNECTOR_CONTROL_SIZE,
    offsetX: 0,
    offsetY: 0,
    mouseDownHandler: (_eventData, transform) => {
      const target = transform.target
      const canvas = target.canvas
      if (canvas && typeof (canvas as { fire?: (e: string, o: object) => void }).fire === 'function') {
        ;(canvas as { fire: (e: string, o: object) => void }).fire('connector:draw:start', {
          sourceObj: target,
          port: transform.corner as ConnectorPort,
        })
      }
      return true
    },
    render: (ctx, left, top) => {
      ctx.save()
      ctx.fillStyle = CONNECTOR_CONTROL_COLOR
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(left, top, CONNECTOR_CONTROL_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    },
  })
}

const CONNECTOR_CONTROLS = {
  mt: createConnectorInitControl('mt'),
  mr: createConnectorInitControl('mr'),
  mb: createConnectorInitControl('mb'),
  ml: createConnectorInitControl('ml'),
}

export function getConnectorAwareControls(defaultControls: Record<string, Control>): Record<string, Control> {
  return {
    ...defaultControls,
    mt: CONNECTOR_CONTROLS.mt,
    mr: CONNECTOR_CONTROLS.mr,
    mb: CONNECTOR_CONTROLS.mb,
    ml: CONNECTOR_CONTROLS.ml,
  }
}

export function applyConnectorControls(obj: { controls?: Record<string, Control>; set?: (key: string, val: unknown) => void }): void {
  if (isConnector(obj as Parameters<typeof isConnector>[0])) return
  const defaults = controlsUtils.createObjectDefaultControls()
  obj.controls = getConnectorAwareControls(defaults)
}

// --------------------------------------------------------------------------
// Waypoint controls (on connector Polylines when selected)
// --------------------------------------------------------------------------

const WP_HANDLE_SIZE = 10
const SEG_HANDLE_SIZE = 7

/**
 * Compute screen position for a midpoint between two consecutive polyline points.
 */
function makeMidpointPositionHandler(segIdx: number) {
  return (_dim: unknown, _finalMatrix: unknown, polyObject: Polyline): Point => {
    const pts = polyObject.points
    if (!pts || !pts[segIdx] || !pts[segIdx + 1]) {
      return controlsUtils.createPolyPositionHandler(segIdx)(_dim as Point, _finalMatrix as [number, number, number, number, number, number], polyObject)
    }
    const mid = new Point(
      (pts[segIdx]!.x + pts[segIdx + 1]!.x) / 2,
      (pts[segIdx]!.y + pts[segIdx + 1]!.y) / 2
    )
    const pathOffset = polyObject.pathOffset ?? new Point(0, 0)
    const localPt = mid.subtract(pathOffset)
    const vpt = polyObject.getViewportTransform()
    const mat = polyObject.calcTransformMatrix()
    // Multiply mat by vpt manually: combined = vpt * mat
    const a = vpt[0] * mat[0] + vpt[2] * mat[1]
    const b = vpt[1] * mat[0] + vpt[3] * mat[1]
    const c = vpt[0] * mat[2] + vpt[2] * mat[3]
    const d = vpt[1] * mat[2] + vpt[3] * mat[3]
    const e = vpt[0] * mat[4] + vpt[2] * mat[5] + vpt[4]
    const f = vpt[1] * mat[4] + vpt[3] * mat[5] + vpt[5]
    return new Point(
      a * localPt.x + c * localPt.y + e,
      b * localPt.x + d * localPt.y + f
    )
  }
}

function renderCircleHandle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  size: number,
  hollow: boolean
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(left, top, size / 2, 0, Math.PI * 2)
  if (hollow) {
    ctx.setLineDash([3, 2])
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillStyle = '#2563eb'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.fill()
    ctx.stroke()
    // Subtle ✕ so user knows they can double-click to delete
    const x = size * 0.18
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(left - x, top - x)
    ctx.lineTo(left + x, top + x)
    ctx.moveTo(left + x, top - x)
    ctx.lineTo(left - x, top + x)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Apply dynamic waypoint and segment-midpoint controls to a connector Polyline.
 * Call this whenever a connector is selected or its points change.
 */
export function applyConnectorWaypointControls(connector: FabricObject, canvas: Canvas): void {
  if (!isConnector(connector)) return
  const data = getConnectorData(connector)
  if (!data) return

  const poly = connector as unknown as { points: { x: number; y: number }[] }
  const pts = poly.points
  if (!pts || pts.length < 2) return

  const controls: Record<string, Control> = {}

  // Waypoint drag handles (for each middle waypoint)
  for (let i = 0; i < data.waypoints.length; i++) {
    const pointIndex = i + 1  // in poly.points: 0=source anchor, 1..N-1=waypoints, N=target
    const wpIdx = i
    const capturedConnector = connector
    const capturedCanvas = canvas

    controls[`wp_${i}`] = new Control({
      actionName: 'waypoint_move',
      cursorStyle: 'move',
      sizeX: WP_HANDLE_SIZE,
      sizeY: WP_HANDLE_SIZE,
      positionHandler: controlsUtils.createPolyPositionHandler(pointIndex),
      actionHandler: (_evt, _transform, x, y) => {
        updateWaypoint(capturedConnector, capturedCanvas, wpIdx, { x, y })
        capturedCanvas.requestRenderAll()
        return true
      },
      mouseUpHandler: (_evt, transform) => {
        transform.target.canvas?.fire('object:modified', { target: transform.target })
        return false
      },
      render: (ctx, left, top) => renderCircleHandle(ctx, left, top, WP_HANDLE_SIZE, false),
    })
  }

  // Segment midpoint phantom handles (for inserting new waypoints)
  const n = pts.length
  for (let i = 0; i < n - 1; i++) {
    const segIdx = i
    const capturedConnector = connector
    const capturedCanvas = canvas

    controls[`seg_${i}`] = new Control({
      actionName: 'segment_insert',
      cursorStyle: 'copy',
      sizeX: SEG_HANDLE_SIZE,
      sizeY: SEG_HANDLE_SIZE,
      positionHandler: makeMidpointPositionHandler(segIdx) as Control['positionHandler'],
      actionHandler: (_evt, _transform, x, y) => {
        insertWaypoint(capturedConnector, capturedCanvas, segIdx, { x, y })
        applyConnectorWaypointControls(capturedConnector, capturedCanvas)
        capturedCanvas.requestRenderAll()
        return true
      },
      mouseUpHandler: (_evt, transform) => {
        // Rebuild controls after insert so new waypoint appears immediately
        applyConnectorWaypointControls(transform.target, canvas)
        transform.target.canvas?.fire('object:modified', { target: transform.target })
        return false
      },
      render: (ctx, left, top) => renderCircleHandle(ctx, left, top, SEG_HANDLE_SIZE, true),
    })
  }

  connector.controls = controls
  connector.setCoords()
}

/**
 * Clear waypoint controls from a connector (when deselected).
 */
export function clearConnectorWaypointControls(connector: FabricObject): void {
  if (!isConnector(connector)) return
  connector.controls = {}
}
