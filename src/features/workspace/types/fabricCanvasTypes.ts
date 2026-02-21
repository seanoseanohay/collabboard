import type { FabricObject } from 'fabric'
import type { FormSchema } from '../lib/frameFormTypes'
import type { FormFrameSceneInfo } from '../lib/frameFormTypes'
import type { ArrowMode, StrokeDash } from '../lib/connectorFactory'
import type { ConnectorPort } from '../lib/connectorPortUtils'
import type { GeneratedMap } from '../lib/expeditionMapGenerator'
import type { ToolType } from './tools'
import type { StickerKind } from '../lib/pirateStickerFactory'

export interface SelectionStrokeInfo {
  strokeWidth: number
  strokeColor: string | null
  fill: string | null
  canGroup: boolean
  canUngroup: boolean
  isTextOnly: boolean
  isStickyNote: boolean
  fontFamily: string | null
  fontSize: number | null
  isConnector: boolean
  arrowMode: ArrowMode | null
  strokeDash: StrokeDash | null
  isFrame: boolean
  frameFormSchema: FormSchema | null
}

export interface FabricCanvasZoomHandle {
  setZoom: (zoom: number) => void
  zoomToFit: () => void
  zoomToSelection: () => void
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
  createFrame: (params: {
    title: string
    childIds: string[]
    left: number
    top: number
    width: number
    height: number
  }) => string
  setFrameChildren: (frameId: string, childIds: string[]) => void
  panToScene: (sceneX: number, sceneY: number) => void
  captureDataUrl: () => string | null
  getMiniMapData: () => {
    imageDataUrl: string
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number }
  } | null
  resetView: () => void
  duplicateSelected: () => Promise<void>
  copySelected: () => void
  paste: () => Promise<void>
  hasClipboard: () => boolean
  setDrawBrushColor: (color: string) => void
  setDrawBrushWidth: (width: number) => void
  setDrawBrushType: (type: 'pencil' | 'circle' | 'spray' | 'pattern') => void
  setDrawBrushOpacity: (opacity: number) => void
  setDrawEraserMode: (active: boolean) => void
  getViewportCenter: () => { x: number; y: number }
  updateFrameFormData: (frameId: string, formSchema: FormSchema | null) => void
  updateTableTitle: (objectId: string, title: string) => void
  getFormFrameInfos: () => FormFrameSceneInfo[]
  createTable: (params: {
    left: number
    top: number
    width: number
    height: number
    title: string
    showTitle: boolean
    accentColor?: string
    formSchema: FormSchema | null
  }) => string
  createZoomSpiral: (options?: { count?: number }) => void
  setActiveObjectScaleBand: (bandId: string) => void
  getActiveObjectData: () => Record<string, unknown> | null
  populateExpeditionMap: (map: GeneratedMap) => void
  getDrawBrushWidth: () => number
  setViewportTransform: (vpt: number[]) => void
}

export interface ConnectorDropState {
  screenX: number
  screenY: number
  scenePoint: { x: number; y: number }
  sourceId: string
  sourcePort: ConnectorPort
}

export interface FabricCanvasProps {
  width?: number
  height?: number
  className?: string
  selectedTool?: ToolType
  selectedStickerKind?: StickerKind
  boardId?: string
  boardMode?: 'standard' | 'explorer'
  userId?: string
  userName?: string
  polygonSides?: number
  starMode?: boolean
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
  gridType?: 'square' | 'hex' | 'none'
  snapToGrid?: boolean
  onFogReveal?: (cx: number, cy: number, radius: number) => void
}
