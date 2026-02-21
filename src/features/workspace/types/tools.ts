/**
 * Workspace tool types for shape creation and interaction.
 */

export type ToolType =
  | 'select'
  | 'hand'
  | 'lasso'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'ellipse'
  | 'polygon'
  | 'line'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'table'
  | 'sticker'
  | 'draw'
  | 'input-field'
  | 'button'

export const SHAPE_TOOLS: ToolType[] = [
  'rect',
  'circle',
  'triangle',
  'ellipse',
  'polygon',
  'line',
  'text',
  'sticky',
  'frame',
  'table',
]

export function isShapeTool(tool: ToolType): boolean {
  return SHAPE_TOOLS.includes(tool)
}
