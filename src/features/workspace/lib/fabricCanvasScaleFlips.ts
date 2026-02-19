/**
 * Normalize negative scale to flip + positive scale for Fabric.js objects.
 *
 * When a user drags a scale handle past its opposite (e.g. top past bottom),
 * Fabric produces negative scaleX/scaleY. We convert that to positive scale
 * plus flipX/flipY for stable persistence and sync.
 *
 * Called only at object:modified (not during drag) to avoid fighting Fabric's
 * control logic. applyRemote skips the active object so our own postgres_changes
 * echo doesn't overwrite the in-progress transform.
 */

import type { FabricObject } from 'fabric'

/**
 * Normalize negative scale → flip + positive scale on a FabricObject.
 * Call at object:modified so the final state is canonical for sync.
 */
export function normalizeScaleFlips(obj: FabricObject): void {
  const scaleX = obj.scaleX ?? 1
  const scaleY = obj.scaleY ?? 1
  const flipX = obj.flipX ?? false
  const flipY = obj.flipY ?? false

  let changed = false
  const updates: Partial<{ scaleX: number; scaleY: number; flipX: boolean; flipY: boolean }> = {}

  if (scaleX < 0) {
    updates.scaleX = Math.abs(scaleX)
    updates.flipX = !flipX
    changed = true
  }
  if (scaleY < 0) {
    updates.scaleY = Math.abs(scaleY)
    updates.flipY = !flipY
    changed = true
  }

  if (changed) {
    obj.set(updates)
    obj.setCoords()
  }
}
