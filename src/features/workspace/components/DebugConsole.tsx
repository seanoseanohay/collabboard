/**
 * Developer debug overlay — toggled with backtick (`).
 * Shows canvas FPS, object count, zoom, presence peers, DB sync latency,
 * and cursor broadcast round-trip latency (measured via self-ping).
 */

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/shared/lib/supabase/config'

interface DebugConsoleProps {
  visible: boolean
  fps: number
  objectCount: number
  selectedCount: number
  zoom: number
  presenceCount: number
  /** Rolling average object→DB→echo round-trip in ms. Null until first measurement. */
  objectSyncLatency: number | null
  boardId: string
}

const PING_INTERVAL_MS = 2500
const LATENCY_HISTORY_SIZE = 8

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function latencyColor(ms: number | null): string {
  if (ms === null) return '#94a3b8'
  if (ms < 100) return '#4ade80'
  if (ms < 300) return '#facc15'
  return '#f87171'
}

function fpsColor(fps: number): string {
  if (fps >= 55) return '#4ade80'
  if (fps >= 30) return '#facc15'
  return '#f87171'
}

export function DebugConsole({
  visible,
  fps,
  objectCount,
  selectedCount,
  zoom,
  presenceCount,
  objectSyncLatency,
  boardId,
}: DebugConsoleProps) {
  const [broadcastLatency, setBroadcastLatency] = useState<number | null>(null)
  const broadcastHistoryRef = useRef<number[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pingTimestampsRef = useRef<Map<string, number>>(new Map())

  // Object sync latency rolling average
  const syncHistoryRef = useRef<number[]>([])
  const [avgSyncLatency, setAvgSyncLatency] = useState<number | null>(null)

  useEffect(() => {
    if (objectSyncLatency !== null) {
      syncHistoryRef.current = [...syncHistoryRef.current.slice(-(LATENCY_HISTORY_SIZE - 1)), objectSyncLatency]
      setAvgSyncLatency(avg(syncHistoryRef.current))
    }
  }, [objectSyncLatency])

  // Self-ping broadcast channel for cursor/broadcast latency
  useEffect(() => {
    if (!visible || !boardId) return

    const supabase = getSupabaseClient()
    const channel = supabase.channel(`debug:${boardId}`, {
      config: { broadcast: { self: true } },
    })

    channel.on('broadcast', { event: 'debug_ping' }, (msg) => {
      const payload = (msg as unknown as { payload: { seq: string; t: number } }).payload
      const sentAt = pingTimestampsRef.current.get(payload.seq)
      if (sentAt !== undefined) {
        pingTimestampsRef.current.delete(payload.seq)
        const latency = Date.now() - sentAt
        broadcastHistoryRef.current = [...broadcastHistoryRef.current.slice(-(LATENCY_HISTORY_SIZE - 1)), latency]
        setBroadcastLatency(avg(broadcastHistoryRef.current))
      }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      const sendPing = () => {
        const seq = crypto.randomUUID()
        pingTimestampsRef.current.set(seq, Date.now())
        void channel.send({ type: 'broadcast', event: 'debug_ping', payload: { seq, t: Date.now() } })
      }
      sendPing()
      pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL_MS)
    })

    channelRef.current = channel

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
      void supabase.removeChannel(channel)
      channelRef.current = null
      setBroadcastLatency(null)
      broadcastHistoryRef.current = []
      pingTimestampsRef.current.clear()
    }
  }, [visible, boardId])

  if (!visible) return null

  const zoomPct = Math.round(zoom * 100)

  return (
    <div style={styles.panel}>
      <div style={styles.header}>⚙ DEBUG</div>
      <table style={styles.table}>
        <tbody>
          <Row label="FPS" value={fps > 0 ? `${fps}` : '—'} valueColor={fps > 0 ? fpsColor(fps) : '#94a3b8'} unit="fps" />
          <Row label="Objects" value={`${objectCount}`} />
          {selectedCount > 0 && <Row label="Selected" value={`${selectedCount}`} valueColor="#60a5fa" />}
          <Row label="Zoom" value={`${zoomPct}`} unit="%" />
          <Row label="Peers" value={`${presenceCount}`} />
          <Row
            label="DB latency"
            value={avgSyncLatency !== null ? `${avgSyncLatency}` : '—'}
            valueColor={latencyColor(avgSyncLatency)}
            unit={avgSyncLatency !== null ? 'ms' : ''}
            hint="write→echo"
          />
          <Row
            label="Broadcast"
            value={broadcastLatency !== null ? `${broadcastLatency}` : '…'}
            valueColor={latencyColor(broadcastLatency)}
            unit={broadcastLatency !== null ? 'ms' : ''}
            hint="self-ping"
          />
        </tbody>
      </table>
      <div style={styles.footer}>` to hide</div>
    </div>
  )
}

function Row({
  label,
  value,
  unit = '',
  valueColor = '#e2e8f0',
  hint,
}: {
  label: string
  value: string
  unit?: string
  valueColor?: string
  hint?: string
}) {
  return (
    <tr>
      <td style={styles.tdLabel}>{label}</td>
      <td style={{ ...styles.tdValue, color: valueColor }}>
        {value}
        {unit && <span style={styles.unit}> {unit}</span>}
        {hint && <span style={styles.hint}> {hint}</span>}
      </td>
    </tr>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: 36,
    right: 12,
    width: 220,
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    padding: '8px 10px 6px',
    fontFamily: '"JetBrains Mono", "Fira Mono", ui-monospace, monospace',
    fontSize: 11,
    color: '#e2e8f0',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    zIndex: 9999,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  header: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tdLabel: {
    color: '#64748b',
    paddingRight: 8,
    paddingBottom: 2,
    whiteSpace: 'nowrap',
    fontSize: 11,
  },
  tdValue: {
    textAlign: 'right',
    paddingBottom: 2,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 12,
    fontWeight: 600,
  },
  unit: {
    fontSize: 10,
    fontWeight: 400,
    color: '#64748b',
  },
  hint: {
    fontSize: 9,
    fontWeight: 400,
    color: '#475569',
  },
  footer: {
    marginTop: 6,
    fontSize: 9,
    color: '#334155',
    textAlign: 'right',
  },
}
