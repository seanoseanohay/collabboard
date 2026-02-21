import { Canvas, Group, ActiveSelection, util, type FabricObject } from 'fabric'
import type React from 'react'
import { type HistoryManager } from '../lib/historyManager'
import { getObjectId, setObjectZIndex } from '../lib/boardSync'
import { ZOOM_STEP } from '../lib/fabricCanvasZoom'
import { isConnector, floatConnectorEndpoint, updateConnectorEndpoints } from '../lib/connectorFactory'
import type { ToolType } from '../types/tools'
import type { FabricCanvasZoomHandle } from '../types/fabricCanvasTypes'
import type { FabricCanvasInteractionState } from './fabricCanvasEventHandlers'

export interface KeyHandlerDeps {
  fabricCanvas: Canvas
  st: FabricCanvasInteractionState
  history: HistoryManager
  fabricImperativeRef: React.MutableRefObject<FabricCanvasZoomHandle | null>
  onToolChangeRef: React.MutableRefObject<((tool: ToolType) => void) | undefined>
  getObjectsToHistorize: (active: FabricObject) => FabricObject[]
  onZoomDragMouseMove: (ev: MouseEvent) => void
  onZoomDragMouseUp: () => void
  onMarqueeMouseMove: (ev: MouseEvent) => void
  onMarqueeMouseUp: () => void
  onLassoMouseMove: (ev: MouseEvent) => void
  onLassoMouseUp: () => void
  onPolygonDrawMouseMove: (ev: MouseEvent) => void
  applyZoom: (newZoom: number) => void
  zoomToFit: () => void
  zoomToSelection: () => void
  handleMouseUp: () => void
}

const hasEditingText = (obj: unknown) =>
  obj && 'isEditing' in (obj as object) && (obj as { isEditing: boolean }).isEditing
const isEditingText = (active: unknown) =>
  active && (hasEditingText(active) ||
    ('getObjects' in (active as object) &&
      (active as { getObjects: () => unknown[] }).getObjects().some(hasEditingText)))

export function createKeyboardHandlers({
  fabricCanvas, st, history, fabricImperativeRef, onToolChangeRef,
  getObjectsToHistorize,
  onZoomDragMouseMove, onZoomDragMouseUp,
  onMarqueeMouseMove, onMarqueeMouseUp,
  onLassoMouseMove, onLassoMouseUp,
  onPolygonDrawMouseMove,
  applyZoom, zoomToFit, zoomToSelection,
  handleMouseUp,
}: KeyHandlerDeps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    const active = fabricCanvas.getActiveObject()
    if (isEditingText(active)) return

    const isMod = e.metaKey || e.ctrlKey

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

    if (isMod && e.key === 'd') {
      e.preventDefault()
      void fabricImperativeRef.current?.duplicateSelected()
      return
    }
    if (isMod && e.key === 'c') {
      e.preventDefault()
      fabricImperativeRef.current?.copySelected()
      return
    }
    if (isMod && e.key === 'v') {
      e.preventDefault()
      void fabricImperativeRef.current?.paste()
      return
    }

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
      if (st.zoomDragState) {
        fabricCanvas.remove(st.zoomDragState.rect)
        st.zoomDragState = null
        document.removeEventListener('mousemove', onZoomDragMouseMove)
        document.removeEventListener('mouseup', onZoomDragMouseUp)
      }
      if (st.marqueeState) {
        fabricCanvas.remove(st.marqueeState.rect)
        st.marqueeState = null
        document.removeEventListener('mousemove', onMarqueeMouseMove)
        document.removeEventListener('mouseup', onMarqueeMouseUp)
      }
      if (st.lassoState) {
        fabricCanvas.remove(st.lassoState.preview)
        st.lassoState = null
        document.removeEventListener('mousemove', onLassoMouseMove)
        document.removeEventListener('mouseup', onLassoMouseUp)
      }
      if (st.polygonDrawState) {
        if (st.polygonDrawState.preview) fabricCanvas.remove(st.polygonDrawState.preview)
        document.removeEventListener('mousemove', onPolygonDrawMouseMove)
        st.polygonDrawState = null
      }
      if (st.isDrawing && st.previewObj) {
        fabricCanvas.remove(st.previewObj)
        st.previewObj = null
      }
      st.isDrawing = false
      if (st.connectorPreviewLine) {
        fabricCanvas.remove(st.connectorPreviewLine)
        st.connectorPreviewLine = null
      }
      st.connectorDrawState = null
      st.connectorHoverSnap = null
      fabricCanvas.discardActiveObject()
      fabricCanvas.isDrawingMode = false
      fabricCanvas.requestRenderAll()
      onToolChangeRef.current?.('select')
      return
    }
    if (e.key === ' ') {
      st.spacePressed = true
      fabricCanvas.selection = false
      e.preventDefault()
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (active) {
        e.preventDefault()
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
        objs.forEach((obj) => {
          const id = getObjectId(obj)
          if (id) history.pushRemove(id, history.snapshot(obj))
        })
        fabricCanvas.remove(active)
        fabricCanvas.discardActiveObject()
        fabricCanvas.requestRenderAll()
      }
    }
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
    } else if (e.key === '2' && e.shiftKey) {
      e.preventDefault()
      zoomToSelection()
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    const active = fabricCanvas.getActiveObject()
    if (isEditingText(active)) return

    if (e.key === ' ') {
      e.preventDefault()
      st.spacePressed = false
      fabricCanvas.selection = true
      if (st.isPanning) handleMouseUp()
    }
  }

  return { handleKeyDown, handleKeyUp }
}
