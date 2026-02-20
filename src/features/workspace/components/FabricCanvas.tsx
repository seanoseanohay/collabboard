import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'
import { Canvas, Group, ActiveSelection, Intersection, Point, Polyline, Rect, util, PencilBrush, type FabricObject } from 'fabric'
import { createHistoryManager, type HistoryManager } from '../lib/historyManager'

/** IText has enterEditing; FabricText does not. Check by method presence. */
function isEditableText(obj: unknown): obj is { enterEditing: () => void } {
  return !!obj && typeof (obj as { enterEditing?: () => void }).enterEditing === 'function'
}
import type { ToolType } from '../types/tools'
import { isShapeTool } from '../types/tools'
import { createShape } from '../lib/shapeFactory'
import { createFrameShape } from '../lib/frameFactory'
import { setFrameChildIds, updateFrameTitleVisibility } from '../lib/frameUtils'
import { createDataTableShape } from '../lib/dataTableFactory'
import { isDataTable, updateTableTitleVisibility, getTableData, setTableFormSchema } from '../lib/dataTableUtils'
import type { FormFrameSceneInfo, FormSchema } from '../lib/frameFormTypes'
import {
  getStrokeWidthFromObject,
  setStrokeWidthOnObject,
  getStrokeColorFromObject,
  setStrokeColorOnObject,
} from '../lib/strokeUtils'
import {
  getFontFamilyFromObject,
  getFontSizeFromObject,
  setFontFamilyOnObject,
  setFontSizeOnObject,
  isTextOnlySelection,
  isStickyGroup,
  hasEditableText,
} from '../lib/fontUtils'
import { getFillFromObject, setFillOnObject } from '../lib/fillUtils'
import { updateStickyTextFontSize, hideStickyPlaceholderForEditing } from '../lib/shapeFactory'
import {
  setupDocumentSync,
  setupLockSync,
  getObjectId,
  setObjectId,
  setObjectZIndex,
  type LockStateCallbackRef,
} from '../lib/boardSync'
import { createSticker, type StickerKind } from '../lib/pirateStickerFactory'
import { applyConnectorControls, applyConnectorWaypointControls, clearConnectorWaypointControls } from '../lib/connectorControls'
import {
  createConnector,
  isConnector,
  getConnectorData,
  floatConnectorEndpoint,
  floatConnectorBothEndpoints,
  updateConnectorEndpoints,
  syncConnectorMoveLock,
  removeWaypoint as removeConnectorWaypoint,
  setConnectorArrowMode,
  setConnectorStrokeDash,
  type ArrowMode,
  type StrokeDash,
} from '../lib/connectorFactory'
import {
  getPortScenePoint,
  getNearestPort,
  findConnectorSnap,
  drawConnectorPortHighlight,
  type ConnectorPort,
  type ConnectorSnapResult,
} from '../lib/connectorPortUtils'
import { drawConnectorArrows } from '../lib/connectorArrows'
import { ConnectorDropMenu, type ConnectorDropShapeType } from './ConnectorDropMenu'
import { bringToFront, sendToBack, bringForward, sendBackward } from '../lib/fabricCanvasZOrder'
import { drawCanvasGrid } from '../lib/drawCanvasGrid'
import { createHistoryEventHandlers } from '../lib/fabricCanvasHistoryHandlers'
import { createZoomHandlers, ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from '../lib/fabricCanvasZoom'
import { normalizeScaleFlips } from '../lib/fabricCanvasScaleFlips'
import { loadViewport } from '../lib/viewportPersistence'
import { getClipboard, setClipboard, hasClipboard } from '../lib/clipboardStore'

export interface SelectionStrokeInfo {
  strokeWidth: number
  strokeColor: string | null
  fill: string | null
  canGroup: boolean
  canUngroup: boolean
  /** True when selection is standalone text (no stroke/border controls). */
  isTextOnly: boolean
  /** True when selection is a sticky note (no stroke/border controls). */
  isStickyNote: boolean
  /** Font family when selection has text (standalone or in group). */
  fontFamily: string | null
  /** Font size when selection has text (standalone or in group). */
  fontSize: number | null
  /** True when the selected object is a connector. */
  isConnector: boolean
  /** Arrow mode for connector (null when not a connector). */
  arrowMode: ArrowMode | null
  /** Stroke dash style for connector (null when not a connector). */
  strokeDash: StrokeDash | null
  /** True when the selected object is a frame. */
  isFrame: boolean
  /** Form schema for the selected frame (null when not a frame or no schema). */
  frameFormSchema: FormSchema | null
}

export interface FabricCanvasZoomHandle {
  setZoom: (zoom: number) => void
  zoomToFit: () => void
  getActiveObject: () => FabricObject | null
  setActiveObjectStrokeWidth: (strokeWidth: number) => void
  setActiveObjectFill: (fill: string) => void
  setActiveObjectStrokeColor: (stroke: string) => void
  setActiveObjectFontFamily: (fontFamily: string) => void
  setActiveObjectFontSize: (fontSize: number) => void
  setActiveConnectorArrowMode: (mode: ArrowMode) => void
  setActiveConnectorStrokeDash: (dash: StrokeDash) => void
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void
  undo: () => void
  redo: () => void
  groupSelected: () => void
  ungroupSelected: () => void
  getSelectedObjectIds: () => string[]
  groupObjectIds: (ids: string[]) => Promise<void>
  createFrame: (params: { title: string; childIds: string[]; left: number; top: number; width: number; height: number }) => string
  setFrameChildren: (frameId: string, childIds: string[]) => void
  panToScene: (sceneX: number, sceneY: number) => void
  captureDataUrl: () => string | null
  resetView: () => void
  duplicateSelected: () => Promise<void>
  copySelected: () => void
  paste: () => Promise<void>
  hasClipboard: () => boolean
  setDrawBrushColor: (color: string) => void
  setDrawBrushWidth: (width: number) => void
  getViewportCenter: () => { x: number; y: number }
  updateFrameFormData: (frameId: string, formSchema: FormSchema | null) => void
  updateTableTitle: (objectId: string, title: string) => void
  getFormFrameInfos: () => FormFrameSceneInfo[]
  createTable: (params: {
    left: number; top: number; width: number; height: number
    title: string; showTitle: boolean; accentColor?: string
    formSchema: FormSchema | null
  }) => string
}

interface ConnectorDropState {
  screenX: number
  screenY: number
  scenePoint: { x: number; y: number }
  sourceId: string
  sourcePort: ConnectorPort
}

interface FabricCanvasProps {
  width?: number
  height?: number
  className?: string
  selectedTool?: ToolType
  selectedStickerKind?: StickerKind
  boardId?: string
  userId?: string
  userName?: string
  onPointerMove?: (scenePoint: { x: number; y: number }) => void
  onViewportChange?: (vpt: number[]) => void
  onSelectionChange?: (info: SelectionStrokeInfo | null) => void
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  onObjectCountChange?: (count: number) => void
  onToolChange?: (tool: ToolType) => void
  onSelectedCountChange?: (count: number) => void
  onBoardReady?: () => void
  onFpsChange?: (fps: number) => void
  onSyncLatency?: (ms: number) => void
  onFormFramesChange?: (frames: FormFrameSceneInfo[]) => void
  onTableEditStart?: (objectId: string) => void
  onTableEditEnd?: () => void
}

/**
 * Fabric.js canvas wrapper with pan/zoom and shape drawing.
 * - Trackpad: two-finger scroll = pan, pinch = zoom at cursor
 * - Mouse wheel: zoom at cursor (pinch on trackpad uses ctrl+wheel)
 * - Pan: middle mouse, Hand tool, or Space+left-drag
 * - Shortcuts: +/− zoom, 0 fit, 1 = 100%
 * - Shape tools: drag to create shape (never select when shape tool active)
 */
const FabricCanvasInner = (
  {
    width = 1200,
    height = 800,
    className,
    selectedTool = 'select',
    selectedStickerKind = 'anchor',
    boardId,
    userId,
    userName,
    onPointerMove,
    onViewportChange,
    onSelectionChange,
    onHistoryChange,
    onObjectCountChange,
    onToolChange,
    onSelectedCountChange,
    onBoardReady,
    onFpsChange,
    onSyncLatency,
    onFormFramesChange,
    onTableEditStart,
    onTableEditEnd,
  }: FabricCanvasProps,
  ref: React.Ref<FabricCanvasZoomHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const [connectorDropMenuState, setConnectorDropMenuState] = useState<ConnectorDropState | null>(null)
  const zoomApiRef = useRef<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit'> | null>(null)
  const toolRef = useRef(selectedTool)
  toolRef.current = selectedTool
  const stickerKindRef = useRef(selectedStickerKind)
  stickerKindRef.current = selectedStickerKind
  const onPointerMoveRef = useRef(onPointerMove)
  onPointerMoveRef.current = onPointerMove
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const onFormFramesChangeRef = useRef(onFormFramesChange)
  onFormFramesChangeRef.current = onFormFramesChange
  const notifyFormFramesRef = useRef<(() => void) | null>(null)
  const onTableEditStartRef = useRef(onTableEditStart)
  useEffect(() => { onTableEditStartRef.current = onTableEditStart }, [onTableEditStart])
  const onTableEditEndRef = useRef(onTableEditEnd)
  useEffect(() => { onTableEditEndRef.current = onTableEditEnd }, [onTableEditEnd])
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onHistoryChangeRef = useRef(onHistoryChange)
  onHistoryChangeRef.current = onHistoryChange
  const onObjectCountChangeRef = useRef(onObjectCountChange)
  onObjectCountChangeRef.current = onObjectCountChange
  const onSelectedCountChangeRef = useRef(onSelectedCountChange)
  onSelectedCountChangeRef.current = onSelectedCountChange
  const onBoardReadyRef = useRef(onBoardReady)
  onBoardReadyRef.current = onBoardReady
  const onToolChangeRef = useRef(onToolChange)
  onToolChangeRef.current = onToolChange
  const onFpsChangeRef = useRef(onFpsChange)
  onFpsChangeRef.current = onFpsChange
  const onSyncLatencyRef = useRef(onSyncLatency)
  onSyncLatencyRef.current = onSyncLatency
  const lockOptsRef = useRef({ userId: userId ?? '', userName: userName ?? 'Anonymous' })
  lockOptsRef.current = { userId: userId ?? '', userName: userName ?? 'Anonymous' }
  const applyLockStateCallbackRef = useRef<LockStateCallbackRef['current']>(null)
  const lastScenePointRef = useRef<{ x: number; y: number } | null>(null)
  const fabricImperativeRef = useRef<FabricCanvasZoomHandle | null>(null)
  // History manager + remote-change flag (shared across useEffect and useImperativeHandle via refs)
  const historyRef = useRef<HistoryManager | null>(null)
  const preModifySnapshotsRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  const isRemoteChangeRef = useRef(false)

  // Capture before-state for an object into preModifySnapshotsRef if not already captured.
  // Called before any property change that will fire object:modified.
  const captureBeforeForHistory = (obj: FabricObject) => {
    const history = historyRef.current
    const id = getObjectId(obj)
    if (!history || !id || preModifySnapshotsRef.current.has(id)) return
    preModifySnapshotsRef.current.set(id, history.snapshot(obj))
  }

  useImperativeHandle(ref, () => {
    const api: FabricCanvasZoomHandle = {
    setZoom: (z) => zoomApiRef.current?.setZoom(z),
    zoomToFit: () => zoomApiRef.current?.zoomToFit(),
    getActiveObject: () => canvasRef.current?.getActiveObject() ?? null,
    setActiveObjectStrokeWidth: (strokeWidth: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      captureBeforeForHistory(active)
      setStrokeWidthOnObject(active, strokeWidth)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectFill: (fill: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      captureBeforeForHistory(active)
      setFillOnObject(active, fill)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectStrokeColor: (stroke: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      captureBeforeForHistory(active)
      setStrokeColorOnObject(active, stroke)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectFontFamily: (fontFamily: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || !hasEditableText(active)) return
      captureBeforeForHistory(active)
      setFontFamilyOnObject(active, fontFamily)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectFontSize: (fontSize: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || !hasEditableText(active)) return
      captureBeforeForHistory(active)
      setFontSizeOnObject(active, fontSize)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveConnectorArrowMode: (mode: ArrowMode) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || !isConnector(active)) return
      captureBeforeForHistory(active)
      setConnectorArrowMode(active, canvas, mode)
      canvas.fire('object:modified', { target: active })
    },
    setActiveConnectorStrokeDash: (dash: StrokeDash) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || !isConnector(active)) return
      captureBeforeForHistory(active)
      setConnectorStrokeDash(active, dash)
      canvas.fire('object:modified', { target: active })
    },
    undo: () => void historyRef.current?.undo(),
    redo: () => void historyRef.current?.redo(),
    bringToFront: () => { if (canvasRef.current) bringToFront(canvasRef.current) },
    sendToBack: () => { if (canvasRef.current) sendToBack(canvasRef.current) },
    bringForward: () => { if (canvasRef.current) bringForward(canvasRef.current) },
    sendBackward: () => { if (canvasRef.current) sendBackward(canvasRef.current) },
    groupSelected: () => {
      const canvas = canvasRef.current
      const history = historyRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || active.type !== 'activeselection') return
      const sel = active as unknown as { getObjects(): FabricObject[] }
      const objects = [...sel.getObjects()]
      if (objects.length < 2) return

      // Collect remove-action data before modifying canvas
      const removeActions = objects.map((obj) => ({
        type: 'remove' as const,
        objectId: getObjectId(obj)!,
        snapshot: history?.snapshot(obj) ?? {},
      })).filter((a) => a.objectId)

      // discardActiveObject restores scene coords to each child
      canvas.discardActiveObject()
      // Remove individual objects — fires object:removed → boardSync deletes each document
      objects.forEach((obj) => canvas.remove(obj))

      // Create container group with a new UUID
      const group = new Group(objects, { originX: 'left', originY: 'top' })
      group.set('data', { id: crypto.randomUUID(), subtype: 'container' })
      setObjectZIndex(group, Date.now())

      // Add to canvas — fires object:added → boardSync writes the group document
      canvas.add(group)
      canvas.setActiveObject(group)
      group.setCoords()
      canvas.requestRenderAll()

      // Record as atomic compound action so Cmd+Z restores all children at once
      history?.pushCompound([
        ...removeActions,
        { type: 'add', objectId: getObjectId(group)!, snapshot: history.snapshot(group) },
      ])
    },
    getSelectedObjectIds: () => {
      const canvas = canvasRef.current
      if (!canvas) return []
      const active = canvas.getActiveObject()
      if (!active) return []
      if (active.type === 'activeselection') {
        const objs = (active as unknown as { getObjects(): FabricObject[] }).getObjects()
        return objs.map((o) => getObjectId(o)).filter((id): id is string => !!id)
      }
      const id = getObjectId(active)
      return id ? [id] : []
    },
    groupObjectIds: async (ids: string[]) => {
      if (ids.length < 2) return
      const canvas = canvasRef.current
      const history = historyRef.current
      if (!canvas) return

      // Poll until all objects are present on the canvas (they arrive via Realtime)
      const deadline = Date.now() + 8000
      let objects: FabricObject[] = []
      while (Date.now() < deadline) {
        objects = ids
          .map((id) => canvas.getObjects().find((o) => getObjectId(o) === id))
          .filter((o): o is FabricObject => !!o)
        if (objects.length === ids.length) break
        await new Promise((r) => setTimeout(r, 150))
      }
      if (objects.length < 2) return

      const removeActions = objects
        .map((obj) => ({ type: 'remove' as const, objectId: getObjectId(obj)!, snapshot: history?.snapshot(obj) ?? {} }))
        .filter((a) => a.objectId)

      canvas.discardActiveObject()
      objects.forEach((obj) => canvas.remove(obj))

      const group = new Group(objects, { originX: 'left', originY: 'top' })
      group.set('data', { id: crypto.randomUUID(), subtype: 'container' })
      setObjectZIndex(group, Date.now())

      canvas.add(group)
      canvas.setActiveObject(group)
      group.setCoords()
      canvas.requestRenderAll()

      history?.pushCompound([
        ...removeActions,
        { type: 'add', objectId: getObjectId(group)!, snapshot: history.snapshot(group) },
      ])
    },
    createFrame: ({ title, childIds, left, top, width, height }) => {
      const canvas = canvasRef.current
      if (!canvas) return ''
      const frame = createFrameShape(left, top, width, height, title)
      setFrameChildIds(frame, childIds)
      // Frames sit behind their children; use zIndex 1 so sortCanvasByZIndex keeps them at back
      setObjectZIndex(frame, 1)
      canvas.add(frame)
      canvas.sendObjectToBack(frame)
      canvas.setActiveObject(frame)
      frame.setCoords()
      canvas.requestRenderAll()
      return getObjectId(frame) ?? ''
    },
    setFrameChildren: (frameId: string, childIds: string[]) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const frame = canvas.getObjects().find((o) => {
        const d = o.get('data') as { id?: string } | undefined
        return d?.id === frameId
      })
      if (!frame) return
      setFrameChildIds(frame, childIds)
      canvas.fire('object:modified', { target: frame })
    },
    panToScene: (sceneX: number, sceneY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const zoom = canvas.getZoom()
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      vpt[4] = width / 2 - sceneX * zoom
      vpt[5] = height / 2 - sceneY * zoom
      canvas.requestRenderAll()
      onViewportChangeRef.current?.(vpt)
    },
    getViewportCenter: () => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 400, y: 300 }
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      const zoom = canvas.getZoom()
      return {
        x: Math.round((width / 2 - vpt[4]) / zoom),
        y: Math.round((height / 2 - vpt[5]) / zoom),
      }
    },
    updateFrameFormData: (objectId: string, formSchema: FormSchema | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const table = canvas.getObjects().find((o) => {
        const d = o.get('data') as { id?: string } | undefined
        return d?.id === objectId
      })
      if (!table || !isDataTable(table)) return
      const data = table.get('data') as Record<string, unknown>
      table.set('data', { ...data, formSchema })
      canvas.fire('object:modified', { target: table })
      notifyFormFramesRef.current?.()
    },
    updateTableTitle: (objectId: string, title: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const table = canvas.getObjects().find((o) => {
        const d = o.get('data') as { id?: string } | undefined
        return d?.id === objectId
      })
      if (!table || !isDataTable(table)) return
      // Update the IText child so the canvas label stays in sync
      const children = (table as unknown as { getObjects(): FabricObject[] }).getObjects?.()
      const titleText = children?.find((c) => c.type === 'i-text')
      if (titleText) titleText.set('text', title)
      const data = table.get('data') as Record<string, unknown>
      table.set('data', { ...data, title })
      table.setCoords()
      canvas.requestRenderAll()
      canvas.fire('object:modified', { target: table })
      notifyFormFramesRef.current?.()
    },
    getFormFrameInfos: (): FormFrameSceneInfo[] => {
      const canvas = canvasRef.current
      if (!canvas) return []
      return canvas.getObjects().filter(isDataTable).map((t) => {
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
      }).filter((t) => t.objectId)
    },
    createTable: (params: {
      left: number; top: number; width: number; height: number
      title: string; showTitle: boolean; accentColor?: string
      formSchema: FormSchema | null
    }): string => {
      const canvas = canvasRef.current
      if (!canvas) return ''
      const obj = createDataTableShape(
        params.left, params.top, params.width, params.height,
        params.title, true, params.showTitle, params.accentColor
      )
      if (params.formSchema) {
        setTableFormSchema(obj, params.formSchema)
        const existing = obj.get('data') as Record<string, unknown>
        obj.set('data', { ...existing, formSchema: params.formSchema })
      }
      canvas.add(obj)
      canvas.requestRenderAll()
      return getObjectId(obj) ?? ''
    },
    resetView: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      vpt[0] = 1
      vpt[3] = 1
      vpt[4] = 0
      vpt[5] = 0
      canvas.requestRenderAll()
      onViewportChangeRef.current?.([...vpt])
    },
    captureDataUrl: (): string | null => {
      const canvas = canvasRef.current
      if (!canvas || canvas.getObjects().length === 0) return null
      // Zoom to fit all objects so the thumbnail frames the content
      zoomApiRef.current?.zoomToFit()
      canvas.renderAll()
      return canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.5 })
    },
    ungroupSelected: () => {
      const canvas = canvasRef.current
      const history = historyRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active || active.type !== 'group') return
      const data = active.get('data') as { id?: string; subtype?: string } | undefined
      if (data?.subtype !== 'container') return

      const groupId = getObjectId(active)!
      const groupSnapshot = history?.snapshot(active) ?? {}
      const groupMatrix = active.calcTransformMatrix()
      const children = (active as unknown as { getObjects(): FabricObject[] }).getObjects()

      // Remove the group — fires object:removed → boardSync deletes the group document
      canvas.discardActiveObject()
      canvas.remove(active)

      // Add each child with scene coordinates and a fresh UUID. Restore selectable/evented
      // (group children are set to false by ensureGroupChildrenNotSelectable).
      const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
      const restoredObjects: FabricObject[] = []
      children.forEach((child) => {
        // Clear BOTH group and parent references before adding children back to canvas.
        //
        // canvas.remove(group) does not call group.remove(child) for each child, so both
        // child.group and child.parent still point to the removed Group.
        //
        // child.group being set causes:
        //   1. emitAdd → payloadWithSceneCoords applies the group matrix a second time onto
        //      already-scene-space coords → wrong DB write → applyRemote snaps to wrong position.
        //   2. handleSelectionCreated calls setActiveObject(child.group) → removed group → no selection.
        //
        // child.parent being set causes:
        //   When the initial ActiveSelection (created below) is later discarded, Fabric v7's
        //   ActiveSelection.exitGroup calls object.parent._enterGroup(object) — which shoves the
        //   child back into the removed Group, scrambles its transform back to group-relative space,
        //   and resets child.group to the removed Group. Objects then have wrong position and are
        //   unselectable on the next click.
        const childRaw = child as unknown as Record<string, unknown>
        childRaw.group = undefined
        childRaw.parent = undefined
        // Apply the group's world transform so left/top become scene coordinates
        util.addTransformToObject(child, groupMatrix)
        child.set({ selectable: true, evented: true })
        child.set('data', { id: crypto.randomUUID() })
        setObjectZIndex(child, Date.now())
        canvas.add(child)
        child.setCoords()
        restoredObjects.push(child)
        const id = getObjectId(child)!
        addActions.push({ type: 'add', objectId: id, snapshot: history?.snapshot(child) ?? {} })
      })

      // Restore multi-selection so user can immediately move the ungrouped objects
      if (restoredObjects.length > 1) {
        const sel = new ActiveSelection(restoredObjects, { canvas })
        canvas.setActiveObject(sel)
      } else if (restoredObjects.length === 1) {
        canvas.setActiveObject(restoredObjects[0])
      }
      canvas.requestRenderAll()

      history?.pushCompound([
        { type: 'remove', objectId: groupId, snapshot: groupSnapshot },
        ...addActions,
      ])
    },
    duplicateSelected: async () => {
      const canvas = canvasRef.current
      const history = historyRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const getObjs = (t: FabricObject): FabricObject[] => {
        if (getObjectId(t)) return [t]
        if ('getObjects' in t) return (t as { getObjects(): FabricObject[] }).getObjects().filter((o) => !!getObjectId(o))
        return []
      }
      const objects = getObjs(active)
      if (objects.length === 0) return
      const DUPLICATE_OFFSET = 20
      const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
      const clones: FabricObject[] = []
      for (const obj of objects) {
        const cloned = await obj.clone()
        if (!cloned) continue
        setObjectId(cloned, crypto.randomUUID())
        setObjectZIndex(cloned, Date.now())
        if (isConnector(cloned)) {
          floatConnectorBothEndpoints(cloned, canvas, { dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET })
        } else {
          cloned.set({ left: (cloned.left ?? 0) + DUPLICATE_OFFSET, top: (cloned.top ?? 0) + DUPLICATE_OFFSET })
        }
        cloned.setCoords()
        canvas.add(cloned)
        clones.push(cloned)
        const id = getObjectId(cloned)
        if (id) addActions.push({ type: 'add', objectId: id, snapshot: history?.snapshot(cloned) ?? {} })
      }
      if (clones.length > 1) {
        const sel = new ActiveSelection(clones, { canvas })
        canvas.setActiveObject(sel)
      } else if (clones.length === 1) {
        canvas.setActiveObject(clones[0])
      }
      canvas.requestRenderAll()
      if (addActions.length > 0) history?.pushCompound(addActions)
    },
    copySelected: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const getObjs = (t: FabricObject): FabricObject[] => {
        if (getObjectId(t)) return [t]
        if ('getObjects' in t) return (t as { getObjects(): FabricObject[] }).getObjects().filter((o) => !!getObjectId(o))
        return []
      }
      const objects = getObjs(active)
      if (objects.length === 0) return
      const serialized = objects.map((o) => o.toObject(['data', 'objects']))
      setClipboard({ objects: serialized })
    },
    paste: async () => {
      const canvas = canvasRef.current
      const history = historyRef.current
      const clip = getClipboard()
      if (!canvas || !clip || clip.objects.length === 0) return
      const pastePoint = lastScenePointRef.current ?? (() => {
        const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
        const zoom = vpt[0]
        return { x: (width / 2 - vpt[4]) / zoom, y: (height / 2 - vpt[5]) / zoom }
      })()
      const revived = await util.enlivenObjects<FabricObject>(clip.objects)
      if (revived.length === 0) return
      const refLeft = revived[0].left ?? 0
      const refTop = revived[0].top ?? 0
      const dx = pastePoint.x - refLeft
      const dy = pastePoint.y - refTop
      const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
      const pasted: FabricObject[] = []
      for (const obj of revived) {
        setObjectId(obj, crypto.randomUUID())
        setObjectZIndex(obj, Date.now())
        if (isConnector(obj)) {
          floatConnectorBothEndpoints(obj, canvas)
        }
        obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
        obj.setCoords()
        canvas.add(obj)
        pasted.push(obj)
        const id = getObjectId(obj)
        if (id) addActions.push({ type: 'add', objectId: id, snapshot: history?.snapshot(obj) ?? {} })
      }
      if (pasted.length > 1) {
        const sel = new ActiveSelection(pasted, { canvas })
        canvas.setActiveObject(sel)
      } else if (pasted.length === 1) {
        canvas.setActiveObject(pasted[0])
      }
      canvas.requestRenderAll()
      if (addActions.length > 0) history?.pushCompound(addActions)
    },
    hasClipboard: () => hasClipboard(),
    setDrawBrushColor: (color: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas)
      canvas.freeDrawingBrush.color = color
    },
    setDrawBrushWidth: (width: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas)
      canvas.freeDrawingBrush.width = width
    },
    }
    fabricImperativeRef.current = api
    return api
  }, [width, height])

  const handleConnectorDropSelect = useCallback((shapeType: ConnectorDropShapeType) => {
    const state = connectorDropMenuState
    const canvas = canvasRef.current
    if (!state || !canvas) { setConnectorDropMenuState(null); return }
    const { scenePoint, sourceId, sourcePort } = state
    const SIZE = 80
    const shape = createShape(
      shapeType === 'sticky' ? 'sticky' : shapeType,
      scenePoint.x - SIZE / 2,
      scenePoint.y - SIZE / 2,
      scenePoint.x + SIZE / 2,
      scenePoint.y + SIZE / 2,
      { zoom: canvas.getZoom() }
    )
    if (shape) {
      canvas.add(shape)
      const targetId = getObjectId(shape)
      if (targetId) {
        const targetPort = getNearestPort(shape, scenePoint)
        const connector = createConnector(canvas, sourceId, sourcePort, targetId, targetPort)
        if (connector) canvas.add(connector)
      }
      canvas.requestRenderAll()
    }
    setConnectorDropMenuState(null)
  }, [connectorDropMenuState])

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

    let isPanning = false
    let isDrawing = false
    let spacePressed = false
    let lastPointer: { x: number; y: number } | null = null
    let drawStart: { x: number; y: number } | null = null
    let drawEnd: { x: number; y: number } | null = null
    let previewObj: FabricObject | null = null
    let objectWasTransformed = false  // Track if object was rotated/scaled/moved
    let connectorDrawState: { sourceObj: FabricObject; port: ConnectorPort } | null = null
    let connectorPreviewLine: Polyline | null = null
    let lastConnectorDrawPoint: { x: number; y: number } | null = null
    let connectorHoverSnap: ConnectorSnapResult | null = null
    let marqueeState: { start: { x: number; y: number }; rect: Rect } | null = null
    let lassoState: { points: { x: number; y: number }[]; preview: Polyline } | null = null

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
    }

    const { applyZoom, zoomToFit, handleWheel } = createZoomHandlers(fabricCanvas, width, height, notifyViewport)

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
      if (!marqueeState) return
      const sp = fabricCanvas.getScenePoint(ev)
      const { start, rect } = marqueeState
      const l = Math.min(start.x, sp.x)
      const t = Math.min(start.y, sp.y)
      const w = Math.abs(sp.x - start.x)
      const h = Math.abs(sp.y - start.y)
      rect.set({ left: l, top: t, width: w, height: h })
      rect.setCoords()
      fabricCanvas.requestRenderAll()
    }

    const onMarqueeMouseUp = () => {
      if (!marqueeState) return
      const { rect } = marqueeState
      const l = rect.left ?? 0
      const t = rect.top ?? 0
      const w = rect.width ?? 0
      const h = rect.height ?? 0
      const tl = new Point(l, t)
      const br = new Point(l + w, t + h)
      fabricCanvas.remove(rect)
      marqueeState = null
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

    const onLassoMouseMove = (ev: MouseEvent) => {
      if (!lassoState) return
      const sp = fabricCanvas.getScenePoint(ev)
      lassoState.points.push(sp)
      const pts = lassoState.points.map((p) => ({ x: p.x, y: p.y }))
      if (pts.length >= 2) {
        const poly = lassoState.preview as { points: { x: number; y: number }[]; setBoundingBox: (v?: boolean) => void }
        poly.points = pts
        poly.setBoundingBox(true)
      }
      fabricCanvas.requestRenderAll()
    }

    const onLassoMouseUp = () => {
      if (!lassoState) return
      const { points, preview } = lassoState
      fabricCanvas.remove(preview)
      lassoState = null
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

    const onCaptureMouseDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return
      const tool = toolRef.current

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
        marqueeState = { start: sp, rect }
        document.addEventListener('mousemove', onMarqueeMouseMove)
        document.addEventListener('mouseup', onMarqueeMouseUp)
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
        lassoState = { points: [sp], preview }
        document.addEventListener('mousemove', onLassoMouseMove)
        document.addEventListener('mouseup', onLassoMouseUp)
      }
    }
    upperEl.addEventListener('mousedown', onCaptureMouseDown, { capture: true })

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
      objectWasTransformed = false  // Reset at start of each mouse interaction

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
          isDrawing = true
          drawStart = sp
          const shape = tool === 'frame'
            ? createFrameShape(sp.x, sp.y, 0, 0, 'Frame', false)
            : tool === 'table'
            ? createDataTableShape(sp.x, sp.y, 0, 0, 'Untitled Table', false)
            : createShape(tool, sp.x, sp.y, sp.x, sp.y, {
                assignId: false,
                zoom: fabricCanvas.getZoom(),
              })
          if (shape) {
            previewObj = shape
            shape.selectable = false
            shape.evented = false
            fabricCanvas.add(shape)
          }
        }
        return
      }

      const isMiddle = 'button' in ev && ev.button === 1
      const isSpaceLeftOnEmpty = 'button' in ev && ev.button === 0 && !target && spacePressed
      const isHandDrag = tool === 'hand' && 'button' in ev && ev.button === 0
      if ((isMiddle || isSpaceLeftOnEmpty) && tool === 'select') {
        isPanning = true
        lastPointer = { x: ev.clientX, y: ev.clientY }
      } else if (isHandDrag) {
        isPanning = true
        lastPointer = { x: ev.clientX, y: ev.clientY }
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

      if (isDrawing && drawStart && previewObj) {
        const sp = getScenePoint(opt)
        if (sp) {
          drawEnd = sp
          const shape = tool === 'frame'
            ? createFrameShape(
                Math.min(drawStart.x, sp.x),
                Math.min(drawStart.y, sp.y),
                Math.abs(sp.x - drawStart.x),
                Math.abs(sp.y - drawStart.y),
                'Frame',
                false  // no id → preview only
              )
            : tool === 'table'
            ? createDataTableShape(
                Math.min(drawStart.x, sp.x),
                Math.min(drawStart.y, sp.y),
                Math.abs(sp.x - drawStart.x),
                Math.abs(sp.y - drawStart.y),
                'Untitled Table',
                false
              )
            : createShape(tool, drawStart.x, drawStart.y, sp.x, sp.y, {
                assignId: false,
                zoom: fabricCanvas.getZoom(),
              })
          if (shape) {
            fabricCanvas.remove(previewObj)
            previewObj = shape
            previewObj.selectable = false
            previewObj.evented = false
            fabricCanvas.add(previewObj)
            fabricCanvas.requestRenderAll()
          }
        }
        return
      }

      if (connectorDrawState && sp) {
        lastConnectorDrawPoint = sp
        const sourceId = getObjectId(connectorDrawState.sourceObj)
        // Snap to nearest port if cursor is within snap radius
        connectorHoverSnap = findConnectorSnap(fabricCanvas, sp, [sourceId])
        const tip = connectorHoverSnap ? connectorHoverSnap.scenePoint : sp
        const from = getPortScenePoint(connectorDrawState.sourceObj, connectorDrawState.port)
        if (!connectorPreviewLine) {
          connectorPreviewLine = new Polyline([from, { x: tip.x, y: tip.y }], {
            stroke: '#2563eb',
            strokeWidth: 2,
            fill: '',
            selectable: false,
            evented: false,
          })
          fabricCanvas.add(connectorPreviewLine)
        } else {
          connectorPreviewLine.set('points', [from, { x: tip.x, y: tip.y }])
          connectorPreviewLine.setCoords()
        }
        fabricCanvas.requestRenderAll()
        return
      }

      if (isPanning && lastPointer) {
        const dx = ev.clientX - lastPointer.x
        const dy = ev.clientY - lastPointer.y
        fabricCanvas.relativePan(new Point(dx, dy))
        lastPointer = { x: ev.clientX, y: ev.clientY }
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
      if (connectorDrawState) {
        const sourceId = getObjectId(connectorDrawState.sourceObj)
        if (connectorPreviewLine) {
          fabricCanvas.remove(connectorPreviewLine)
          connectorPreviewLine = null
        }
        // Prefer snap result; fall back to Fabric's reported target
        const snapResult = connectorHoverSnap
        connectorHoverSnap = null
        const target = snapResult ? snapResult.obj : (opt?.target as FabricObject | undefined)
        if (target && sourceId && getObjectId(target) && target !== connectorDrawState.sourceObj) {
          const targetRoot = (target.group ?? target) as FabricObject
          const targetId = getObjectId(targetRoot)
          if (targetId && targetRoot !== connectorDrawState.sourceObj) {
            const targetPort = snapResult
              ? snapResult.port
              : getNearestPort(targetRoot, lastConnectorDrawPoint ?? { x: 0, y: 0 })
            const connector = createConnector(
              fabricCanvas,
              sourceId,
              connectorDrawState.port,
              targetId,
              targetPort,
            )
            if (connector) {
              syncConnectorMoveLock(connector)
              fabricCanvas.add(connector)
              fabricCanvas.setActiveObject(connector)
            }
          }
        } else if (sourceId && lastConnectorDrawPoint) {
          // Dropped on empty space: show create-and-connect menu
          const dropPt = lastConnectorDrawPoint
          const vpt = fabricCanvas.viewportTransform
          const screenX = dropPt.x * (vpt?.[0] ?? 1) + (vpt?.[4] ?? 0)
          const screenY = dropPt.y * (vpt?.[0] ?? 1) + (vpt?.[5] ?? 0)
          const capturedSourcePort = connectorDrawState.port
          setConnectorDropMenuState({ screenX, screenY, scenePoint: dropPt, sourceId, sourcePort: capturedSourcePort })
        }
        lastConnectorDrawPoint = null
        connectorDrawState = null
        fabricCanvas.requestRenderAll()
        return
      }
      if (isDrawing && drawStart && previewObj) {
        const tool = toolRef.current
        const end = drawEnd ?? drawStart
        fabricCanvas.remove(previewObj)
        const w = Math.abs(end.x - drawStart.x)
        const h = Math.abs(end.y - drawStart.y)
        const minSize = 8
        if (w >= minSize || h >= minSize || tool === 'line') {
          const shape = tool === 'frame'
            ? createFrameShape(
                Math.min(drawStart.x, end.x),
                Math.min(drawStart.y, end.y),
                w,
                h
              )
            : tool === 'table'
            ? createDataTableShape(
                Math.min(drawStart.x, end.x),
                Math.min(drawStart.y, end.y),
                w,
                h
              )
            : createShape(tool, drawStart.x, drawStart.y, end.x, end.y, {
                zoom: fabricCanvas.getZoom(),
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
        previewObj = null
        drawEnd = null
        isDrawing = false
        drawStart = null
        fabricCanvas.requestRenderAll()
      }
      isPanning = false
      lastPointer = null
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

    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvasEl.addEventListener('touchend', handleTouchEnd)
    canvasEl.addEventListener('touchcancel', handleTouchEnd)

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
      if (isDrawing) return
      const target = opt.target as FabricObject | undefined
      if (!target) return
      const active = fabricCanvas.getActiveObject()
      
      // Don't enter edit mode if the object was just transformed (rotated, scaled, moved)
      if (objectWasTransformed) return
      
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

    const hasEditingText = (obj: unknown) =>
      obj && 'isEditing' in (obj as object) && (obj as { isEditing: boolean }).isEditing
    const isEditingText = (active: unknown) =>
      active && (hasEditingText(active) ||
        ('getObjects' in (active as object) &&
          (active as { getObjects: () => unknown[] }).getObjects().some(hasEditingText)))

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const active = fabricCanvas.getActiveObject()
      if (isEditingText(active)) return

      const isMod = e.metaKey || e.ctrlKey

      // Undo/Redo: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        void history.undo()
        return
      }
      if ((isMod && e.key === 'z' && e.shiftKey) || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        void history.redo()
        return
      }

      // Cmd/Ctrl+D = Duplicate
      if (isMod && e.key === 'd') {
        e.preventDefault()
        void fabricImperativeRef.current?.duplicateSelected()
        return
      }
      // Cmd/Ctrl+C = Copy
      if (isMod && e.key === 'c') {
        e.preventDefault()
        fabricImperativeRef.current?.copySelected()
        return
      }
      // Cmd/Ctrl+V = Paste
      if (isMod && e.key === 'v') {
        e.preventDefault()
        void fabricImperativeRef.current?.paste()
        return
      }

      // Cmd/Ctrl+G = Group; Cmd/Ctrl+Shift+G = Ungroup
      if (isMod && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        const active = fabricCanvas.getActiveObject()
        if (active?.type === 'activeselection') {
          const sel = active as unknown as { getObjects(): FabricObject[] }
          const objects = [...sel.getObjects()]
          if (objects.length >= 2) {
            const removeActions = objects.map((obj) => ({
              type: 'remove' as const,
              objectId: getObjectId(obj)!,
              snapshot: history.snapshot(obj),
            })).filter((a) => a.objectId)
            fabricCanvas.discardActiveObject()
            objects.forEach((obj) => fabricCanvas.remove(obj))
            const group = new Group(objects, { originX: 'left', originY: 'top' })
            group.set('data', { id: crypto.randomUUID(), subtype: 'container' })
            setObjectZIndex(group, Date.now())
            fabricCanvas.add(group)
            fabricCanvas.setActiveObject(group)
            group.setCoords()
            fabricCanvas.requestRenderAll()
            const groupId = getObjectId(group)
            if (groupId) {
              history.pushCompound([
                ...removeActions,
                { type: 'add', objectId: groupId, snapshot: history.snapshot(group) },
              ])
            }
          }
        }
        return
      }
      if (isMod && e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        const active = fabricCanvas.getActiveObject()
        if (active?.type === 'group') {
          const data = active.get('data') as { id?: string; subtype?: string } | undefined
          if (data?.subtype === 'container') {
            const groupId = getObjectId(active)!
            const groupSnapshot = history.snapshot(active)
            const groupMatrix = active.calcTransformMatrix()
            const children = (active as unknown as { getObjects(): FabricObject[] }).getObjects()
            fabricCanvas.discardActiveObject()
            fabricCanvas.remove(active)
            const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
            const restoredObjects: FabricObject[] = []
            children.forEach((child) => {
              const childRaw = child as unknown as Record<string, unknown>
              childRaw.group = undefined
              childRaw.parent = undefined
              util.addTransformToObject(child, groupMatrix)
              child.set({ selectable: true, evented: true })
              child.set('data', { id: crypto.randomUUID() })
              setObjectZIndex(child, Date.now())
              fabricCanvas.add(child)
              child.setCoords()
              restoredObjects.push(child)
              const id = getObjectId(child)
              if (id) addActions.push({ type: 'add', objectId: id, snapshot: history.snapshot(child) })
            })
            if (restoredObjects.length > 1) {
              const sel = new ActiveSelection(restoredObjects, { canvas: fabricCanvas })
              fabricCanvas.setActiveObject(sel)
            } else if (restoredObjects.length === 1) {
              fabricCanvas.setActiveObject(restoredObjects[0])
            }
            fabricCanvas.requestRenderAll()
            if (groupId) {
              history.pushCompound([
                { type: 'remove', objectId: groupId, snapshot: groupSnapshot },
                ...addActions,
              ])
            }
          }
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        // Cancel marquee drag
        if (marqueeState) {
          fabricCanvas.remove(marqueeState.rect)
          marqueeState = null
          document.removeEventListener('mousemove', onMarqueeMouseMove)
          document.removeEventListener('mouseup', onMarqueeMouseUp)
        }
        // Cancel lasso drag
        if (lassoState) {
          fabricCanvas.remove(lassoState.preview)
          lassoState = null
          document.removeEventListener('mousemove', onLassoMouseMove)
          document.removeEventListener('mouseup', onLassoMouseUp)
        }
        // Cancel shape/frame draw in progress
        if (isDrawing && previewObj) {
          fabricCanvas.remove(previewObj)
          previewObj = null
        }
        isDrawing = false
        // Cancel connector draw in progress
        if (connectorPreviewLine) {
          fabricCanvas.remove(connectorPreviewLine)
          connectorPreviewLine = null
        }
        connectorDrawState = null
        connectorHoverSnap = null
        // Deselect + exit text editing
        fabricCanvas.discardActiveObject()
        fabricCanvas.isDrawingMode = false
        fabricCanvas.requestRenderAll()
        // Return to select tool
        onToolChangeRef.current?.('select')
        return
      }
      if (e.key === ' ') {
        spacePressed = true
        fabricCanvas.selection = false
        e.preventDefault()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          e.preventDefault()
          // Float connectors whose endpoints reference the objects being deleted
          const objs = getObjectsToHistorize(active)
          objs.forEach((obj) => {
            const deletedId = getObjectId(obj)
            if (!deletedId) return
            fabricCanvas.getObjects().forEach((o) => {
              if (isConnector(o)) {
                floatConnectorEndpoint(o, fabricCanvas, deletedId)
                updateConnectorEndpoints(o, fabricCanvas)
              }
            })
          })
          // Capture snapshot(s) before removal so undo can re-add
          objs.forEach((obj) => {
            const id = getObjectId(obj)
            if (id) history.pushRemove(id, history.snapshot(obj))
          })
          fabricCanvas.remove(active)
          fabricCanvas.discardActiveObject()
          fabricCanvas.requestRenderAll()
        }
      }
      // Zoom shortcuts: +/= in, - out, 0 fit, 1 = 100%
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        applyZoom(fabricCanvas.getZoom() * ZOOM_STEP)
      } else if (e.key === '-') {
        e.preventDefault()
        applyZoom(fabricCanvas.getZoom() / ZOOM_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        zoomToFit()
      } else if (e.key === '1' && !e.shiftKey) {
        e.preventDefault()
        applyZoom(1)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      
      const active = fabricCanvas.getActiveObject()
      if (isEditingText(active)) return
      
      if (e.key === ' ') {
        e.preventDefault()
        spacePressed = false
        fabricCanvas.selection = true
        if (isPanning) handleMouseUp()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    zoomApiRef.current = { setZoom: applyZoom, zoomToFit }

    // Document sync only - never torn down when auth changes; pass getCurrentUserId so move-delta broadcast ignores our own messages
    const connectorCacheRefForSync = { current: connectorCacheSet }
    const cleanupDocSync =
      boardId
        ? setupDocumentSync(
            fabricCanvas,
            boardId,
            applyLockStateCallbackRef,
            () => lockOptsRef.current.userId,
            isRemoteChangeRef,
            (ms) => onSyncLatencyRef.current?.(ms),
            connectorCacheRefForSync,
            () => { onBoardReadyRef.current?.(); notifyFormFrames() }
          )
        : (() => { onBoardReadyRef.current?.(); return () => {} })()

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
      // Free-draw paths need an id for sync; assign before boardSync emitAdd
      if (obj.type === 'path' && !getObjectId(obj)) {
        setObjectId(obj, crypto.randomUUID())
        setObjectZIndex(obj, Date.now())
        obj.set('perPixelTargetFind', true)
      }
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
      objectWasTransformed = true
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
        if (target.type === 'group' && 'getObjects' in target) {
          const groupData = target.get('data') as { subtype?: string } | undefined
          if (groupData?.subtype !== 'container') updateStickyTextFontSize(target)
          if (groupData?.subtype === 'table') notifyFormFrames()
        }
      }
    }

    // Notify when a remote table update changes its data (formSchema, etc.)
    const handleFrameDataChanged = () => notifyFormFrames()
    const canvasAny = fabricCanvas as unknown as { on: (e: string, h: () => void) => void; off: (e: string, h: () => void) => void }
    canvasAny.on('table:data:changed', handleFrameDataChanged)

    const drawGrid = () => drawCanvasGrid(fabricCanvas)
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
      if (connectorHoverSnap) {
        ctx.save()
        drawConnectorPortHighlight(ctx, connectorHoverSnap.obj, connectorHoverSnap.port, vpt)
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
    fabricCanvas.on('before:render', drawGrid)
    fabricCanvas.on('after:render', drawArrows)
    fabricCanvas.on('after:render', drawHoverPorts)

    const handleConnectorDrawStart = (opt: { sourceObj?: FabricObject; port?: ConnectorPort }) => {
      if (opt.sourceObj && opt.port) {
        connectorDrawState = { sourceObj: opt.sourceObj, port: opt.port }
        fabricCanvas.discardActiveObject()
      }
    }
    const handlePathCreated = () => {
      if (toolRef.current === 'draw') onToolChangeRef.current?.('select')
    }
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
      document.removeEventListener('mousemove', onLassoMouseMove)
      document.removeEventListener('mouseup', onLassoMouseUp)
      zoomApiRef.current = null
      historyRef.current = null
      history.clear()
      cleanupDocSync()
      fabricCanvas.off('before:render', drawGrid)
      fabricCanvas.off('after:render', drawArrows)
      fabricCanvas.off('after:render', drawHoverPorts)
      fabricCanvas.off('connector:draw:start' as never, handleConnectorDrawStart)
      fabricCanvas.off('path:created', handlePathCreated)
      fabricCanvas.off('object:modified', handleObjectModified)
      fabricCanvas.off('object:added', notifyObjectCount)
      fabricCanvas.off('object:removed', notifyObjectCount)
      fabricCanvas.off('object:added', handleObjectAdded)
      fabricCanvas.off('object:removed', handleObjectRemoved)
      fabricCanvas.off('selection:created', handleSelectionCreated)
      fabricCanvas.off('selection:updated', handleSelectionUpdated)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
      if (transformNotifyRaf !== null) cancelAnimationFrame(transformNotifyRaf)
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

  // Sync isDrawingMode with selected tool (free draw).
  // Fabric v7 does NOT auto-create freeDrawingBrush — must be created manually.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (selectedTool === 'draw') {
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas)
      }
      const brush = canvas.freeDrawingBrush
      brush.color = '#1e293b'
      brush.width = 2
      canvas.isDrawingMode = true
    } else {
      canvas.isDrawingMode = false
    }
  }, [selectedTool])

  // Lock sync only - torn down/recreated when auth changes, canvas+doc sync persist
  useEffect(() => {
    const canvas = canvasRef.current
    const { userId: uid, userName: uname } = lockOptsRef.current
    const lockOpts =
      canvas && boardId && uid && uname
        ? { userId: uid, userName: uname }
        : undefined

    if (!canvas || !boardId || !lockOpts) return

    const cleanupLockSync = setupLockSync(canvas, boardId, lockOpts, applyLockStateCallbackRef)
    return cleanupLockSync
  }, [boardId, userId, userName])

  return (
    <div style={styles.wrapper}>
      <div
        ref={containerRef}
        className={className}
        style={{
          ...styles.container,
          cursor: selectedTool === 'hand' ? 'grab' : selectedTool === 'draw' || selectedTool === 'lasso' ? 'crosshair' : undefined,
        }}
      />
      {connectorDropMenuState && (
        <ConnectorDropMenu
          screenX={connectorDropMenuState.screenX}
          screenY={connectorDropMenuState.screenY}
          onSelect={handleConnectorDropSelect}
          onCancel={() => setConnectorDropMenuState(null)}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  container: {
    width: '100%',
    height: '100%',
    minHeight: 0,
    background: 'transparent',
    cursor: 'default',
    position: 'relative',
    zIndex: Z_INDEX.CANVAS,
    touchAction: 'none', // let JS own all touch gestures; prevents browser scroll/zoom conflicts
  },
}

export const FabricCanvas = forwardRef(FabricCanvasInner)
