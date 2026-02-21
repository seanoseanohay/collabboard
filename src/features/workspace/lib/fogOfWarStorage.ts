/**
 * Fog of War reveal regions — localStorage persistence per board.
 * MVP: single-user; later: Supabase table for multi-user sync.
 */

export interface FogReveal {
  cx: number
  cy: number
  radius: number
}

const STORAGE_KEY = (boardId: string) => `meboard:fog:${boardId}`
const FOG_ENABLED_KEY = (boardId: string) => `meboard:fog-enabled:${boardId}`

export function loadFogEnabled(boardId: string): boolean {
  try {
    const raw = localStorage.getItem(FOG_ENABLED_KEY(boardId))
    return raw === 'true'
  } catch {
    return false
  }
}

export function saveFogEnabled(boardId: string, enabled: boolean): void {
  localStorage.setItem(FOG_ENABLED_KEY(boardId), String(enabled))
}

export function loadFogReveals(boardId: string): FogReveal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(boardId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveFogReveals(boardId: string, reveals: FogReveal[]): void {
  localStorage.setItem(STORAGE_KEY(boardId), JSON.stringify(reveals))
}

export function addFogReveal(boardId: string, reveal: FogReveal): FogReveal[] {
  const reveals = loadFogReveals(boardId)
  reveals.push(reveal)
  saveFogReveals(boardId, reveals)
  return reveals
}
