import { useEffect } from 'react'
import type React from 'react'
import { createFabricCanvasEventHandlers, isEditableText, type FabricCanvasInteractionState } from './fabricCanvasEventHandlers'
import {
  Canvas,
  ActiveSelection,
  Intersection,
  Point,
  Polygon,
  Polyline,
  Rect,
  type FabricObject,
} from 'fabric'
import { createHistoryManager, type HistoryManager } from '../lib/historyManager'
import type { ToolType } from '../types/tools'
import type { StickerKind } from '../lib/pirateStickerFactory'
import { updateFrameTitleVisibility } from '../lib/frameUtils'
import { isDataTable, updateTableTitleVisibility, getTableData } from '../lib/dataTableUtils'
import type { FormFrameSceneInfo } from '../lib/frameFormTypes'
import {
  setupDocumentSync,
  getObjectId,
  setObjectId,
  setObjectZIndex,
  type LockStateCallbackRef,
} from '../lib/boardSync'
import {
  type ConnectorPort,
  type ConnectorSnapResult,
} from '../lib/connectorPortUtils'
import { createHistoryEventHandlers } from '../lib/fabricCanvasHistoryHandlers'
import { createZoomHandlers, MIN_ZOOM, MAX_ZOOM } from '../lib/fabricCanvasZoom'
import { loadViewport } from '../lib/viewportPersistence'
import { isVisibleAtZoom } from '../lib/scaleBands'
import type { FabricCanvasZoomHandle, ConnectorDropState, SelectionStrokeInfo } from '../types/fabricCanvasTypes'

export interface FabricCanvasSetupDeps {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.MutableRefObject<Canvas | null>
  historyRef: React.MutableRefObject<HistoryManager | null>
  zoomApiRef: React.MutableRefObject<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit' | 'zoomToSelection'> | null>
  notifyFormFramesRef: React.MutableRefObject<(() => void) | null>
  applyLockStateCallbackRef: React.MutableRefObject<LockStateCallbackRef['current']>
  preModifySnapshotsRef: React.MutableRefObject<Map<string, Record<string, unknown>>>
  isRemoteChangeRef: React.MutableRefObject<boolean>
  fabricImperativeRef: React.MutableRefObject<FabricCanvasZoomHandle | null>
  lastScenePointRef: React.MutableRefObject<{ x: number; y: number } | null>
  toolRef: React.MutableRefObject<ToolType>
  stickerKindRef: React.MutableRefObject<StickerKind>
  boardModeRef: React.MutableRefObject<'standard' | 'explorer'>
  polygonSidesRef: React.MutableRefObject<number>
  starModeRef: React.MutableRefObject<boolean>
  gridTypeRef: React.MutableRefObject<'square' | 'hex' | 'none'>
  snapToGridRef: React.MutableRefObject<boolean>
  brushOpacityRef: React.MutableRefObject<number>
  brushWidthRef: React.MutableRefObject<number>
  eraserActiveRef: React.MutableRefObject<boolean>
  lockOptsRef: React.MutableRefObject<{ userId: string; userName: string }>
  onPointerMoveRef: React.MutableRefObject<((sp: { x: number; y: number }) => void) | undefined>
  onViewportChangeRef: React.MutableRefObject<((vpt: number[]) => void) | undefined>
  onFormFramesChangeRef: React.MutableRefObject<((frames: FormFrameSceneInfo[]) => void) | undefined>
  onSelectionChangeRef: React.MutableRefObject<((info: SelectionStrokeInfo | null) => void) | undefined>
  onHistoryChangeRef: React.MutableRefObject<((canUndo: boolean, canRedo: boolean) => void) | undefined>
  onObjectCountChangeRef: React.MutableRefObject<((count: number) => void) | undefined>
  onSelectedCountChangeRef: React.MutableRefObject<((count: number) => void) | undefined>
  onBoardReadyRef: React.MutableRefObject<(() => void) | undefined>
  onToolChangeRef: React.MutableRefObject<((tool: ToolType) => void) | undefined>
  onFpsChangeRef: React.MutableRefObject<((fps: number) => void) | undefined>
  onSyncLatencyRef: React.MutableRefObject<((ms: number) => void) | undefined>
  onFogRevealRef: React.MutableRefObject<((cx: number, cy: number, radius: number) => void) | undefined>
  revealRadiusRef: React.MutableRefObject<number>
  onTableEditStartRef: React.MutableRefObject<((objectId: string) => void) | undefined>
  onTableEditEndRef: React.MutableRefObject<(() => void) | undefined>
  setConnectorDropMenuState: React.Dispatch<React.SetStateAction<ConnectorDropState | null>>
  width: number
  height: number
  boardId?: string
}

export function useFabricCanvasSetup({
  containerRef,
  canvasRef,
  historyRef,
  zoomApiRef,
  notifyFormFramesRef,
  applyLockStateCallbackRef,
  preModifySnapshotsRef,
  isRemoteChangeRef,
  fabricImperativeRef,
  lastScenePointRef,
  toolRef,
  stickerKindRef,
  boardModeRef,
  polygonSidesRef,
  starModeRef,
  gridTypeRef,
  snapToGridRef,
  brushOpacityRef,
  brushWidthRef,
  eraserActiveRef,
  lockOptsRef,
  onPointerMoveRef,
  onViewportChangeRef,
  onFormFramesChangeRef,
  onSelectionChangeRef,
  onHistoryChangeRef,
  onObjectCountChangeRef,
  onSelectedCountChangeRef,
  onBoardReadyRef,
  onToolChangeRef,
  onFpsChangeRef,
  onSyncLatencyRef,
  onFogRevealRef,
  revealRadiusRef,
  onTableEditStartRef,
  onTableEditEndRef,
  setConnectorDropMenuState,
  width,
  height,
  boardId,
}: FabricCanvasSetupDeps): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const canvasEl = document.createElement('canvas')
    canvasEl.width = width
    canvasEl.height = height
    el.appendChild(canvasEl)

    const fabricCanvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      skipOffscreen: true, // Viewport culling: skip rendering off-screen objects (500+ perf)
      backgroundColor: 'transparent',
    })
    canvasRef.current = fabricCanvas

    // History manager — tracks local add/remove/modify; skips remote changes via isRemoteChangeRef
    const history = createHistoryManager(fabricCanvas, (canUndo, canRedo) => {
      onHistoryChangeRef.current?.(canUndo, canRedo)
    })
    historyRef.current = history

    // Resolve target to syncable objects (mirrors boardSync getObjectsToSync)
    const getObjectsToHistorize = (target: FabricObject): FabricObject[] => {
      if (getObjectId(target)) return [target]
      if ('getObjects' in target) {
        return (target as { getObjects: () => FabricObject[] }).getObjects().filter((o) => !!getObjectId(o))
      }
      return []
    }

    // Connector cache — updated on object:added/removed to avoid O(N) scan on every render frame
    const connectorCacheSet = new Set<FabricObject>()

    const st: FabricCanvasInteractionState = {
      isPanning: false,
      isDrawing: false,
      spacePressed: false,
      lastPointer: null as { x: number; y: number } | null,
      drawStart: null as { x: number; y: number } | null,
      drawEnd: null as { x: number; y: number } | null,
      previewObj: null as FabricObject | null,
      objectWasTransformed: false,
      connectorDrawState: null as { sourceObj: FabricObject; port: ConnectorPort } | null,
      connectorPreviewLine: null as Polyline | null,
      lastConnectorDrawPoint: null as { x: number; y: number } | null,
      connectorHoverSnap: null as ConnectorSnapResult | null,
      marqueeState: null as { start: { x: number; y: number }; rect: Rect } | null,
      zoomDragState: null as { start: { x: number; y: number }; rect: Rect } | null,
      lassoState: null as { points: { x: number; y: number }[]; preview: Polyline } | null,
      polygonDrawState: null as { points: Array<{ x: number; y: number }>; preview: Polyline | null } | null,
    }

    const getScenePoint = (opt: {
      scenePoint?: { x: number; y: number }
      viewportPoint?: { x: number; y: number }
    }) => {
      if (opt.scenePoint) return opt.scenePoint
      const vp = opt.viewportPoint
      if (!vp) return null
      const t = fabricCanvas.viewportTransform
      if (!t) return { x: vp.x, y: vp.y }
      const zoom = t[0]
      return { x: (vp.x - t[4]) / zoom, y: (vp.y - t[5]) / zoom }
    }

    const notifyFormFrames = () => {
      const cb = onFormFramesChangeRef.current
      if (!cb) return
      const tables = fabricCanvas.getObjects().filter(isDataTable).map((t) => {
        const tableData = getTableData(t)
        return {
          objectId: tableData?.id ?? '',
          title: tableData?.title ?? 'Untitled Table',
          showTitle: tableData?.showTitle ?? false,
          accentColor: tableData?.accentColor,
          sceneLeft: t.left,
          sceneTop: t.top,
          sceneWidth: (t as FabricObject & { width: number }).width,
          sceneHeight: (t as FabricObject & { height: number }).height,
          scaleX: t.scaleX ?? 1,
          scaleY: t.scaleY ?? 1,
          formSchema: tableData?.formSchema ?? null,
        }
      }).filter((info) => info.objectId)
      cb(tables)
    }
    notifyFormFramesRef.current = notifyFormFrames

    const notifyViewport = () => {
      const vpt = fabricCanvas.viewportTransform
      if (vpt && onViewportChangeRef.current) onViewportChangeRef.current([...vpt])
      updateFrameTitleVisibility(fabricCanvas)
      updateTableTitleVisibility(fabricCanvas)
      // Full zoom compensation: brush and all drawn paths are zoom-invariant
      // (always brushWidth screen pixels wide regardless of zoom level).
      const currentZoom = fabricCanvas.getZoom()
      if (fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.width = brushWidthRef.current / currentZoom
      }
      // Recompute strokeWidth for all free-draw paths so they remain visible at any zoom
      let needsRender = false
      for (const obj of fabricCanvas.getObjects()) {
        if (obj.type === 'path') {
          const data = obj.get('data') as { brushWidth?: number } | undefined
          if (data?.brushWidth != null) {
            const target = data.brushWidth / currentZoom
            if (Math.abs((obj.strokeWidth ?? 0) - target) > 0.0001) {
              obj.set('strokeWidth', target)
              needsRender = true
            }
          }
        }
      }
      if (needsRender) fabricCanvas.requestRenderAll()
      // LOD visibility: hide/show objects based on their minZoom/maxZoom (explorer mode only)
      if (boardModeRef.current === 'explorer') {
        const zoom = fabricCanvas.getZoom()
        for (const obj of fabricCanvas.getObjects()) {
          const data = obj.get('data') as { minZoom?: number; maxZoom?: number } | undefined
          if (data?.minZoom != null || data?.maxZoom != null) {
            const shouldShow = isVisibleAtZoom(data, zoom)
            if (obj.visible !== shouldShow) {
              obj.visible = shouldShow
              obj.evented = shouldShow
            }
          }
        }
      }
    }

    const { applyZoom, zoomToFit, zoomToSelection, handleWheel } = createZoomHandlers(fabricCanvas, width, height, notifyViewport)

    // Restore saved viewport for this board, then always notify so overlays have a transform from the start
    if (boardId) {
      const saved = loadViewport(boardId)
      if (saved && saved.length === 6) {
        fabricCanvas.viewportTransform = [saved[0], saved[1], saved[2], saved[3], saved[4], saved[5]]
        fabricCanvas.requestRenderAll()
      }
    }
    notifyViewport()

    const notifyObjectCount = () => {
      onObjectCountChangeRef.current?.(fabricCanvas.getObjects().length)
    }
    fabricCanvas.on('object:added', notifyObjectCount)
    fabricCanvas.on('object:removed', notifyObjectCount)
    notifyObjectCount()

    // Marquee mode: DOM capture so we intercept BEFORE Fabric (works when starting on objects).
    // Support Cmd (Mac), Option/Alt, or Ctrl — any modifier triggers marquee.
    // We use DOM-level mousemove/mouseup listeners to avoid relying on Fabric's event system,
    // which requires Fabric to have processed mousedown first.
    const upperEl = fabricCanvas.upperCanvasEl

    const onMarqueeMouseMove = (ev: MouseEvent) => {
      if (!st.marqueeState) return
      const sp = fabricCanvas.getScenePoint(ev)
      const { start, rect } = st.marqueeState
      const l = Math.min(start.x, sp.x)
      const t = Math.min(start.y, sp.y)
      const w = Math.abs(sp.x - start.x)
      const h = Math.abs(sp.y - start.y)
      rect.set({ left: l, top: t, width: w, height: h })
      rect.setCoords()
      fabricCanvas.requestRenderAll()
    }

    const onMarqueeMouseUp = () => {
      if (!st.marqueeState) return
      const { rect } = st.marqueeState
      const l = rect.left ?? 0
      const t = rect.top ?? 0
      const w = rect.width ?? 0
      const h = rect.height ?? 0
      const tl = new Point(l, t)
      const br = new Point(l + w, t + h)
      fabricCanvas.remove(rect)
      st.marqueeState = null
      document.removeEventListener('mousemove', onMarqueeMouseMove)
      document.removeEventListener('mouseup', onMarqueeMouseUp)
      const objects = fabricCanvas.getObjects().filter((o) => {
        const id = getObjectId(o)
        if (!id) return false
        // Free-draw paths have large bounding boxes; only include when fully
        // contained so they don't hijack small selections.
        if (o.type === 'path') return o.isContainedWithinRect(tl, br)
        // intersectsWithRect only returns true for edge-crossing (partial overlap),
        // NOT when an object is fully contained inside the rect. Check both.
        return o.intersectsWithRect(tl, br) || o.isContainedWithinRect(tl, br)
      })
      if (objects.length > 0) {
        const sel = new ActiveSelection(objects, { canvas: fabricCanvas })
        fabricCanvas.setActiveObject(sel)
        sel.setCoords()
      }
      fabricCanvas.requestRenderAll()
    }

    const onZoomDragMouseMove = (ev: MouseEvent) => {
      if (!st.zoomDragState) return
      const sp = fabricCanvas.getScenePoint(ev)
      const { start, rect } = st.zoomDragState
      const l = Math.min(start.x, sp.x)
      const t = Math.min(start.y, sp.y)
      rect.set({ left: l, top: t, width: Math.abs(sp.x - start.x), height: Math.abs(sp.y - start.y) })
      fabricCanvas.requestRenderAll()
    }

    const onZoomDragMouseUp = () => {
      if (!st.zoomDragState) return
      const { rect } = st.zoomDragState
      const l = rect.left ?? 0
      const t = rect.top ?? 0
      const w = rect.width ?? 0
      const h = rect.height ?? 0
      fabricCanvas.remove(rect)
      st.zoomDragState = null
      document.removeEventListener('mousemove', onZoomDragMouseMove)
      document.removeEventListener('mouseup', onZoomDragMouseUp)
      if (w > 5 && h > 5) {
        const padding = 20
        const contentW = w + padding * 2
        const contentH = h + padding * 2
        const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(width / contentW, height / contentH)))
        const cx = l + w / 2
        const cy = t + h / 2
        const vpt = fabricCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
        vpt[0] = fitZoom
        vpt[3] = fitZoom
        vpt[4] = width / 2 - cx * fitZoom
        vpt[5] = height / 2 - cy * fitZoom
        fabricCanvas.requestRenderAll()
        if (onViewportChangeRef.current) onViewportChangeRef.current([...vpt])
        updateFrameTitleVisibility(fabricCanvas)
        updateTableTitleVisibility(fabricCanvas)
      }
    }

    const onLassoMouseMove = (ev: MouseEvent) => {
      if (!st.lassoState) return
      const sp = fabricCanvas.getScenePoint(ev)
      st.lassoState.points.push(sp)
      const pts = st.lassoState.points.map((p) => ({ x: p.x, y: p.y }))
      if (pts.length >= 2) {
        const poly = st.lassoState.preview as { points: { x: number; y: number }[]; setBoundingBox: (v?: boolean) => void }
        poly.points = pts
        poly.setBoundingBox(true)
      }
      fabricCanvas.requestRenderAll()
    }

    const onLassoMouseUp = () => {
      if (!st.lassoState) return
      const { points, preview } = st.lassoState
      fabricCanvas.remove(preview)
      st.lassoState = null
      document.removeEventListener('mousemove', onLassoMouseMove)
      document.removeEventListener('mouseup', onLassoMouseUp)
      if (points.length >= 3) {
        const polygonPoints = points.map((p) => new Point(p.x, p.y))
        const objects = fabricCanvas.getObjects().filter((o) => {
          const id = getObjectId(o)
          if (!id) return false
          const coords = o.getCoords()
          const cx = (coords[0].x + coords[1].x + coords[2].x + coords[3].x) / 4
          const cy = (coords[0].y + coords[1].y + coords[2].y + coords[3].y) / 4
          const center = new Point(cx, cy)
          return Intersection.isPointInPolygon(center, polygonPoints)
        })
        if (objects.length > 0) {
          const sel = new ActiveSelection(objects, { canvas: fabricCanvas })
          fabricCanvas.setActiveObject(sel)
          sel.setCoords()
        }
      }
      fabricCanvas.requestRenderAll()
    }

    const onPolygonDrawMouseMove = (ev: MouseEvent) => {
      if (!st.polygonDrawState || st.polygonDrawState.points.length === 0) return
      const sp = fabricCanvas.getScenePoint(ev)
      const preview = st.polygonDrawState.preview as { points: { x: number; y: number }[]; setBoundingBox: (v?: boolean) => void } | null
      if (preview) {
        preview.points = [...st.polygonDrawState.points, sp]
        preview.setBoundingBox(true)
      }
      fabricCanvas.requestRenderAll()
    }

    const closePolygonDraw = () => {
      if (!st.polygonDrawState) return
      const { points, preview } = st.polygonDrawState
      if (preview) fabricCanvas.remove(preview)
      document.removeEventListener('mousemove', onPolygonDrawMouseMove)
      st.polygonDrawState = null
      if (points.length >= 3) {
        const poly = new Polygon(points, {
          fill: '#ffffff',
          stroke: '#1e293b',
          strokeWidth: 2,
          originX: 'left',
          originY: 'top',
          selectable: true,
          evented: true,
        })
        setObjectId(poly, crypto.randomUUID())
        setObjectZIndex(poly, Date.now())
        fabricCanvas.add(poly)
        fabricCanvas.setActiveObject(poly)
        fabricCanvas.requestRenderAll()
      }
      onToolChangeRef.current?.('select')
    }

    const onCaptureMouseDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return
      const tool = toolRef.current

      if (tool === 'reveal') {
        ev.preventDefault()
        ev.stopImmediatePropagation()
        const sp = fabricCanvas.getScenePoint(ev)
        const radius = revealRadiusRef.current
        onFogRevealRef.current?.(sp.x, sp.y, radius)
        return
      }

      if (tool === 'select') {
        const mod = ev.altKey || ev.metaKey || ev.ctrlKey
        if (!mod) return
        ev.preventDefault()
        ev.stopImmediatePropagation()
        const sp = fabricCanvas.getScenePoint(ev)
        fabricCanvas.discardActiveObject()
        const rect = new Rect({
          left: sp.x,
          top: sp.y,
          width: 0,
          height: 0,
          originX: 'left',
          originY: 'top',
          fill: 'rgba(59, 130, 246, 0.1)',
          stroke: '#2563eb',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        })
        rect.set('data', {})
        fabricCanvas.add(rect)
        st.marqueeState = { start: sp, rect }
        document.addEventListener('mousemove', onMarqueeMouseMove)
        document.addEventListener('mouseup', onMarqueeMouseUp)
        return
      }

      if (tool === 'zoom-in') {
        ev.preventDefault()
        ev.stopImmediatePropagation()
        const sp = fabricCanvas.getScenePoint(ev)
        fabricCanvas.discardActiveObject()
        const rect = new Rect({
          left: sp.x,
          top: sp.y,
          width: 0,
          height: 0,
          originX: 'left',
          originY: 'top',
          fill: 'rgba(59, 130, 246, 0.08)',
          stroke: '#2563eb',
          strokeWidth: 1,
          strokeDashArray: [4, 4],
          selectable: false,
          evented: false,
        })
        rect.set('data', {})
        fabricCanvas.add(rect)
        st.zoomDragState = { start: sp, rect }
        document.addEventListener('mousemove', onZoomDragMouseMove)
        document.addEventListener('mouseup', onZoomDragMouseUp)
        return
      }

      if (tool === 'lasso') {
        ev.preventDefault()
        ev.stopImmediatePropagation()
        const sp = fabricCanvas.getScenePoint(ev)
        fabricCanvas.discardActiveObject()
        const preview = new Polyline([sp, sp], {
          fill: 'rgba(59, 130, 246, 0.1)',
          stroke: '#2563eb',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        })
        preview.set('data', {})
        fabricCanvas.add(preview)
        st.lassoState = { points: [sp], preview }
        document.addEventListener('mousemove', onLassoMouseMove)
        document.addEventListener('mouseup', onLassoMouseUp)
      }

      if (tool === 'polygon-draw') {
        ev.preventDefault()
        ev.stopImmediatePropagation()
        const sp = fabricCanvas.getScenePoint(ev)

        // Clicking within 10px of the first point closes the polygon (3+ points required)
        if (st.polygonDrawState && st.polygonDrawState.points.length >= 3) {
          const first = st.polygonDrawState.points[0]!
          const zoom = fabricCanvas.getZoom()
          const threshold = 10 / zoom
          const dist = Math.sqrt((sp.x - first.x) ** 2 + (sp.y - first.y) ** 2)
          if (dist < threshold) {
            closePolygonDraw()
            return
          }
        }

        if (!st.polygonDrawState) {
          // First vertex: create the preview polyline
          fabricCanvas.discardActiveObject()
          const preview = new Polyline([sp, sp], {
            fill: 'rgba(99, 102, 241, 0.1)',
            stroke: '#6366f1',
            strokeWidth: 1,
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false,
          })
          preview.set('data', {})
          fabricCanvas.add(preview)
          st.polygonDrawState = { points: [sp], preview }
          document.addEventListener('mousemove', onPolygonDrawMouseMove)
        } else {
          // Subsequent vertex: append and update preview
          st.polygonDrawState.points.push(sp)
          const previewPoly = st.polygonDrawState.preview as { points: { x: number; y: number }[]; setBoundingBox: (v?: boolean) => void } | null
          if (previewPoly) {
            previewPoly.points = [...st.polygonDrawState.points]
            previewPoly.setBoundingBox(true)
          }
          fabricCanvas.requestRenderAll()
        }
      }
    }
    upperEl.addEventListener('mousedown', onCaptureMouseDown, { capture: true })


    const {
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
      drawGrid,
      drawArrows,
      drawHoverPorts,
      getTextToEdit,
      attachTextEditOnDblClick,
      cancelTransformRaf,
    } = createFabricCanvasEventHandlers(
      fabricCanvas,
      st,
      {
        canvasRef,
        fabricImperativeRef, lastScenePointRef,
        toolRef, stickerKindRef, polygonSidesRef, starModeRef,
        gridTypeRef, snapToGridRef, brushOpacityRef, brushWidthRef, eraserActiveRef,
        onPointerMoveRef, onViewportChangeRef, onSelectionChangeRef, onSelectedCountChangeRef,
        onToolChangeRef, onTableEditStartRef, onTableEditEndRef,
        setConnectorDropMenuState, width, height,
      },
      {
        onMarqueeMouseMove, onMarqueeMouseUp,
        onZoomDragMouseMove, onZoomDragMouseUp,
        onLassoMouseMove, onLassoMouseUp,
        onPolygonDrawMouseMove, closePolygonDraw,
        getScenePoint, notifyFormFrames, notifyViewport,
        connectorCacheSet, getObjectsToHistorize, applyZoom,
        zoomToFit, zoomToSelection, history, canvasEl,
      }
    )

    fabricCanvas.on('connector:draw:start' as never, handleConnectorDrawStart)
    fabricCanvas.on('path:created', handlePathCreated)
    fabricCanvas.on('object:added', handleObjectAdded)
    fabricCanvas.on('object:removed', handleObjectRemoved)
    fabricCanvas.on('object:modified', handleObjectModified)
    fabricCanvas.on('selection:created', handleSelectionCreated)
    fabricCanvas.on('selection:updated', handleSelectionUpdated)
    fabricCanvas.on('selection:cleared', handleSelectionCleared)
    fabricCanvas.getObjects().forEach((obj) => {
      if (isEditableText(obj) || (obj.type === 'group' && getTextToEdit(obj))) {
        attachTextEditOnDblClick(obj)
      }
    })
    // Track when objects are transformed (moved, scaled, rotated)
    fabricCanvas.on('object:moving', handleObjectTransforming)
    fabricCanvas.on('object:scaling', handleObjectTransforming)
    fabricCanvas.on('object:rotating', handleObjectTransforming)
    fabricCanvas.on('mouse:wheel', handleWheel)
    fabricCanvas.on('mouse:down', handleMouseDown)
    fabricCanvas.on('mouse:move', handleMouseMove)
    fabricCanvas.on('mouse:up', handleMouseUp)
    fabricCanvas.on('mouse:up', handleMouseUpForText)
    fabricCanvas.on('mouse:dblclick', handleDblClick)
    window.addEventListener('mouseup', handleWindowMouseUp)

    zoomApiRef.current = { setZoom: applyZoom, zoomToFit, zoomToSelection }

    fabricCanvas.on('before:render', drawGrid)
    fabricCanvas.on('after:render', drawArrows)
    fabricCanvas.on('after:render', drawHoverPorts)
    fabricCanvas.on('object:modified', handleSnapToGrid)
    fabricCanvas.on('object:added', assignFreeDrawPathId)

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvasEl.addEventListener('touchend', handleTouchEnd)
    canvasEl.addEventListener('touchcancel', handleTouchEnd)

    // Document sync — pass getCurrentUserId so move-delta broadcast ignores our own messages
    const connectorCacheRefForSync = { current: connectorCacheSet }
    const cleanupDocSync = boardId
      ? setupDocumentSync(
          fabricCanvas,
          boardId,
          applyLockStateCallbackRef,
          () => lockOptsRef.current.userId,
          isRemoteChangeRef,
          (ms: number) => onSyncLatencyRef.current?.(ms),
          connectorCacheRefForSync,
          () => { onBoardReadyRef.current?.(); notifyFormFrames() }
        )
      : (() => { onBoardReadyRef.current?.(); return () => {} })()

    const canvasAny = fabricCanvas as unknown as { on: (e: string, h: () => void) => void; off: (e: string, h: () => void) => void }
    canvasAny.on('table:data:changed', handleFrameDataChanged)

    // --- History: record local add / modify / remove (skip remote changes) ---
    const {
      handleMoveForHistory,
      handleModifiedForHistory,
      handleAddedForHistory,
      handleSelectionClearedForHistory,
      handleTextEditingEntered,
      handleTextEditingExited,
    } = createHistoryEventHandlers(history, isRemoteChangeRef, preModifySnapshotsRef, getObjectsToHistorize)

    fabricCanvas.on('object:moving', handleMoveForHistory)
    fabricCanvas.on('object:scaling', handleMoveForHistory)
    fabricCanvas.on('object:rotating', handleMoveForHistory)
    fabricCanvas.on('object:modified', handleModifiedForHistory)
    fabricCanvas.on('object:added', handleAddedForHistory)
    fabricCanvas.on('selection:cleared', handleSelectionClearedForHistory)
    fabricCanvas.on('text:editing:entered', handleTextEditingEntered)
    fabricCanvas.on('text:editing:exited', handleTextEditingExited)

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      fabricCanvas.setDimensions({ width: w, height: h })
    })
    resizeObserver.observe(el)

    // FPS tracking via requestAnimationFrame — measures actual browser frame rate
    let fpsFrameCount = 0
    let fpsWindowStart = performance.now()
    let fpsRafId: number | null = null
    const fpsLoop = () => {
      fpsFrameCount++
      const now = performance.now()
      const elapsed = now - fpsWindowStart
      if (elapsed >= 1000) {
        const fps = Math.round((fpsFrameCount * 1000) / elapsed)
        onFpsChangeRef.current?.(fps)
        fpsFrameCount = 0
        fpsWindowStart = now
      }
      fpsRafId = requestAnimationFrame(fpsLoop)
    }
    fpsRafId = requestAnimationFrame(fpsLoop)

    return () => {
      upperEl.removeEventListener('mousedown', onCaptureMouseDown, { capture: true })
      document.removeEventListener('mousemove', onMarqueeMouseMove)
      document.removeEventListener('mouseup', onMarqueeMouseUp)
      document.removeEventListener('mousemove', onZoomDragMouseMove)
      document.removeEventListener('mouseup', onZoomDragMouseUp)
      document.removeEventListener('mousemove', onLassoMouseMove)
      document.removeEventListener('mouseup', onLassoMouseUp)
      document.removeEventListener('mousemove', onPolygonDrawMouseMove)
      zoomApiRef.current = null
      historyRef.current = null
      history.clear()
      cleanupDocSync()
      fabricCanvas.off('before:render', drawGrid)
      fabricCanvas.off('after:render', drawArrows)
      fabricCanvas.off('after:render', drawHoverPorts)
      fabricCanvas.off('connector:draw:start' as never, handleConnectorDrawStart)
      fabricCanvas.off('path:created', handlePathCreated)
      fabricCanvas.off('object:modified', handleSnapToGrid)
      fabricCanvas.off('object:modified', handleObjectModified)
      fabricCanvas.off('object:added', notifyObjectCount)
      fabricCanvas.off('object:removed', notifyObjectCount)
      fabricCanvas.off('object:added', assignFreeDrawPathId)
      fabricCanvas.off('object:added', handleObjectAdded)
      fabricCanvas.off('object:removed', handleObjectRemoved)
      fabricCanvas.off('selection:created', handleSelectionCreated)
      fabricCanvas.off('selection:updated', handleSelectionUpdated)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
      cancelTransformRaf()
      fabricCanvas.off('object:moving', handleObjectTransforming)
      fabricCanvas.off('object:scaling', handleObjectTransforming)
      fabricCanvas.off('object:rotating', handleObjectTransforming)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      fabricCanvas.off('mouse:wheel', handleWheel)
      fabricCanvas.off('mouse:down', handleMouseDown)
      fabricCanvas.off('mouse:move', handleMouseMove)
      fabricCanvas.off('mouse:up', handleMouseUp)
      fabricCanvas.off('mouse:up', handleMouseUpForText)
      fabricCanvas.off('mouse:dblclick', handleDblClick)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      fabricCanvas.off('object:moving', handleMoveForHistory)
      fabricCanvas.off('object:scaling', handleMoveForHistory)
      fabricCanvas.off('object:rotating', handleMoveForHistory)
      fabricCanvas.off('object:modified', handleModifiedForHistory)
      fabricCanvas.off('object:added', handleAddedForHistory)
      fabricCanvas.off('selection:cleared', handleSelectionClearedForHistory)
      fabricCanvas.off('text:editing:entered', handleTextEditingEntered)
      fabricCanvas.off('text:editing:exited', handleTextEditingExited)
      canvasAny.off('table:data:changed', handleFrameDataChanged)
      notifyFormFramesRef.current = null
      if (fpsRafId !== null) cancelAnimationFrame(fpsRafId)
      canvasEl.removeEventListener('touchstart', handleTouchStart)
      canvasEl.removeEventListener('touchmove', handleTouchMove)
      canvasEl.removeEventListener('touchend', handleTouchEnd)
      canvasEl.removeEventListener('touchcancel', handleTouchEnd)
      resizeObserver.disconnect()
      fabricCanvas.dispose()
      el.removeChild(canvasEl)
      canvasRef.current = null
    }
  }, [width, height, boardId])
}
