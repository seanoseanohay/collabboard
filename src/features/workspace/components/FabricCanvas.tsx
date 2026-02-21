import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useFabricImperativeApi } from '../hooks/useFabricImperativeApi'
import { useFabricCanvasSetup } from '../hooks/useFabricCanvasSetup'
import { Canvas, PencilBrush, type FabricObject } from 'fabric'
import type { HistoryManager } from '../lib/historyManager'
import { createShape } from '../lib/shapeFactory'
import { getObjectId, setupLockSync, type LockStateCallbackRef } from '../lib/boardSync'
import { createConnector } from '../lib/connectorFactory'
import { getNearestPort } from '../lib/connectorPortUtils'
import { ConnectorDropMenu, type ConnectorDropShapeType } from './ConnectorDropMenu'
import type {
  SelectionStrokeInfo,
  FabricCanvasZoomHandle,
  ConnectorDropState,
  FabricCanvasProps,
} from '../types/fabricCanvasTypes'
import { fabricCanvasStyles } from './fabricCanvasStyles'

export type { SelectionStrokeInfo, FabricCanvasZoomHandle }

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
    boardMode = 'standard',
    userId,
    userName,
    polygonSides = 6,
    starMode = false,
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
    gridType = 'square',
    snapToGrid = false,
    onFogReveal,
    revealRadius = 80,
  }: FabricCanvasProps,
  ref: React.Ref<FabricCanvasZoomHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const [connectorDropMenuState, setConnectorDropMenuState] = useState<ConnectorDropState | null>(null)
  const zoomApiRef = useRef<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit' | 'zoomToSelection'> | null>(null)
  const toolRef = useRef(selectedTool)
  toolRef.current = selectedTool
  const stickerKindRef = useRef(selectedStickerKind)
  stickerKindRef.current = selectedStickerKind
  const boardModeRef = useRef(boardMode)
  boardModeRef.current = boardMode
  const polygonSidesRef = useRef(polygonSides)
  polygonSidesRef.current = polygonSides
  const starModeRef = useRef(starMode)
  starModeRef.current = starMode
  const gridTypeRef = useRef(gridType)
  gridTypeRef.current = gridType
  const snapToGridRef = useRef(snapToGrid)
  snapToGridRef.current = snapToGrid
  const brushOpacityRef = useRef(1)
  const brushWidthRef = useRef(2)
  const eraserActiveRef = useRef(false)
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
  const onFogRevealRef = useRef(onFogReveal)
  onFogRevealRef.current = onFogReveal
  const revealRadiusRef = useRef(revealRadius)
  revealRadiusRef.current = revealRadius
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

  useFabricImperativeApi({
    ref,
    fabricImperativeRef,
    canvasRef,
    historyRef,
    captureBeforeForHistory,
    notifyFormFramesRef,
    lastScenePointRef,
    onViewportChangeRef,
    zoomApiRef,
    brushWidthRef,
    brushOpacityRef,
    eraserActiveRef,
    width,
    height,
  })


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

  useFabricCanvasSetup({
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
  })

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
      // Full zoom compensation: stroke is always brushWidthRef px on screen at any zoom
      brush.width = brushWidthRef.current / canvas.getZoom()
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
    <div style={fabricCanvasStyles.wrapper}>
      <div
        ref={containerRef}
        className={className}
        style={{
          ...fabricCanvasStyles.container,
          cursor: selectedTool === 'hand' ? 'grab' : selectedTool === 'zoom-in' ? 'zoom-in' : selectedTool === 'draw' || selectedTool === 'lasso' || selectedTool === 'polygon-draw' || selectedTool === 'reveal' ? 'crosshair' : selectedTool === 'laser' ? 'crosshair' : undefined,
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

export const FabricCanvas = forwardRef(FabricCanvasInner)
