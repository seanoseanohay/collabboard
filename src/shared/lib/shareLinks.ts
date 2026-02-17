/**
 * Share link utilities for board collaboration.
 */

/**
 * Extracts board ID from a share URL or raw ID.
 * Handles: full URL, path-only URL, or raw UUID.
 */
export function parseBoardIdFromShareInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const uuidRegex =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const match = trimmed.match(uuidRegex)
  return match ? match[0] : null
}

/**
 * Builds the shareable URL for a board.
 */
export function getShareUrl(boardId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/board/${boardId}`
}
