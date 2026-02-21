import {
  Canvas,
  FabricObject,
  Polyline,
  Point,
} from 'fabric'
import { createKeyboardHandlers } from './fabricCanvasKeyHandlers'

import {
  isConnector,
  getConnectorData,
  createConnector,
  syncConnectorMoveLock,
  removeWaypoint as removeConnectorWaypoint,
} from '../lib/connectorFactory'
import type { ConnectorPort, ConnectorSnapResult } from '../lib/connectorPortUtils'
import {
  getPortScenePoint,
  drawConnectorPortHighlight,
  findConnectorSnap,
  getNearestPort,
} from '../lib/connectorPortUtils'
import { drawConnectorArrows } from '../lib/connectorArrows'
import { isDataTable, getTableData } from '../lib/dataTableUtils'
import { bakeFrameOrTableGroupScale } from '../lib/frameUtils'
import { createShape, updateStickyTextFontSize, hideStickyPlaceholderForEditing } from '../lib/shapeFactory'
import { createFrameShape } from '../lib/frameFactory'
import { createDataTableShape } from '../lib/dataTableFactory'
import { createSticker } from '../lib/pirateStickerFactory'
import { isStickyGroup, isTextOnlySelection, hasEditableText } from '../lib/fontUtils'
import { getStrokeWidthFromObject, getStrokeColorFromObject } from '../lib/strokeUtils'
import { getFontFamilyFromObject, getFontSizeFromObject } from '../lib/fontUtils'
import { getFillFromObject } from '../lib/fillUtils'
import { applyConnectorControls, applyConnectorWaypointControls, clearConnectorWaypointControls } from '../lib/connectorControls'
import { normalizeScaleFlips } from '../lib/fabricCanvasScaleFlips'
import { MIN_ZOOM, MAX_ZOOM } from '../lib/fabricCanvasZoom'
import { isShapeTool } from '../types/tools'
import { getObjectId, setObjectId, setObjectZIndex } from '../lib/boardSync'
import type { FormSchema } from '../lib/frameFormTypes'
import type { FabricCanvasZoomHandle, ConnectorDropState, SelectionStrokeInfo } from '../types/fabricCanvasTypes'
import type { ToolType } from '../types/tools'
import type { StickerKind } from '../lib/pirateStickerFactory'
import type { HistoryManager } from '../lib/historyManager'
import type React from 'react'
import { drawCanvasGrid, drawHexGrid } from '../lib/drawCanvasGrid'

/** IText has enterEditing; FabricText does not. Check by method presence. */
export function isEditableText(obj: unknown): obj is { enterEditing: () => void } {
  return !!obj && typeof (obj as { enterEditing?: () => void }).enterEditing === 'function'
}

export interface FabricCanvasInteractionState {
  isPanning: boolean
  isDrawing: boolean
  spacePressed: boolean
  lastPointer: { x: number; y: number } | null
  drawStart: { x: number; y: number } | null
  drawEnd: { x: number; y: number } | null
  previewObj: FabricObject | null
  objectWasTransformed: boolean
  connectorDrawState: { sourceObj: FabricObject; port: ConnectorPort } | null
  connectorPreviewLine: Polyline | null
  lastConnectorDrawPoint: { x: number; y: number } | null
  connectorHoverSnap: ConnectorSnapResult | null
  marqueeState: { start: { x: number; y: number }; rect: FabricObject } | null
  zoomDragState: { start: { x: number; y: number }; rect: FabricObject } | null
  lassoState: { points: { x: number; y: number }[]; preview: Polyline } | null
  polygonDrawState: { points: Array<{ x: number; y: number }>; preview: Polyline | null } | null
}

export interface FabricCanvasEventHandlerDeps {
  canvasRef: React.MutableRefObject<Canvas | null>
  fabricImperativeRef: React.MutableRefObject<FabricCanvasZoomHandle | null>
  lastScenePointRef: React.MutableRefObject<{ x: number; y: number } | null>
  toolRef: React.MutableRefObject<ToolType>
  stickerKindRef: React.MutableRefObject<StickerKind>
  polygonSidesRef: React.MutableRefObject<number>
  starModeRef: React.MutableRefObject<boolean>
  gridTypeRef: React.MutableRefObject<'square' | 'hex' | 'none'>
  snapToGridRef: React.MutableRefObject<boolean>
  brushOpacityRef: React.MutableRefObject<number>
  brushWidthRef: React.MutableRefObject<number>
  eraserActiveRef: React.MutableRefObject<boolean>
  onPointerMoveRef: React.MutableRefObject<((sp: { x: number; y: number }) => void) | undefined>
  onViewportChangeRef: React.MutableRefObject<((vpt: number[]) => void) | undefined>
  onSelectionChangeRef: React.MutableRefObject<((info: SelectionStrokeInfo | null) => void) | undefined>
  onSelectedCountChangeRef: React.MutableRefObject<((count: number) => void) | undefined>
  onToolChangeRef: React.MutableRefObject<((tool: ToolType) => void) | undefined>
  onTableEditStartRef: React.MutableRefObject<((objectId: string) => void) | undefined>
  onTableEditEndRef: React.MutableRefObject<(() => void) | undefined>
  setConnectorDropMenuState: React.Dispatch<React.SetStateAction<ConnectorDropState | null>>
  width: number
  height: number
}

export interface FabricCanvasEventHandlerHelpers {
  onMarqueeMouseMove: (ev: MouseEvent) => void
  onMarqueeMouseUp: () => void
  onZoomDragMouseMove: (ev: MouseEvent) => void
  onZoomDragMouseUp: () => void
  onLassoMouseMove: (ev: MouseEvent) => void
  onLassoMouseUp: () => void
  onPolygonDrawMouseMove: (ev: MouseEvent) => void
  closePolygonDraw: () => void
  getScenePoint: (opt: { scenePoint?: { x: number; y: number }; viewportPoint?: { x: number; y: number } }) => { x: number; y: number } | null
  notifyFormFrames: () => void
  notifyViewport: () => void
  connectorCacheSet: Set<FabricObject>
  getObjectsToHistorize: (target: FabricObject) => FabricObject[]
  applyZoom: (newZoom: number) => void
  zoomToFit: () => void
  zoomToSelection: () => void
  history: HistoryManager
  canvasEl: HTMLCanvasElement
}

export function createFabricCanvasEventHandlers(
  fabricCanvas: Canvas,
  st: FabricCanvasInteractionState,
  {
    canvasRef,
    fabricImperativeRef, lastScenePointRef,
    toolRef, stickerKindRef, polygonSidesRef, starModeRef,
    gridTypeRef, snapToGridRef, brushOpacityRef, brushWidthRef, eraserActiveRef,
    onPointerMoveRef, onViewportChangeRef, onSelectionChangeRef, onSelectedCountChangeRef,
    onToolChangeRef, onTableEditStartRef, onTableEditEndRef,
    setConnectorDropMenuState,
  }: FabricCanvasEventHandlerDeps,
  {
    onMarqueeMouseMove, onMarqueeMouseUp,
    onZoomDragMouseMove, onZoomDragMouseUp,
    onLassoMouseMove, onLassoMouseUp,
    onPolygonDrawMouseMove, closePolygonDraw,
    getScenePoint, notifyFormFrames, notifyViewport,
    connectorCacheSet, getObjectsToHistorize, applyZoom,
    zoomToFit, zoomToSelection, history, canvasEl,
  }: FabricCanvasEventHandlerHelpers
) {
    const handleMouseDown = (
      opt: {
        e: globalThis.MouseEvent | PointerEvent | TouchEvent
        target?: unknown
        viewportPoint?: { x: number; y: number }
      }
    ) => {
      const ev = opt.e
      if (!('clientX' in ev)) return
      const target = opt.target
      const tool = toolRef.current
      st.objectWasTransformed = false  // Reset at start of each mouse interaction

      // End table edit mode when clicking on something that is not a DataTable
      if (!target || !isDataTable(target as FabricObject)) {
        onTableEditEndRef.current?.()
      }

      // Universal rule for all drawing tools:
      //   - Clicking a resize/rotate handle of the ACTIVE object → let Fabric handle (resize/rotate)
      //   - Clicking the body of any object, or empty space → always create a new object
      const activeObj = fabricCanvas.getActiveObject()
      const xform = (fabricCanvas as unknown as { _currentTransform?: { corner?: string } })._currentTransform
      const isOnHandle = !!(target && target === activeObj && xform?.corner)

      // Sticker (click-to-place — no drag, just click)
      if (tool === 'sticker' && 'button' in ev && ev.button === 0) {
        if (isOnHandle) return
        const sp = getScenePoint(opt)
        if (sp) {
          fabricCanvas.discardActiveObject()
          const sticker = createSticker(stickerKindRef.current, sp.x, sp.y, {
            zoom: fabricCanvas.getZoom(),
          })
          if (sticker) {
            fabricCanvas.add(sticker)
            fabricCanvas.setActiveObject(sticker)
            fabricCanvas.requestRenderAll()
            onToolChangeRef.current?.('select')
          }
        }
        return
      }

      // All shape tools including text, sticky, frame, and table (drag-to-draw)
      if (isShapeTool(tool) && 'button' in ev && ev.button === 0) {
        if (isOnHandle) return // Resize/rotate handle → allow transform

        const sp = getScenePoint(opt)
        if (sp) {
          fabricCanvas.discardActiveObject()
          st.isDrawing = true
          st.drawStart = sp
          const shape = tool === 'frame'
            ? createFrameShape(sp.x, sp.y, 0, 0, 'Frame', false)
            : tool === 'table'
            ? createDataTableShape(sp.x, sp.y, 0, 0, 'Untitled Table', false)
            : createShape(tool, sp.x, sp.y, sp.x, sp.y, {
                assignId: false,
                zoom: fabricCanvas.getZoom(),
                polygonSides: polygonSidesRef.current,
                starMode: starModeRef.current,
              })
          if (shape) {
            st.previewObj = shape
            shape.selectable = false
            shape.evented = false
            fabricCanvas.add(shape)
          }
        }
        return
      }

      const isMiddle = 'button' in ev && ev.button === 1
      const isSpaceLeftOnEmpty = 'button' in ev && ev.button === 0 && !target && st.spacePressed
      const isHandDrag = tool === 'hand' && 'button' in ev && ev.button === 0
      if ((isMiddle || isSpaceLeftOnEmpty) && tool === 'select') {
        st.isPanning = true
        st.lastPointer = { x: ev.clientX, y: ev.clientY }
      } else if (isHandDrag) {
        st.isPanning = true
        st.lastPointer = { x: ev.clientX, y: ev.clientY }
        fabricCanvas.discardActiveObject()
      }
    }

    const handleMouseMove = (
      opt: {
        e: globalThis.MouseEvent | PointerEvent | TouchEvent
        viewportPoint?: { x: number; y: number }
      }
    ) => {
      const ev = opt.e
      if (!('clientX' in ev)) return
      const tool = toolRef.current

      const sp = getScenePoint(opt)
      if (sp) {
        lastScenePointRef.current = sp
        onPointerMoveRef.current?.(sp)
      }

      // Marquee updates are handled by DOM-level onMarqueeMouseMove listener (skipping here)

      if (st.isDrawing && st.drawStart && st.previewObj) {
        const sp = getScenePoint(opt)
        if (sp) {
          st.drawEnd = sp
          const shape = tool === 'frame'
            ? createFrameShape(
                Math.min(st.drawStart.x, sp.x),
                Math.min(st.drawStart.y, sp.y),
                Math.abs(sp.x - st.drawStart.x),
                Math.abs(sp.y - st.drawStart.y),
                'Frame',
                false  // no id → preview only
              )
            : tool === 'table'
            ? createDataTableShape(
                Math.min(st.drawStart.x, sp.x),
                Math.min(st.drawStart.y, sp.y),
                Math.abs(sp.x - st.drawStart.x),
                Math.abs(sp.y - st.drawStart.y),
                'Untitled Table',
                false
              )
            : createShape(tool, st.drawStart.x, st.drawStart.y, sp.x, sp.y, {
                assignId: false,
                zoom: fabricCanvas.getZoom(),
                polygonSides: polygonSidesRef.current,
                starMode: starModeRef.current,
              })
          if (shape) {
            fabricCanvas.remove(st.previewObj)
            st.previewObj = shape
            st.previewObj.selectable = false
            st.previewObj.evented = false
            fabricCanvas.add(st.previewObj)
            fabricCanvas.requestRenderAll()
          }
        }
        return
      }

      if (st.connectorDrawState && sp) {
        st.lastConnectorDrawPoint = sp
        const sourceId = getObjectId(st.connectorDrawState.sourceObj)
        // Snap to nearest port if cursor is within snap radius
        st.connectorHoverSnap = findConnectorSnap(fabricCanvas, sp, [sourceId])
        const tip = st.connectorHoverSnap ? st.connectorHoverSnap.scenePoint : sp
        const from = getPortScenePoint(st.connectorDrawState.sourceObj, st.connectorDrawState.port)
        if (!st.connectorPreviewLine) {
          st.connectorPreviewLine = new Polyline([from, { x: tip.x, y: tip.y }], {
            stroke: '#2563eb',
            strokeWidth: 2,
            fill: '',
            selectable: false,
            evented: false,
          })
          fabricCanvas.add(st.connectorPreviewLine)
        } else {
          st.connectorPreviewLine.set('points', [from, { x: tip.x, y: tip.y }])
          st.connectorPreviewLine.setCoords()
        }
        fabricCanvas.requestRenderAll()
        return
      }

      if (st.isPanning && st.lastPointer) {
        const dx = ev.clientX - st.lastPointer.x
        const dy = ev.clientY - st.lastPointer.y
        fabricCanvas.relativePan(new Point(dx, dy))
        st.lastPointer = { x: ev.clientX, y: ev.clientY }
        fabricCanvas.requestRenderAll()
        notifyViewport()
      }
    }

    if (onViewportChangeRef.current) {
      const vpt = fabricCanvas.viewportTransform
      if (vpt) onViewportChangeRef.current([...vpt])
    }

    const handleMouseUp = (opt?: { target?: unknown }) => {
      // Marquee finalization is handled by DOM-level onMarqueeMouseUp listener (skipping here)
      if (st.connectorDrawState) {
        const sourceId = getObjectId(st.connectorDrawState.sourceObj)
        if (st.connectorPreviewLine) {
          fabricCanvas.remove(st.connectorPreviewLine)
          st.connectorPreviewLine = null
        }
        // Prefer snap result; fall back to Fabric's reported target
        const snapResult = st.connectorHoverSnap
        st.connectorHoverSnap = null
        const target = snapResult ? snapResult.obj : (opt?.target as FabricObject | undefined)
        if (target && sourceId && getObjectId(target) && target !== st.connectorDrawState.sourceObj) {
          const targetRoot = (target.group ?? target) as FabricObject
          const targetId = getObjectId(targetRoot)
          if (targetId && targetRoot !== st.connectorDrawState.sourceObj) {
            const targetPort = snapResult
              ? snapResult.port
              : getNearestPort(targetRoot, st.lastConnectorDrawPoint ?? { x: 0, y: 0 })
            const connector = createConnector(
              fabricCanvas,
              sourceId,
              st.connectorDrawState.port,
              targetId,
              targetPort,
            )
            if (connector) {
              syncConnectorMoveLock(connector)
              fabricCanvas.add(connector)
              fabricCanvas.setActiveObject(connector)
            }
          }
        } else if (sourceId && st.lastConnectorDrawPoint) {
          // Dropped on empty space: show create-and-connect menu
          const dropPt = st.lastConnectorDrawPoint
          const vpt = fabricCanvas.viewportTransform
          const screenX = dropPt.x * (vpt?.[0] ?? 1) + (vpt?.[4] ?? 0)
          const screenY = dropPt.y * (vpt?.[0] ?? 1) + (vpt?.[5] ?? 0)
          const capturedSourcePort = st.connectorDrawState.port
          setConnectorDropMenuState({ screenX, screenY, scenePoint: dropPt, sourceId, sourcePort: capturedSourcePort })
        }
        st.lastConnectorDrawPoint = null
        st.connectorDrawState = null
        fabricCanvas.requestRenderAll()
        return
      }
      if (st.isDrawing && st.drawStart && st.previewObj) {
        const tool = toolRef.current
        const end = st.drawEnd ?? st.drawStart
        fabricCanvas.remove(st.previewObj)
        const w = Math.abs(end.x - st.drawStart.x)
        const h = Math.abs(end.y - st.drawStart.y)
        const minSize = 8
        if (w >= minSize || h >= minSize || tool === 'line') {
          const shape = tool === 'frame'
            ? createFrameShape(
                Math.min(st.drawStart.x, end.x),
                Math.min(st.drawStart.y, end.y),
                w,
                h
              )
            : tool === 'table'
            ? createDataTableShape(
                Math.min(st.drawStart.x, end.x),
                Math.min(st.drawStart.y, end.y),
                w,
                h
              )
            : createShape(tool, st.drawStart.x, st.drawStart.y, end.x, end.y, {
                zoom: fabricCanvas.getZoom(),
                polygonSides: polygonSidesRef.current,
                starMode: starModeRef.current,
              })
          if (shape) {
            if (tool === 'frame') {
              // Frames live behind their children; set a low zIndex so sortCanvasByZIndex keeps them at back
              setObjectZIndex(shape, 1)
            }
            fabricCanvas.add(shape)
            if (tool === 'frame') fabricCanvas.sendObjectToBack(shape)
            fabricCanvas.setActiveObject(shape)
            // Sticky: auto-enter edit mode so blinking cursor appears and user can type immediately
            if (tool === 'sticky') {
              const mainText = shape.type === 'group' && 'getObjects' in shape
                ? (shape as { getObjects: () => FabricObject[] }).getObjects().find((o) => isEditableText(o))
                : null
              if (mainText) {
                // Defer so canvas has committed the new object; then enter editing so cursor appears
                setTimeout(() => tryEnterTextEditing(mainText), 50)
              }
            }
            onToolChangeRef.current?.('select')
          }
        }
        st.previewObj = null
        st.drawEnd = null
        st.isDrawing = false
        st.drawStart = null
        fabricCanvas.requestRenderAll()
      }
      st.isPanning = false
      st.lastPointer = null
    }

    const handleWindowMouseUp = () => handleMouseUp()

    // --- Touch: two-finger pan + pinch zoom ---
    // Single-finger touch routes through Fabric's pointer-event mapping (mouse:down/move/up).
    // Two-finger gestures are intercepted here before pointer synthesis confuses Fabric.
    let pinchState: { dist: number; zoom: number; centroid: { x: number; y: number } } | null = null

    const getViewportTouchPositions = (e: TouchEvent) =>
      Array.from(e.touches).map((t) => {
        const rect = canvasEl.getBoundingClientRect()
        return { x: t.clientX - rect.left, y: t.clientY - rect.top }
      })

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault() // block browser scroll/zoom and pointer-event synthesis for 2-touch
      const pts = getViewportTouchPositions(e)
      const dx = pts[1]!.x - pts[0]!.x
      const dy = pts[1]!.y - pts[0]!.y
      pinchState = {
        dist: Math.sqrt(dx * dx + dy * dy),
        zoom: fabricCanvas.getZoom(),
        centroid: { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 },
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchState) return
      e.preventDefault()
      const pts = getViewportTouchPositions(e)
      const dx = pts[1]!.x - pts[0]!.x
      const dy = pts[1]!.y - pts[0]!.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const centroid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 }
      // Zoom at pinch midpoint
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchState.zoom * (dist / pinchState.dist)))
      fabricCanvas.zoomToPoint(new Point(centroid.x, centroid.y), newZoom)
      // Pan by centroid delta
      fabricCanvas.relativePan(new Point(centroid.x - pinchState.centroid.x, centroid.y - pinchState.centroid.y))
      pinchState = { dist, zoom: fabricCanvas.getZoom(), centroid }
      fabricCanvas.requestRenderAll()
      notifyViewport()
    }

    const handleTouchEnd = () => { pinchState = null }


    const tryEnterTextEditing = (obj: FabricObject) => {
      if (!isEditableText(obj)) return
      const itext = obj as FabricObject & { enterEditing: () => void; hiddenTextarea?: HTMLTextAreaElement; canvas?: unknown }
      if (!itext.canvas) itext.canvas = fabricCanvas
      fabricCanvas.setActiveObject(obj)
      hideStickyPlaceholderForEditing(obj)
      fabricCanvas.requestRenderAll()
      // Defer enterEditing so canvas has painted; then focus so blinking cursor appears
      setTimeout(() => {
        itext.enterEditing()
        fabricCanvas.requestRenderAll()
        itext.hiddenTextarea?.focus()
      }, 0)
    }

    const getTextToEdit = (target: FabricObject): FabricObject | null => {
      if (isEditableText(target)) return target
      if (target.type === 'group' && 'getObjects' in target) {
        const objects = (target as { getObjects: () => FabricObject[] }).getObjects()
        const textChild = objects.find((o) => isEditableText(o))
        return textChild ?? null
      }
      return null
    }

    const handleDblClick = (opt: { target?: unknown; scenePoint?: { x: number; y: number }; viewportPoint?: { x: number; y: number } }) => {
      // Double-click while polygon-draw active → close polygon.
      // The second mousedown of dblclick already added one extra point; remove it before closing.
      if (toolRef.current === 'polygon-draw') {
        if (st.polygonDrawState && st.polygonDrawState.points.length > 1) {
          st.polygonDrawState.points.pop()
        }
        closePolygonDraw()
        return
      }

      const target = opt.target as FabricObject | undefined
      if (!target) return

      // Double-click on a DataTable → enter edit mode
      if (isDataTable(target)) {
        const data = getTableData(target)
        if (data?.id) {
          onTableEditStartRef.current?.(data.id)
          return
        }
      }

      // Double-click on a connector waypoint → delete that waypoint
      if (isConnector(target)) {
        const data = getConnectorData(target)
        const clickPt = opt.scenePoint ?? getScenePoint(opt)
        if (data && clickPt && data.waypoints.length > 0) {
          const threshold = 12 / fabricCanvas.getZoom()
          for (let i = 0; i < data.waypoints.length; i++) {
            const wp = data.waypoints[i]!
            const d = Math.sqrt((wp.x - clickPt.x) ** 2 + (wp.y - clickPt.y) ** 2)
            if (d < threshold) {
              removeConnectorWaypoint(target, fabricCanvas, i)
              applyConnectorWaypointControls(target, fabricCanvas)
              fabricCanvas.requestRenderAll()
              return
            }
          }
        }
        return  // Don't enter text edit for connectors
      }

      const text = getTextToEdit(target)
      if (text) tryEnterTextEditing(text)
    }

    const handleMouseUpForText = (opt: { target?: unknown }) => {
      if (st.isDrawing) return
      const target = opt.target as FabricObject | undefined
      if (!target) return
      const active = fabricCanvas.getActiveObject()
      
      // Don't enter edit mode if the object was just transformed (rotated, scaled, moved)
      if (st.objectWasTransformed) return
      
      // Check if we clicked on an already-selected object
      const clickedOnActive =
        active === target ||
        (target.group && target.group === active) ||
        (active && 'getObjects' in active && 
          (active as { getObjects: () => FabricObject[] }).getObjects().includes(target))
      
      if (!clickedOnActive) return
      
      // Get the text object to edit (could be target itself or child of group)
      let text = getTextToEdit(target)
      if (!text && active) {
        text = getTextToEdit(active)
      }
      
      if (text) {
        // Check if already editing
        const alreadyEditing = 'isEditing' in text && (text as { isEditing: boolean }).isEditing
        if (!alreadyEditing) {
          tryEnterTextEditing(text)
        }
      }
    }

    const { handleKeyDown, handleKeyUp } = createKeyboardHandlers({
      fabricCanvas, st, history, fabricImperativeRef, onToolChangeRef,
      getObjectsToHistorize,
      onZoomDragMouseMove, onZoomDragMouseUp,
      onMarqueeMouseMove, onMarqueeMouseUp,
      onLassoMouseMove, onLassoMouseUp,
      onPolygonDrawMouseMove,
      applyZoom, zoomToFit, zoomToSelection,
      handleMouseUp,
    })

    // Free-draw paths: assign ID/properties BEFORE setupDocumentSync so boardSync's
    // object:added handler finds a valid ID and writes the path to Supabase.
    // If this fires after boardSync, emitAdd sees no ID and silently skips the path.
    const assignFreeDrawPathId = (e: { target?: FabricObject }) => {
      const obj = e.target
      if (!obj || obj.type !== 'path' || getObjectId(obj)) return
      setObjectId(obj, crypto.randomUUID())
      setObjectZIndex(obj, Date.now())
      obj.set('perPixelTargetFind', true)
      const existingData = (obj.get('data') as Record<string, unknown>) ?? {}
      obj.set('data', { ...existingData, brushWidth: brushWidthRef.current })
      const zoom = canvasRef.current?.getZoom() ?? 1
      obj.set('strokeWidth', brushWidthRef.current / zoom)
      if (eraserActiveRef.current) obj.set('globalCompositeOperation', 'destination-out')
      if (brushOpacityRef.current < 1) obj.set('opacity', brushOpacityRef.current)
    }

    // Snap-to-grid: registered before boardSync so snapped position is what gets synced
    // NOTE: Snap uses square grid regardless of gridType.
    // Hex-grid-specific snap (nearest hex center) is a future enhancement.
    const handleSnapToGrid = (e: { target?: FabricObject }) => {
      if (!snapToGridRef.current || !e.target) return
      const obj = e.target
      const snapSize = 20
      obj.set('left', Math.round((obj.left ?? 0) / snapSize) * snapSize)
      obj.set('top', Math.round((obj.top ?? 0) / snapSize) * snapSize)
      obj.setCoords()
      fabricCanvas.requestRenderAll()
    }

    const attachTextEditOnDblClick = (obj: FabricObject) => {
      const handler = () => {
        const text = getTextToEdit(obj)
        if (text) tryEnterTextEditing(text)
      }
      obj.on('mousedblclick', handler)
      return () => obj.off('mousedblclick', handler)
    }

    const handleObjectAdded = (e: { target?: FabricObject }) => {
      const obj = e.target
      if (!obj) return
      if (isDataTable(obj)) notifyFormFrames()
      // Free-draw path properties (ID, brushWidth, strokeWidth, perPixelTargetFind, etc.)
      // are assigned by assignFreeDrawPathId, which is registered BEFORE setupDocumentSync.
      if (isConnector(obj)) connectorCacheSet.add(obj)
      applyConnectorControls(obj)
      if (isEditableText(obj) || (obj.type === 'group' && getTextToEdit(obj))) {
        attachTextEditOnDblClick(obj)
      }
    }

    const handleObjectRemoved = (e: { target?: FabricObject }) => {
      if (e.target) {
        connectorCacheSet.delete(e.target)
        if (isDataTable(e.target)) notifyFormFrames()
      }
    }

    const hasITextChild = (obj: FabricObject): boolean => {
      if (obj.type === 'i-text') return true
      if (obj.type === 'group' && 'getObjects' in obj) {
        return (obj as unknown as { getObjects(): FabricObject[] }).getObjects().some(hasITextChild)
      }
      return false
    }

    const notifySelectionChange = () => {
      const active = fabricCanvas.getActiveObject()
      if (!active) {
        onSelectedCountChangeRef.current?.(0)
        onSelectionChangeRef.current?.(null)
        return
      }
      const selCount = active.type === 'activeselection' && 'getObjects' in active
        ? (active as unknown as { getObjects(): FabricObject[] }).getObjects().length
        : 1
      onSelectedCountChangeRef.current?.(selCount)
      const isActiveSelection = active.type === 'activeselection'
      const isGroup = active.type === 'group'
      const groupData = isGroup ? (active.get('data') as { subtype?: string } | undefined) : undefined
      const isFrameGroup = isGroup && groupData?.subtype === 'frame'
      const isSticky = isGroup && !isFrameGroup && hasITextChild(active)
      const isContainerGroup = isGroup && !isFrameGroup && (groupData?.subtype === 'container' || (!isSticky && 'getObjects' in active && (active as unknown as { getObjects(): FabricObject[] }).getObjects().length >= 2))
      const canGroup = isActiveSelection && 'getObjects' in active
        ? (active as unknown as { getObjects(): FabricObject[] }).getObjects().length >= 2
        : false
      const canUngroup = isContainerGroup
      const isTextOnly = isTextOnlySelection(active)
      const isStickyNote = isStickyGroup(active)
      /** Stickers are fabric.Text (type 'text'); only size via corner handles can change — no fill/font controls. */
      const isSticker = active.type === 'text'
      const hasText = !isSticker && hasEditableText(active)
      const isConnectorObj = isConnector(active)
      const connectorInfo = isConnectorObj ? getConnectorData(active) : null
      const frameFormSchema = isFrameGroup
        ? ((active.get('data') as { formSchema?: FormSchema | null } | undefined)?.formSchema ?? null)
        : null
      onSelectionChangeRef.current?.({
        strokeWidth: getStrokeWidthFromObject(active) ?? 0,
        strokeColor: getStrokeColorFromObject(active),
        fill: isSticker ? null : getFillFromObject(active),
        canGroup,
        canUngroup,
        isTextOnly,
        isStickyNote,
        fontFamily: hasText ? getFontFamilyFromObject(active) ?? 'Arial' : null,
        fontSize: hasText ? getFontSizeFromObject(active) ?? null : null,
        isConnector: isConnectorObj,
        arrowMode: connectorInfo?.arrowMode ?? null,
        strokeDash: connectorInfo?.strokeDash ?? null,
        isFrame: isFrameGroup,
        frameFormSchema,
      })
    }

    const handleSelectionCreated = (e: { selected?: FabricObject[] }) => {
      const selected = e.selected
      if (!selected || selected.length !== 1) {
        notifySelectionChange()
        return
      }
      const obj = selected[0]
      // If a child of a Group was selected, select the parent Group instead
      if (obj && obj.group) {
        fabricCanvas.discardActiveObject()
        fabricCanvas.setActiveObject(obj.group)
        fabricCanvas.requestRenderAll()
        notifySelectionChange()
        return
      }
      // Apply waypoint handles when a connector is selected
      if (obj && isConnector(obj)) {
        applyConnectorWaypointControls(obj, fabricCanvas)
        fabricCanvas.requestRenderAll()
      }
      notifySelectionChange()
    }

    const handleSelectionUpdated = (e: { selected?: FabricObject[]; deselected?: FabricObject[] }) => {
      // Apply/clear waypoint controls on connector selection change
      const selected = e.selected ?? []
      const deselected = e.deselected ?? []
      for (const obj of selected) {
        if (isConnector(obj)) applyConnectorWaypointControls(obj, fabricCanvas)
      }
      for (const obj of deselected) {
        if (isConnector(obj)) clearConnectorWaypointControls(obj)
      }
      notifySelectionChange()
    }

    const handleSelectionCleared = (e: { deselected?: FabricObject[] }) => {
      const deselected = e.deselected ?? []
      for (const obj of deselected) {
        if (isConnector(obj)) clearConnectorWaypointControls(obj)
      }
      notifySelectionChange()
    }

    let transformNotifyRaf: number | null = null
    const handleObjectTransforming = (e?: { target?: FabricObject }) => {
      st.objectWasTransformed = true
      // Keep the Table overlay in sync while dragging.
      // Check if the object is a Table, or is a Frame whose childIds include a Table.
      const target = e?.target
      if (!target) return
      const needsOverlayUpdate =
        isDataTable(target) ||
        (target.type === 'group' &&
          (target.get('data') as { subtype?: string } | undefined)?.subtype === 'frame')
      if (!needsOverlayUpdate) return
      // Throttle via rAF so we get one overlay update per paint frame, not per Fabric event
      if (transformNotifyRaf !== null) return
      transformNotifyRaf = requestAnimationFrame(() => {
        transformNotifyRaf = null
        notifyFormFrames()
      })
    }

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target
      if (target) {
        normalizeScaleFlips(target)
        bakeFrameOrTableGroupScale(target)
        if (target.type === 'group' && 'getObjects' in target) {
          const groupData = target.get('data') as { subtype?: string } | undefined
          const subtype = groupData?.subtype
          if (subtype !== 'container' && subtype !== 'frame' && subtype !== 'table') {
            updateStickyTextFontSize(target)
          }
          if (subtype === 'table') notifyFormFrames()
        }
      }
    }

    // Notify when a remote table update changes its data (formSchema, etc.)
    const handleFrameDataChanged = () => notifyFormFrames()

    const drawGrid = () => {
      if (gridTypeRef.current === 'square') drawCanvasGrid(fabricCanvas)
      else if (gridTypeRef.current === 'hex') drawHexGrid(fabricCanvas)
    }
    let connectorCacheArray: FabricObject[] = []
    let connectorCacheDirty = true
    const origAdd = connectorCacheSet.add.bind(connectorCacheSet)
    const origDel = connectorCacheSet.delete.bind(connectorCacheSet)
    connectorCacheSet.add = (v) => { connectorCacheDirty = true; return origAdd(v) }
    connectorCacheSet.delete = (v) => { connectorCacheDirty = true; return origDel(v) }
    const drawArrows = () => {
      if (connectorCacheDirty) {
        connectorCacheArray = Array.from(connectorCacheSet)
        connectorCacheDirty = false
      }
      drawConnectorArrows(fabricCanvas, connectorCacheArray)
    }
    const drawHoverPorts = () => {
      const ctx = fabricCanvas.getContext()
      const vpt = fabricCanvas.viewportTransform
      if (!ctx || !vpt) return
      // Highlight during connector-draw hover
      if (st.connectorHoverSnap) {
        ctx.save()
        drawConnectorPortHighlight(ctx, st.connectorHoverSnap.obj, st.connectorHoverSnap.port, vpt)
        ctx.restore()
      }
      // Highlight during floating-endpoint drag
      const epSnap = (fabricCanvas as unknown as { _epDragSnap?: { obj: unknown; port: unknown } | null })._epDragSnap
      if (epSnap?.obj) {
        ctx.save()
        drawConnectorPortHighlight(ctx, epSnap.obj as Parameters<typeof drawConnectorPortHighlight>[1], epSnap.port as Parameters<typeof drawConnectorPortHighlight>[2], vpt)
        ctx.restore()
      }
    }

    const handleConnectorDrawStart = (opt: { sourceObj?: FabricObject; port?: ConnectorPort }) => {
      if (opt.sourceObj && opt.port) {
        st.connectorDrawState = { sourceObj: opt.sourceObj, port: opt.port }
        fabricCanvas.discardActiveObject()
      }
    }
    const handlePathCreated = () => {
      if (toolRef.current === 'draw') onToolChangeRef.current?.('select')
    }
  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWindowMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDblClick,
    handleMouseUpForText,
    handleKeyDown,
    handleKeyUp,
    handleSnapToGrid,
    handleObjectAdded,
    handleObjectRemoved,
    handleSelectionCreated,
    handleSelectionUpdated,
    handleSelectionCleared,
    handleObjectTransforming,
    handleObjectModified,
    handleFrameDataChanged,
    handleConnectorDrawStart,
    handlePathCreated,
    assignFreeDrawPathId,
    notifySelectionChange,
    drawGrid,
    drawArrows,
    drawHoverPorts,
    getTextToEdit,
    attachTextEditOnDblClick,
    cancelTransformRaf: () => {
      if (transformNotifyRaf !== null) cancelAnimationFrame(transformNotifyRaf)
    },
  }
}
