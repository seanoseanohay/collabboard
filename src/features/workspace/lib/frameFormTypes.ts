/**
 * Type definitions for Frame-level schema-driven forms.
 * Forms are stored in frame.data.formSchema and sync via the normal boardSync path.
 */

export type FormFieldType = 'text' | 'number' | 'dropdown' | 'checkbox' | 'date'

export interface FormColumn {
  id: string
  name: string
  type: FormFieldType
  /** Only used when type === 'dropdown'. */
  options?: string[]
}

export interface FormRow {
  id: string
  values: Record<string, string | number | boolean>
}

export interface FormSchema {
  columns: FormColumn[]
  rows: FormRow[]
}

/** Screen-space info for a frame, computed by FabricCanvas and passed to FrameFormOverlay. */
export interface FormFrameSceneInfo {
  frameId: string
  /** frame.left (scene, unscaled) */
  sceneLeft: number
  /** frame.top (scene, unscaled) */
  sceneTop: number
  /** frame.width (unscaled bounding width) */
  sceneWidth: number
  /** frame.height (unscaled bounding height) */
  sceneHeight: number
  scaleX: number
  scaleY: number
  formSchema: FormSchema | null
}
