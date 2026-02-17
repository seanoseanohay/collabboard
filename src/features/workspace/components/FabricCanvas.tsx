import { useEffect, useRef } from 'react'
import { Canvas, Point, type FabricObject } from 'fabric'

/** IText has enterEditing; FabricText does not. Check by method presence. */
function isEditableText(obj: unknown): obj is { enterEditing: () => void } {
  return !!obj && typeof (obj as { enterEditing?: () => void }).enterEditing === 'function'
}
import type { ToolType } from '../types/tools'
import { isShapeTool } from '../types/tools'
import { createShape } from '../lib/shapeFactory'
import { setupBoardSync } from '../lib/boardSync'

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
}

/**
 * Fabric.js canvas wrapper with pan/zoom and shape drawing.
 * - Mouse wheel: zoom at cursor
 * - Pan: middle mouse or Space+left-drag (enables box-select on left-drag empty)
 * - Select tool: single-click object, drag empty = marquee box-select
 * - Shape tools: drag to create rect/circle/triangle/line/text/sticky
 */
export function FabricCanvas({
  width = 1200,
  height = 800,
  className,
  selectedTool = 'select',
  boardId,
  userId,
  userName,
  onPointerMove,
  onViewportChange,
}: FabricCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const toolRef = useRef(selectedTool)
  toolRef.current = selectedTool
  const onPointerMoveRef = useRef(onPointerMove)
  onPointerMoveRef.current = onPointerMove
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const lockOptsRef = useRef({ userId: userId ?? '', userName: userName ?? 'Anonymous' })
  lockOptsRef.current = { userId: userId ?? '', userName: userName ?? 'Anonymous' }

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
    const MIN_ZOOM = 0.02  // 2% - zoom out for broad view (infinite canvas)
    const MAX_ZOOM = 20   // 2000% - zoom in for detail work

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
      const delta = -e.deltaY * 0.001
      const zoom = fabricCanvas.getZoom()
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)))
      const pt = new Point(e.offsetX, e.offsetY)
      fabricCanvas.zoomToPoint(pt, newZoom)
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

      if (isShapeTool(tool) && 'button' in ev && ev.button === 0 && !target) {
        const sp = getScenePoint(opt)
        if (sp) {
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
      if ((isMiddle || isSpaceLeftOnEmpty) && tool === 'select') {
        isPanning = true
        lastPointer = { x: ev.clientX, y: ev.clientY }
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
      const itext = obj as FabricObject & { enterEditing: () => void; exitEditing?: () => void; canvas?: unknown }
      if (!itext.canvas) itext.canvas = fabricCanvas
      // For IText inside a Group, we need to set the text as active, not the group
      fabricCanvas.setActiveObject(obj)
      fabricCanvas.requestRenderAll()
      // Use setTimeout to ensure the object is fully initialized and active
      setTimeout(() => {
        itext.enterEditing()
        fabricCanvas.requestRenderAll()
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

    const { userId: uid, userName: uname } = lockOptsRef.current
    const lockOpts =
      boardId && uid && uname
        ? { userId: uid, userName: uname }
        : undefined
    
    // DEBUG: Alert if locking isn't enabled
    if (!lockOpts && boardId) {
      console.error('[FABRIC] ❌ LOCKING DISABLED - Missing:', { boardId: !!boardId, uid: !!uid, uname: !!uname })
    } else if (lockOpts) {
      console.log('[FABRIC] ✅ LOCKING ENABLED:', lockOpts)
    }
    
    const cleanupSync =
      boardId
        ? setupBoardSync(fabricCanvas, boardId, lockOpts)
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

    const handleSelectionCreated = (e: { selected?: FabricObject[] }) => {
      const selected = e.selected
      if (!selected || selected.length !== 1) return
      
      const obj = selected[0]
      // If a child of a Group was selected, select the parent Group instead
      if (obj && obj.group) {
        fabricCanvas.discardActiveObject()
        fabricCanvas.setActiveObject(obj.group)
        fabricCanvas.requestRenderAll()
      }
    }

    const handleObjectTransforming = () => {
      objectWasTransformed = true
    }

    fabricCanvas.on('object:added', handleObjectAdded)
    fabricCanvas.on('selection:created', handleSelectionCreated)
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
      cleanupSync()
      fabricCanvas.off('object:added', handleObjectAdded)
      fabricCanvas.off('selection:created', handleSelectionCreated)
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
  }, [width, height, boardId, userId, userName])

  return <div ref={containerRef} className={className} style={styles.container} />
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
