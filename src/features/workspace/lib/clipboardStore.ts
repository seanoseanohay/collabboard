/**
 * In-memory clipboard for canvas Copy & Paste.
 * Session-only (clears on page refresh). Serialized via Fabric toObject.
 */

export type ClipboardData = {
  objects: unknown[]
}

let clipboard: ClipboardData | null = null

export function getClipboard(): ClipboardData | null {
  return clipboard
}

export function setClipboard(data: ClipboardData | null): void {
  clipboard = data
}

export function hasClipboard(): boolean {
  return clipboard != null && clipboard.objects.length > 0
}
