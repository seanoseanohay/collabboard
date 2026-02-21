export function formatLastAccessed(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Opened just now'
  if (diff < 3600_000) return `Opened ${Math.floor(diff / 60000)}m ago`
  if (diff < 86400_000) return `Opened ${Math.floor(diff / 3600000)}h ago`
  if (diff < 7 * 86400_000) return `Opened ${Math.floor(diff / 86400000)}d ago`
  return `Opened ${d.toLocaleDateString()}`
}
