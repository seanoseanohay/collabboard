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
