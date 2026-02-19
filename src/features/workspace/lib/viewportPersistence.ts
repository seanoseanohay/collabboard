/**
 * Viewport persistence: save/restore zoom and pan per board in localStorage.
 * Key: meboard:viewport:{boardId}
 * Value: JSON array [scaleX, skewY, skewX, scaleY, translateX, translateY]
 */

const STORAGE_PREFIX = 'meboard:viewport:'

function getViewportKey(boardId: string): string {
  return `${STORAGE_PREFIX}${boardId}`
}

const MIN_ZOOM = 0.00001
const MAX_ZOOM = 10

/** Validates viewportTransform array. Fabric uses [scaleX, skewY, skewX, scaleY, translateX, translateY]. */
function isValidViewport(arr: unknown): arr is number[] {
  if (!Array.isArray(arr) || arr.length !== 6) return false
  const nums = arr.every((n) => typeof n === 'number')
  const zoom = arr[0]
  return nums && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM
}

export function loadViewport(boardId: string): number[] | null {
  try {
    const key = getViewportKey(boardId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isValidViewport(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveViewport(boardId: string, vpt: number[]): void {
  if (!isValidViewport(vpt)) return
  try {
    const key = getViewportKey(boardId)
    localStorage.setItem(key, JSON.stringify(vpt))
  } catch {
    // Ignore quota or access errors
  }
}
