import type { ToolType } from '../types/tools'

export const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'hand', label: 'Hand' },
  { id: 'lasso', label: 'Lasso' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'polygon-draw', label: 'Freeform Polygon' },
  { id: 'line', label: 'Line' },
  { id: 'draw', label: 'Draw' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky note' },
  { id: 'frame', label: 'Frame' },
]

export const INSERT_TOOLS: ToolType[] = [
  'rect',
  'circle',
  'triangle',
  'ellipse',
  'polygon',
  'polygon-draw',
  'line',
  'draw',
  'text',
  'sticky',
  'frame',
]

export const ZOOM_PRESETS = [0.00001, 0.001, 0.01, 0.25, 0.5, 1, 2, 4, 10, 100]
export const ZOOM_SLIDER_MIN = 0.00001
export const ZOOM_SLIDER_MAX = 10
