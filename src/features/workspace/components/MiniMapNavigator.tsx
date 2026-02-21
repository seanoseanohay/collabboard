import { useEffect, useRef, useCallback } from 'react'
import type { FabricCanvasZoomHandle } from './FabricCanvas'

/** Shared with FabricCanvas.getMiniMapData; keep in sync. */
export const MINI_MAP_PADDING = 50

const MINI_W = 200
const MINI_H = 140
const UPDATE_INTERVAL_MS = 2000

interface MiniMapNavigatorProps {
  canvasRef: React.RefObject<FabricCanvasZoomHandle | null>
  viewportTransform: number[] | null
  canvasWidth: number
  canvasHeight: number
  objectCount: number
}

export function MiniMapNavigator({
  canvasRef,
  viewportTransform,
  canvasWidth,
  canvasHeight,
  objectCount,
}: MiniMapNavigatorProps) {
  const miniCanvasRef = useRef<HTMLCanvasElement>(null)
  const contentBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const refreshIdRef = useRef(0)

  const redraw = useCallback(() => {
    const miniCanvas = miniCanvasRef.current
    if (!miniCanvas) return
    const ctx = miniCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MINI_W, MINI_H)

    if (imageRef.current) {
      // Crop top-left MINI_W×MINI_H from the full-canvas capture; the fitZoom viewport
      // transform placed all content within that region of the source canvas.
      ctx.drawImage(imageRef.current, 0, 0, MINI_W, MINI_H, 0, 0, MINI_W, MINI_H)
    }

    const bounds = contentBoundsRef.current
    if (!bounds || !viewportTransform) return

    const cw = bounds.maxX - bounds.minX + MINI_MAP_PADDING * 2
    const ch = bounds.maxY - bounds.minY + MINI_MAP_PADDING * 2
    const fitZoom = Math.min(MINI_W / cw, MINI_H / ch)

    const zoom = viewportTransform[0] ?? 1
    const panX = viewportTransform[4] ?? 0
    const panY = viewportTransform[5] ?? 0

    // Viewport in scene coordinates
    const sceneLeft = -panX / zoom
    const sceneTop = -panY / zoom
    const sceneRight = sceneLeft + canvasWidth / zoom
    const sceneBottom = sceneTop + canvasHeight / zoom

    // Map scene coords to mini-map pixels using the same fitZoom transform used for the capture
    const originX = -(bounds.minX - MINI_MAP_PADDING) * fitZoom
    const originY = -(bounds.minY - MINI_MAP_PADDING) * fitZoom

    const rectX = sceneLeft * fitZoom + originX
    const rectY = sceneTop * fitZoom + originY
    const rectW = (sceneRight - sceneLeft) * fitZoom
    const rectH = (sceneBottom - sceneTop) * fitZoom

    ctx.save()
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)'
    ctx.lineWidth = 1.5
    ctx.fillStyle = 'rgba(96, 165, 250, 0.2)'
    ctx.fillRect(rectX, rectY, rectW, rectH)
    ctx.strokeRect(rectX, rectY, rectW, rectH)
    ctx.restore()
  }, [viewportTransform, canvasWidth, canvasHeight])

  const refresh = useCallback(() => {
    const data = canvasRef.current?.getMiniMapData()
    if (!data) return

    contentBoundsRef.current = data.contentBounds

    const id = ++refreshIdRef.current
    const img = new Image()
    img.onload = () => {
      if (id !== refreshIdRef.current) return
      imageRef.current = img
      redraw()
    }
    img.src = data.imageDataUrl
  }, [canvasRef, redraw])

  // Periodic refresh
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, UPDATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Refresh on object count changes
  useEffect(() => {
    refresh()
  }, [objectCount, refresh])

  // Redraw viewport rectangle whenever viewportTransform changes
  useEffect(() => {
    redraw()
  }, [redraw])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const bounds = contentBoundsRef.current
      if (!bounds) return
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      const cw = bounds.maxX - bounds.minX + MINI_MAP_PADDING * 2
      const ch = bounds.maxY - bounds.minY + MINI_MAP_PADDING * 2
      const fitZoom = Math.min(MINI_W / cw, MINI_H / ch)

      const originX = -(bounds.minX - MINI_MAP_PADDING) * fitZoom
      const originY = -(bounds.minY - MINI_MAP_PADDING) * fitZoom

      const sceneX = (clickX - originX) / fitZoom
      const sceneY = (clickY - originY) / fitZoom

      canvasRef.current?.panToScene(sceneX, sceneY)
    },
    [canvasRef]
  )

  return (
    <div style={styles.container}>
      <span style={styles.label}>Chart</span>
      <canvas
        ref={miniCanvasRef}
        width={MINI_W}
        height={MINI_H}
        onClick={handleClick}
        style={styles.canvas}
        aria-label="Mini-map navigator"
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    opacity: 0.85,
    zIndex: 100,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: '#78350f',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    fontFamily: 'Georgia, serif',
  },
  canvas: {
    width: MINI_W,
    height: MINI_H,
    border: '2px solid #92400e',
    borderRadius: 4,
    boxShadow: '2px 3px 8px rgba(0,0,0,0.35)',
    cursor: 'crosshair',
    background: '#f5f0e8',
    display: 'block',
  },
}
