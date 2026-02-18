/**
 * Workspace feature module.
 * Fabric.js canvas, sync, cursors, presence, locking.
 */

export { WorkspacePage } from './components/WorkspacePage'

/** AI Client API — programmatic create/update/delete/query for canvas objects. */
export {
  createObject,
  updateObject,
  deleteObjects,
  queryObjects,
  type CreateObjectType,
  type CreateObjectProps,
  type UpdateObjectProps,
  type QueryObjectsCriteria,
} from './api/aiClientApi'

/** AI canvas ops via Edge Function (server-side agent path). */
export {
  edgeCreateObject,
  edgeUpdateObject,
  edgeDeleteObjects,
  edgeQueryObjects,
} from './api/aiCanvasOpsEdgeApi'

/** AI interpret — natural language to canvas commands. */
export { invokeAiInterpret, type AiInterpretResponse, type AiCommand } from './api/aiInterpretApi'
