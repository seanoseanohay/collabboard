import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Z_INDEX } from '@/shared/constants/zIndex'
import { Canvas, Group, ActiveSelection, Point, util, type FabricObject } from 'fabric'
import { createHistoryManager, type HistoryManager } from '../lib/historyManager'

/** IText has enterEditing; FabricText does not. Check by method presence. */
function isEditableText(obj: unknown): obj is { enterEditing: () => void } {
  return !!obj && typeof (obj as { enterEditing?: () => void }).enterEditing === 'function'
}
import type { ToolType } from '../types/tools'
import { isShapeTool } from '../types/tools'
import { createShape } from '../lib/shapeFactory'
import {
  getStrokeWidthFromObject,
  setStrokeWidthOnObject,
  getStrokeColorFromObject,
  setStrokeColorOnObject,
} from '../lib/strokeUtils'
import {
  getFontFamilyFromObject,
  setFontFamilyOnObject,
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
  setObjectZIndex,
  type LockStateCallbackRef,
} from '../lib/boardSync'
import { createSticker, type StickerKind } from '../lib/pirateStickerFactory'
import { bringToFront, sendToBack, bringForward, sendBackward } from '../lib/fabricCanvasZOrder'
import { drawCanvasGrid } from '../lib/drawCanvasGrid'
import { createHistoryEventHandlers } from '../lib/fabricCanvasHistoryHandlers'
import { createZoomHandlers, ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from '../lib/fabricCanvasZoom'

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
}

export interface FabricCanvasZoomHandle {
  setZoom: (zoom: number) => void
  zoomToFit: () => void
  getActiveObject: () => FabricObject | null
  setActiveObjectStrokeWidth: (strokeWidth: number) => void
  setActiveObjectFill: (fill: string) => void
  setActiveObjectStrokeColor: (stroke: string) => void
  setActiveObjectFontFamily: (fontFamily: string) => void
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void
  undo: () => void
  redo: () => void
  groupSelected: () => void
  ungroupSelected: () => void
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
  }: FabricCanvasProps,
  ref: React.Ref<FabricCanvasZoomHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const zoomApiRef = useRef<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit'> | null>(null)
  const toolRef = useRef(selectedTool)
  toolRef.current = selectedTool
  const stickerKindRef = useRef(selectedStickerKind)
  stickerKindRef.current = selectedStickerKind
  const onPointerMoveRef = useRef(onPointerMove)
  onPointerMoveRef.current = onPointerMove
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onHistoryChangeRef = useRef(onHistoryChange)
  onHistoryChangeRef.current = onHistoryChange
  const lockOptsRef = useRef({ userId: userId ?? '', userName: userName ?? 'Anonymous' })
  lockOptsRef.current = { userId: userId ?? '', userName: userName ?? 'Anonymous' }
  const applyLockStateCallbackRef = useRef<LockStateCallbackRef['current']>(null)
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

  useImperativeHandle(ref, () => ({
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
      const groupMatrix = active.calcOwnMatrix()
      const children = (active as unknown as { getObjects(): FabricObject[] }).getObjects()

      // Remove the group — fires object:removed → boardSync deletes the group document
      canvas.discardActiveObject()
      canvas.remove(active)

      // Add each child with scene coordinates and a fresh UUID
      const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
      const restoredObjects: FabricObject[] = []
      children.forEach((child) => {
        // Apply the group's world transform so left/top become scene coordinates
        util.addTransformToObject(child, groupMatrix)
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
  }), [])

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
      backgroundColor: '#fafafa',
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

    let isPanning = false
    let isDrawing = false
    let spacePressed = false
    let lastPointer: { x: number; y: number } | null = null
    let drawStart: { x: number; y: number } | null = null
    let drawEnd: { x: number; y: number } | null = null
    let previewObj: FabricObject | null = null
    let objectWasTransformed = false  // Track if object was rotated/scaled/moved

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

    const notifyViewport = () => {
      const vpt = fabricCanvas.viewportTransform
      if (vpt && onViewportChangeRef.current) onViewportChangeRef.current([...vpt])
    }

    const { applyZoom, zoomToFit, handleWheel } = createZoomHandlers(fabricCanvas, width, height, notifyViewport)

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

      // Sticker tool: click-to-place at cursor position (no drag needed)
      if (tool === 'sticker' && 'button' in ev && ev.button === 0) {
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
          }
        }
        return
      }

      // With a shape tool active, pointer-down always starts drawing (never selects).
      if (isShapeTool(tool) && 'button' in ev && ev.button === 0) {
        const sp = getScenePoint(opt)
        if (sp) {
          fabricCanvas.discardActiveObject()
          isDrawing = true
          drawStart = sp
          const shape = createShape(tool, sp.x, sp.y, sp.x, sp.y, {
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
      if (sp && onPointerMoveRef.current) onPointerMoveRef.current(sp)

      if (isDrawing && drawStart && previewObj) {
        const sp = getScenePoint(opt)
        if (sp) {
          drawEnd = sp
          const shape = createShape(tool, drawStart.x, drawStart.y, sp.x, sp.y, {
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

    const handleMouseUp = () => {
      if (isDrawing && drawStart && previewObj) {
        const tool = toolRef.current
        const end = drawEnd ?? drawStart
        fabricCanvas.remove(previewObj)
        const w = Math.abs(end.x - drawStart.x)
        const h = Math.abs(end.y - drawStart.y)
        const minSize = 8
        if (w >= minSize || h >= minSize || tool === 'line') {
          const shape = createShape(tool, drawStart.x, drawStart.y, end.x, end.y, {
            zoom: fabricCanvas.getZoom(),
          })
          if (shape) {
            fabricCanvas.add(shape)
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

    const handleDblClick = (opt: { target?: unknown }) => {
      const target = opt.target as FabricObject | undefined
      if (!target) return
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
            const groupMatrix = active.calcOwnMatrix()
            const children = (active as unknown as { getObjects(): FabricObject[] }).getObjects()
            fabricCanvas.discardActiveObject()
            fabricCanvas.remove(active)
            const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
            const restoredObjects: FabricObject[] = []
            children.forEach((child) => {
              util.addTransformToObject(child, groupMatrix)
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

      if (e.key === ' ') {
        spacePressed = true
        fabricCanvas.selection = false
        e.preventDefault()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          e.preventDefault()
          // Capture snapshot(s) before removal so undo can re-add
          const objs = getObjectsToHistorize(active)
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
    const cleanupDocSync =
      boardId
        ? setupDocumentSync(
            fabricCanvas,
            boardId,
            applyLockStateCallbackRef,
            () => lockOptsRef.current.userId,
            isRemoteChangeRef
          )
        : () => {}

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
      if (isEditableText(obj) || (obj.type === 'group' && getTextToEdit(obj))) {
        attachTextEditOnDblClick(obj)
      }
    }

    const notifySelectionChange = () => {
      const active = fabricCanvas.getActiveObject()
      if (!active) {
        onSelectionChangeRef.current?.(null)
        return
      }
      const isActiveSelection = active.type === 'activeselection'
      const isGroup = active.type === 'group'
      const groupData = isGroup ? (active.get('data') as { subtype?: string } | undefined) : undefined
      const isContainerGroup = isGroup && groupData?.subtype === 'container'
      const canGroup = isActiveSelection && 'getObjects' in active
        ? (active as unknown as { getObjects(): FabricObject[] }).getObjects().length >= 2
        : false
      const canUngroup = isContainerGroup
      const isTextOnly = isTextOnlySelection(active)
      const isStickyNote = isStickyGroup(active)
      const hasText = hasEditableText(active)
      onSelectionChangeRef.current?.({
        strokeWidth: getStrokeWidthFromObject(active) ?? 0,
        strokeColor: getStrokeColorFromObject(active),
        fill: getFillFromObject(active),
        canGroup,
        canUngroup,
        isTextOnly,
        isStickyNote,
        fontFamily: hasText ? getFontFamilyFromObject(active) ?? 'Arial' : null,
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
      }
      notifySelectionChange()
    }

    const handleSelectionUpdated = () => {
      notifySelectionChange()
    }

    const handleSelectionCleared = () => {
      notifySelectionChange()
    }

    const handleObjectTransforming = () => {
      objectWasTransformed = true
    }

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target
      if (target?.type === 'group' && 'getObjects' in target) {
        const groupData = target.get('data') as { subtype?: string } | undefined
        if (groupData?.subtype !== 'container') updateStickyTextFontSize(target)
      }
    }

    const drawGrid = () => drawCanvasGrid(fabricCanvas)
    fabricCanvas.on('before:render', drawGrid)

    fabricCanvas.on('object:added', handleObjectAdded)
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

    return () => {
      zoomApiRef.current = null
      historyRef.current = null
      history.clear()
      cleanupDocSync()
      fabricCanvas.off('before:render', drawGrid)
      fabricCanvas.off('object:modified', handleObjectModified)
      fabricCanvas.off('object:added', handleObjectAdded)
      fabricCanvas.off('selection:created', handleSelectionCreated)
      fabricCanvas.off('selection:updated', handleSelectionUpdated)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
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
    <div
      ref={containerRef}
      className={className}
      style={{
        ...styles.container,
        cursor: selectedTool === 'hand' ? 'grab' : undefined,
      }}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
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
