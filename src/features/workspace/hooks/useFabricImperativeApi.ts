import { useImperativeHandle } from 'react'
import type React from 'react'
import {
  Canvas,
  Group,
  ActiveSelection,
  IText,
  Ellipse,
  Rect,
  Polygon,
  Polyline,
  util,
  PencilBrush,
  CircleBrush,
  SprayBrush,
  PatternBrush,
  type FabricObject,
} from 'fabric'
import type { HistoryManager } from '../lib/historyManager'
import { setStrokeWidthOnObject, setStrokeColorOnObject } from '../lib/strokeUtils'
import { setFillOnObject } from '../lib/fillUtils'
import { setFontFamilyOnObject, setFontSizeOnObject, hasEditableText } from '../lib/fontUtils'
import {
  isConnector,
  floatConnectorBothEndpoints,
  setConnectorArrowMode,
  setConnectorStrokeDash,
  type ArrowMode,
  type StrokeDash,
} from '../lib/connectorFactory'
import { getObjectId, setObjectId, setObjectZIndex } from '../lib/boardSync'
import { bringToFront, sendToBack, bringForward, sendBackward } from '../lib/fabricCanvasZOrder'
import { createFrameShape } from '../lib/frameFactory'
import { setFrameChildIds } from '../lib/frameUtils'
import { createDataTableShape } from '../lib/dataTableFactory'
import { isDataTable, getTableData, setTableFormSchema } from '../lib/dataTableUtils'
import type { FormFrameSceneInfo, FormSchema } from '../lib/frameFormTypes'
import { createSticker } from '../lib/pirateStickerFactory'
import { MAX_ZOOM, MIN_ZOOM } from '../lib/fabricCanvasZoom'
import { getClipboard, setClipboard, hasClipboard } from '../lib/clipboardStore'
import { SCALE_BANDS, ALL_SCALES_ID } from '../lib/scaleBands'
import type { GeneratedMap } from '../lib/expeditionMapGenerator'
import type { FabricCanvasZoomHandle } from '../types/fabricCanvasTypes'

/** Shared with MiniMapNavigator.MINI_MAP_PADDING; keep in sync. */
const MINI_MAP_PADDING = 50

export interface FabricImperativeApiDeps {
  ref: React.Ref<FabricCanvasZoomHandle>
  fabricImperativeRef: React.MutableRefObject<FabricCanvasZoomHandle | null>
  canvasRef: React.RefObject<Canvas | null>
  historyRef: React.RefObject<HistoryManager | null>
  captureBeforeForHistory: (obj: FabricObject) => void
  notifyFormFramesRef: React.RefObject<(() => void) | null>
  lastScenePointRef: React.RefObject<{ x: number; y: number } | null>
  onViewportChangeRef: React.MutableRefObject<((vpt: number[]) => void) | undefined>
  zoomApiRef: React.RefObject<Pick<FabricCanvasZoomHandle, 'setZoom' | 'zoomToFit' | 'zoomToSelection'> | null>
  brushWidthRef: React.MutableRefObject<number>
  brushOpacityRef: React.MutableRefObject<number>
  eraserActiveRef: React.MutableRefObject<boolean>
  width: number
  height: number
}

export function useFabricImperativeApi({
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
}: FabricImperativeApiDeps): void {
  useImperativeHandle(
    ref,
    () => {
      const api: FabricCanvasZoomHandle = {
        setZoom: (z) => zoomApiRef.current?.setZoom(z),
        zoomToFit: () => zoomApiRef.current?.zoomToFit(),
        zoomToSelection: () => zoomApiRef.current?.zoomToSelection(),
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

          const removeActions = objects.map((obj) => ({
            type: 'remove' as const,
            objectId: getObjectId(obj)!,
            snapshot: history?.snapshot(obj) ?? {},
          })).filter((a) => a.objectId)

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
        createFrame: ({ title, childIds, left, top, width: fw, height: fh }) => {
          const canvas = canvasRef.current
          if (!canvas) return ''
          const frame = createFrameShape(left, top, fw, fh, title)
          setFrameChildIds(frame, childIds)
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
        createZoomSpiral: (options?: { count?: number }) => {
          const canvas = canvasRef.current
          const history = historyRef.current
          if (!canvas) return
          const count = Math.max(5, Math.min(60, options?.count ?? 30))
          const center = (() => {
            const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
            const zoom = vpt[0]
            return { x: (width / 2 - vpt[4]) / zoom, y: (height / 2 - vpt[5]) / zoom }
          })()
          const rMin = 100
          const rMax = 5_000_000
          const baseZ = Date.now()
          const addActions: Array<{ type: 'add'; objectId: string; snapshot: Record<string, unknown> }> = []
          for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 1
            const r = rMin * Math.pow(rMax / rMin, t)
            const theta = i * (2 * Math.PI / 6)
            const x = center.x + r * Math.cos(theta)
            const y = center.y + r * Math.sin(theta)
            const stickerZoom = MAX_ZOOM * Math.pow(MIN_ZOOM / MAX_ZOOM, t)
            const sticker = createSticker('parrot', x, y, { assignId: true, zoom: stickerZoom })
            if (sticker) {
              setObjectZIndex(sticker, baseZ + i)
              canvas.add(sticker)
              const id = getObjectId(sticker)
              if (id) addActions.push({ type: 'add', objectId: id, snapshot: history?.snapshot(sticker) ?? {} })
            }
          }
          if (addActions.length > 0) history?.pushCompound(addActions)
          zoomApiRef.current?.zoomToFit()
          canvas.requestRenderAll()
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
          zoomApiRef.current?.zoomToFit()
          canvas.renderAll()
          return canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.5 })
        },
        getMiniMapData: () => {
          const canvas = canvasRef.current
          if (!canvas) return null
          const objs = canvas.getObjects()
          if (objs.length === 0) return null

          type ObjWithAbsoluteBoundingRect = FabricObject & {
            getBoundingRect: (absolute?: boolean) => { left: number; top: number; width: number; height: number }
          }
          const bounds = objs.reduce(
            (acc, obj) => {
              const b = (obj as ObjWithAbsoluteBoundingRect).getBoundingRect(true)
              return {
                minX: Math.min(acc.minX, b.left),
                minY: Math.min(acc.minY, b.top),
                maxX: Math.max(acc.maxX, b.left + b.width),
                maxY: Math.max(acc.maxY, b.top + b.height),
              }
            },
            { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
          )

          const savedVpt = [...(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])]
          const cw = bounds.maxX - bounds.minX + MINI_MAP_PADDING * 2
          const ch = bounds.maxY - bounds.minY + MINI_MAP_PADDING * 2
          const fitZoom = Math.min(200 / cw, 140 / ch)
          const vpt = canvas.viewportTransform!
          vpt[0] = fitZoom
          vpt[3] = fitZoom
          vpt[4] = -(bounds.minX - MINI_MAP_PADDING) * fitZoom
          vpt[5] = -(bounds.minY - MINI_MAP_PADDING) * fitZoom
          canvas.requestRenderAll()
          const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.3, multiplier: 1 })

          for (let i = 0; i < 6; i++) vpt[i] = savedVpt[i]
          canvas.requestRenderAll()

          return { imageDataUrl: dataUrl, contentBounds: bounds }
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

          canvas.discardActiveObject()
          canvas.remove(active)

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
        setDrawBrushWidth: (w: number) => {
          const canvas = canvasRef.current
          if (!canvas) return
          brushWidthRef.current = w
          if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas)
          canvas.freeDrawingBrush.width = w / canvas.getZoom()
        },
        setDrawBrushType: (type: 'pencil' | 'circle' | 'spray' | 'pattern') => {
          const canvas = canvasRef.current
          if (!canvas) return
          const color = canvas.freeDrawingBrush?.color ?? '#1e293b'
          const w = canvas.freeDrawingBrush?.width ?? 2
          switch (type) {
            case 'pencil':  canvas.freeDrawingBrush = new PencilBrush(canvas); break
            case 'circle':  canvas.freeDrawingBrush = new CircleBrush(canvas); break
            case 'spray':   canvas.freeDrawingBrush = new SprayBrush(canvas); break
            case 'pattern': canvas.freeDrawingBrush = new PatternBrush(canvas); break
          }
          canvas.freeDrawingBrush.color = color
          canvas.freeDrawingBrush.width = w
        },
        setDrawBrushOpacity: (opacity: number) => {
          brushOpacityRef.current = opacity
        },
        setDrawEraserMode: (active: boolean) => {
          eraserActiveRef.current = active
        },
        setActiveObjectScaleBand: (bandId: string) => {
          const canvas = canvasRef.current
          if (!canvas) return
          const active = canvas.getActiveObject()
          if (!active) return
          const data = (active.get('data') as Record<string, unknown>) ?? {}
          if (bandId === ALL_SCALES_ID) {
            const { minZoom: _min, maxZoom: _max, ...rest } = data
            active.set('data', rest)
          } else {
            const band = SCALE_BANDS.find((b) => b.id === bandId)
            if (band) {
              active.set('data', { ...data, minZoom: band.minZoom, maxZoom: band.maxZoom })
            }
          }
          canvas.fire('object:modified', { target: active })
        },
        getActiveObjectData: () => {
          const active = canvasRef.current?.getActiveObject()
          if (!active) return null
          return (active.get('data') as Record<string, unknown>) ?? null
        },
        populateExpeditionMap: (map: GeneratedMap) => {
          const canvas = canvasRef.current
          if (!canvas) return

          const baseZ = Date.now()
          for (let i = 0; i < map.objects.length; i++) {
            const spec = map.objects[i]
            let obj: FabricObject | null = null

            if (spec.type === 'ellipse') {
              obj = new Ellipse({
                left: spec.left,
                top: spec.top,
                rx: spec.width / 2,
                ry: spec.height / 2,
                fill: spec.fill ?? '#e5e7eb',
                stroke: spec.stroke ?? '#374151',
                strokeWidth: spec.strokeWidth ?? 1,
                originX: 'left',
                originY: 'top',
              })
            } else if (spec.type === 'rect') {
              obj = new Rect({
                left: spec.left,
                top: spec.top,
                width: spec.width,
                height: spec.height,
                fill: spec.fill ?? '#e5e7eb',
                stroke: spec.stroke ?? '#374151',
                strokeWidth: spec.strokeWidth ?? 1,
                originX: 'left',
                originY: 'top',
              })
            } else if (spec.type === 'text') {
              obj = new IText(spec.text ?? '', {
                left: spec.left,
                top: spec.top,
                fontSize: spec.fontSize ?? 14,
                fill: spec.fill ?? '#374151',
                editable: false,
                originX: 'left',
                originY: 'top',
              })
            } else if (spec.type === 'polygon' && spec.points) {
              obj = new Polygon(spec.points, {
                fill: spec.fill ?? '#e5e7eb',
                stroke: spec.stroke ?? '#374151',
                strokeWidth: spec.strokeWidth ?? 1,
                originX: 'left',
                originY: 'top',
              })
            } else if (spec.type === 'polyline' && spec.points) {
              obj = new Polyline(spec.points, {
                fill: 'transparent',
                stroke: spec.stroke ?? '#374151',
                strokeWidth: spec.strokeWidth ?? 1,
                strokeDashArray: spec.strokeDashArray,
                originX: 'left',
                originY: 'top',
              })
            }

            if (!obj) continue

            setObjectId(obj, crypto.randomUUID())
            setObjectZIndex(obj, baseZ + i)

            const lodData: Record<string, unknown> = {}
            if (spec.minZoom != null) lodData.minZoom = spec.minZoom
            if (spec.maxZoom != null && isFinite(spec.maxZoom)) lodData.maxZoom = spec.maxZoom
            if (spec.mapRole != null) lodData.mapRole = spec.mapRole
            if (Object.keys(lodData).length > 0) obj.set('data', { ...(obj.get('data') as Record<string, unknown> ?? {}), ...lodData })

            canvas.add(obj)
          }

          canvas.requestRenderAll()

          const zoom = map.initialZoom
          const cx = map.viewportCenter.x
          const cy = map.viewportCenter.y
          const w = canvas.width ?? 800
          const h = canvas.height ?? 600
          const vpt = canvas.viewportTransform!
          vpt[0] = zoom
          vpt[3] = zoom
          vpt[4] = w / 2 - cx * zoom
          vpt[5] = h / 2 - cy * zoom
          canvas.requestRenderAll()
          onViewportChangeRef.current?.(canvas.viewportTransform!)
        },
        getDrawBrushWidth: () => brushWidthRef.current,
        setViewportTransform: (vpt: number[]) => {
          const canvas = canvasRef.current
          if (!canvas?.viewportTransform) return
          for (let i = 0; i < 6; i++) canvas.viewportTransform![i] = vpt[i]
          canvas.requestRenderAll()
          onViewportChangeRef.current?.(canvas.viewportTransform!)
        },
      }
      fabricImperativeRef.current = api
      return api
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height]
  )
}
