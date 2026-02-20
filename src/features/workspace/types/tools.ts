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
  | 'line'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'sticker'
  | 'draw'

export const SHAPE_TOOLS: ToolType[] = [
  'rect',
  'circle',
  'triangle',
  'line',
  'text',
  'sticky',
  'frame',
]

export function isShapeTool(tool: ToolType): boolean {
  return SHAPE_TOOLS.includes(tool)
}
