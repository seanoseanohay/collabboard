/**
 * Workspace tool types for shape creation and interaction.
 */

export type ToolType =
  | 'select'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'text'
  | 'sticky'

export const SHAPE_TOOLS: ToolType[] = [
  'rect',
  'circle',
  'triangle',
  'line',
  'text',
  'sticky',
]

export function isShapeTool(tool: ToolType): boolean {
  return SHAPE_TOOLS.includes(tool)
}
