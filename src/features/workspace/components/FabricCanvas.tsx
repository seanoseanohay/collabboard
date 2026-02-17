import { useEffect, useRef } from 'react'
import { Canvas, Point, type FabricObject } from 'fabric'
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
 * - Middle mouse or left-drag on empty: pan (select tool)
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
    let lastPointer: { x: number; y: number } | null = null
    let drawStart: { x: number; y: number } | null = null
    let drawEnd: { x: number; y: number } | null = null
    let previewObj: FabricObject | null = null
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
      if (vpt && onViewportChange) onViewportChange([...vpt])
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

      if (isShapeTool(tool) && 'button' in ev && ev.button === 0 && !target) {
        const sp = getScenePoint(opt)
        if (sp) {
          isDrawing = true
          drawStart = sp
          const shape = createShape(tool, sp.x, sp.y, sp.x, sp.y)
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
      const isLeftOnEmpty = 'button' in ev && ev.button === 0 && !target
      if ((isMiddle || isLeftOnEmpty) && tool === 'select') {
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
      if (sp && onPointerMove) onPointerMove(sp)

      if (isDrawing && drawStart && previewObj) {
        const sp = getScenePoint(opt)
        if (sp) {
          drawEnd = sp
          const shape = createShape(tool, drawStart.x, drawStart.y, sp.x, sp.y)
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

    if (onViewportChange) {
      const vpt = fabricCanvas.viewportTransform
      if (vpt) onViewportChange([...vpt])
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

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = fabricCanvas.getActiveObject()
        if (active) {
          e.preventDefault()
          fabricCanvas.remove(active)
          fabricCanvas.discardActiveObject()
          fabricCanvas.requestRenderAll()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    const lockOpts =
      boardId && userId && userName
        ? { userId, userName }
        : undefined
    const cleanupSync =
      boardId
        ? setupBoardSync(fabricCanvas, boardId, lockOpts)
        : () => {}

    fabricCanvas.on('mouse:wheel', handleWheel)
    fabricCanvas.on('mouse:down', handleMouseDown)
    fabricCanvas.on('mouse:move', handleMouseMove)
    fabricCanvas.on('mouse:up', handleMouseUp)
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
      document.removeEventListener('keydown', handleKeyDown)
      fabricCanvas.off('mouse:wheel', handleWheel)
      fabricCanvas.off('mouse:down', handleMouseDown)
      fabricCanvas.off('mouse:move', handleMouseMove)
      fabricCanvas.off('mouse:up', handleMouseUp)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      resizeObserver.disconnect()
      fabricCanvas.dispose()
      el.removeChild(canvasEl)
      canvasRef.current = null
    }
  }, [width, height, boardId, userId, userName, onPointerMove, onViewportChange])

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
