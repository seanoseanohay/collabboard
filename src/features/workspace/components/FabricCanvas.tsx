import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Canvas, Point, type FabricObject } from 'fabric'

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
import { getFillFromObject, setFillOnObject } from '../lib/fillUtils'
import { updateStickyTextFontSize, hideStickyPlaceholderForEditing } from '../lib/shapeFactory'
import {
  setupDocumentSync,
  setupLockSync,
  getObjectId,
  getObjectZIndex,
  setObjectZIndex,
  sortCanvasByZIndex,
  type LockStateCallbackRef,
} from '../lib/boardSync'

export interface SelectionStrokeInfo {
  strokeWidth: number
  strokeColor: string | null
  fill: string | null
}

export interface FabricCanvasZoomHandle {
  setZoom: (zoom: number) => void
  zoomToFit: () => void
  getActiveObject: () => FabricObject | null
  setActiveObjectStrokeWidth: (strokeWidth: number) => void
  setActiveObjectFill: (fill: string) => void
  setActiveObjectStrokeColor: (stroke: string) => void
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void
}

interface FabricCanvasProps {
  width?: number
  height?: number
  className?: string
  selectedTool?: ToolType
  boardId?: string
  userId?: string
  userName?: string
  onPointerMove?: (scenePoint: { x: number; y: number }) => void
  onViewportChange?: (vpt: number[]) => void
  onSelectionChange?: (info: SelectionStrokeInfo | null) => void
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
    boardId,
    userId,
    userName,
    onPointerMove,
    onViewportChange,
    onSelectionChange,
  }: FabricCanvasProps,
  ref: React.Ref<FabricCanvasZoomHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const zoomApiRef = useRef<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit'> | null>(null)
  const toolRef = useRef(selectedTool)
  toolRef.current = selectedTool
  const onPointerMoveRef = useRef(onPointerMove)
  onPointerMoveRef.current = onPointerMove
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const lockOptsRef = useRef({ userId: userId ?? '', userName: userName ?? 'Anonymous' })
  lockOptsRef.current = { userId: userId ?? '', userName: userName ?? 'Anonymous' }
  const applyLockStateCallbackRef = useRef<LockStateCallbackRef['current']>(null)

  useImperativeHandle(ref, () => ({
    setZoom: (z) => zoomApiRef.current?.setZoom(z),
    zoomToFit: () => zoomApiRef.current?.zoomToFit(),
    getActiveObject: () => canvasRef.current?.getActiveObject() ?? null,
    setActiveObjectStrokeWidth: (strokeWidth: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      setStrokeWidthOnObject(active, strokeWidth)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectFill: (fill: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      setFillOnObject(active, fill)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    setActiveObjectStrokeColor: (stroke: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      setStrokeColorOnObject(active, stroke)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    bringToFront: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const objects = 'getObjects' in active ? (active as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o)) : [active]
      if (objects.length === 0) return
      const all = canvas.getObjects()
      const maxZ = all.reduce((m, o) => Math.max(m, getObjectZIndex(o)), 0)
      objects.forEach((obj, i) => {
        const z = maxZ + 1 + i
        setObjectZIndex(obj, z)
        canvas.bringObjectToFront(obj)
      })
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    sendToBack: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const objects = 'getObjects' in active ? (active as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o)) : [active]
      if (objects.length === 0) return
      const all = canvas.getObjects()
      const minZ = all.reduce((m, o) => Math.min(m, getObjectZIndex(o)), Number.MAX_SAFE_INTEGER)
      objects.forEach((obj, i) => {
        const z = Math.max(0, minZ - objects.length + i)
        setObjectZIndex(obj, z)
        canvas.sendObjectToBack(obj)
      })
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    bringForward: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const objects = 'getObjects' in active ? (active as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o)) : [active]
      if (objects.length === 0) return
      const all = canvas.getObjects().slice().sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
      const maxZ = all.length > 0 ? getObjectZIndex(all[all.length - 1]!) : 0
      const currentZ = Math.max(...objects.map((o) => getObjectZIndex(o)))
      if (currentZ >= maxZ) {
        objects.forEach((obj, i) => {
          setObjectZIndex(obj, maxZ + 1 + i)
          canvas.bringObjectToFront(obj)
        })
      } else {
        const nextIdx = all.findIndex((o) => getObjectZIndex(o) > currentZ)
        if (nextIdx === -1) return
        const nextZ = getObjectZIndex(all[nextIdx]!)
        objects.forEach((obj, i) => {
          setObjectZIndex(obj, nextZ + 1 + i)
          canvas.bringObjectToFront(obj)
        })
      }
      sortCanvasByZIndex(canvas)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
    },
    sendBackward: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const active = canvas.getActiveObject()
      if (!active) return
      const objects = 'getObjects' in active ? (active as { getObjects: () => FabricObject[] }).getObjects().filter((o) => getObjectId(o)) : [active]
      if (objects.length === 0) return
      const all = canvas.getObjects().slice().sort((a, b) => getObjectZIndex(a) - getObjectZIndex(b))
      const minZ = all.length > 0 ? getObjectZIndex(all[0]!) : 0
      const currentZ = Math.min(...objects.map((o) => getObjectZIndex(o)))
      if (currentZ <= minZ) {
        objects.forEach((obj, i) => {
          const z = Math.max(0, minZ - objects.length + i)
          setObjectZIndex(obj, z)
          canvas.sendObjectToBack(obj)
        })
      } else {
        const prevIdx = all.findIndex((o) => getObjectZIndex(o) >= currentZ) - 1
        if (prevIdx < 0) return
        const prevObj = all[prevIdx]!
        const prevZ = getObjectZIndex(prevObj)
        setObjectZIndex(prevObj, currentZ)
        canvas.bringObjectToFront(prevObj)
        objects.forEach((obj, i) => {
          setObjectZIndex(obj, prevZ + i)
          canvas.sendObjectToBack(obj)
        })
      }
      sortCanvasByZIndex(canvas)
      canvas.fire('object:modified', { target: active })
      canvas.requestRenderAll()
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
    })
    canvasRef.current = fabricCanvas

    let isPanning = false
    let isDrawing = false
    let spacePressed = false
    let lastPointer: { x: number; y: number } | null = null
    let drawStart: { x: number; y: number } | null = null
    let drawEnd: { x: number; y: number } | null = null
    let previewObj: FabricObject | null = null
    let objectWasTransformed = false  // Track if object was rotated/scaled/moved
    const MIN_ZOOM = 0.00001  // 0.001% - zoom out to 1/1000th percent
    const MAX_ZOOM = 100      // 10000% - zoom in to 10,000%

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

    const handleWheel = (opt: { e: WheelEvent }) => {
      const e = opt.e
      e.preventDefault()
      // Trackpad: pinch sends ctrl+wheel (zoom); two-finger scroll sends plain wheel (pan).
      if (e.ctrlKey) {
        const delta = -e.deltaY * 0.006
        const zoom = fabricCanvas.getZoom()
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)))
        const pt = new Point(e.offsetX, e.offsetY)
        fabricCanvas.zoomToPoint(pt, newZoom)
      } else {
        fabricCanvas.relativePan(new Point(-e.deltaX, -e.deltaY))
      }
      fabricCanvas.requestRenderAll()
      notifyViewport()
    }

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

      // With a shape tool active, pointer-down always starts drawing (never selects).
      if (isShapeTool(tool) && 'button' in ev && ev.button === 0) {
        const sp = getScenePoint(opt)
        if (sp) {
          fabricCanvas.discardActiveObject()
          isDrawing = true
          drawStart = sp
          const shape = createShape(tool, sp.x, sp.y, sp.x, sp.y, { assignId: false })
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
          const shape = createShape(tool, drawStart.x, drawStart.y, sp.x, sp.y, { assignId: false })
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
          const shape = createShape(tool, drawStart.x, drawStart.y, end.x, end.y)
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

    const zoomStep = 1.25
    const center = new Point(width / 2, height / 2)
    const applyZoom = (newZoom: number) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
      fabricCanvas.zoomToPoint(center, clamped)
      fabricCanvas.requestRenderAll()
      notifyViewport()
    }
    const zoomToFit = () => {
      const objs = fabricCanvas.getObjects()
      if (objs.length === 0) {
        fabricCanvas.setZoom(1)
        if (fabricCanvas.viewportTransform) {
          fabricCanvas.viewportTransform[0] = 1
          fabricCanvas.viewportTransform[3] = 1
          fabricCanvas.viewportTransform[4] = 0
          fabricCanvas.viewportTransform[5] = 0
        }
        fabricCanvas.requestRenderAll()
        notifyViewport()
        return
      }
      const bounds = objs.reduce(
        (acc, obj) => {
          const b = (obj as { getBoundingRect: (absolute?: boolean) => { left: number; top: number; width: number; height: number } }).getBoundingRect(true)
          return {
            minX: Math.min(acc.minX, b.left),
            minY: Math.min(acc.minY, b.top),
            maxX: Math.max(acc.maxX, b.left + b.width),
            maxY: Math.max(acc.maxY, b.top + b.height),
          }
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      )
      const padding = 40
      const contentW = bounds.maxX - bounds.minX + padding * 2
      const contentH = bounds.maxY - bounds.minY + padding * 2
      const zoomX = width / contentW
      const zoomY = height / contentH
      const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY)))
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      const vpt = fabricCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      vpt[0] = fitZoom
      vpt[3] = fitZoom
      vpt[4] = width / 2 - cx * fitZoom
      vpt[5] = height / 2 - cy * fitZoom
      fabricCanvas.requestRenderAll()
      notifyViewport()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      
      const active = fabricCanvas.getActiveObject()
      if (isEditingText(active)) return
      
      if (e.key === ' ') {
        spacePressed = true
        fabricCanvas.selection = false
        e.preventDefault()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          e.preventDefault()
          fabricCanvas.remove(active)
          fabricCanvas.discardActiveObject()
          fabricCanvas.requestRenderAll()
        }
      }
      // Zoom shortcuts: +/= in, - out, 0 fit, 1 = 100%
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        applyZoom(fabricCanvas.getZoom() * zoomStep)
      } else if (e.key === '-') {
        e.preventDefault()
        applyZoom(fabricCanvas.getZoom() / zoomStep)
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
            () => lockOptsRef.current.userId
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
      onSelectionChangeRef.current?.(
        active
          ? {
              strokeWidth: getStrokeWidthFromObject(active) ?? 0,
              strokeColor: getStrokeColorFromObject(active),
              fill: getFillFromObject(active),
            }
          : null
      )
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
        updateStickyTextFontSize(target)
      }
    }

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

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      fabricCanvas.setDimensions({ width: w, height: h })
    })
    resizeObserver.observe(el)

    return () => {
      zoomApiRef.current = null
      cleanupDocSync()
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

    if (!lockOpts && boardId && uid !== undefined) {
      console.error('[FABRIC] ❌ LOCKING DISABLED - Missing:', { boardId: !!boardId, uid: !!uid, uname: !!uname })
    } else if (lockOpts) {
      console.log('[FABRIC] ✅ LOCKING ENABLED:', lockOpts)
    }

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
    background: '#fafafa',
    cursor: 'default',
  },
}

export const FabricCanvas = forwardRef(FabricCanvasInner)
