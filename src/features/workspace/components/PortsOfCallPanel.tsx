import { useEffect, useRef, useState } from 'react'
import { addPort, loadPorts, removePort, type PortOfCall } from '../lib/portsOfCall'
import { getScaleBandForZoom } from '../lib/scaleBands'

interface PortsOfCallPanelProps {
  boardId: string
  /** Current viewport center in scene coords and zoom level */
  currentX: number
  currentY: number
  currentZoom: number
  onNavigate: (port: PortOfCall) => void
  onClose: () => void
}

export function PortsOfCallPanel({
  boardId,
  currentX,
  currentY,
  currentZoom,
  onNavigate,
  onClose,
}: PortsOfCallPanelProps) {
  const [ports, setPorts] = useState<PortOfCall[]>(() => loadPorts(boardId))
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSave = () => {
    const name = window.prompt('Name this port:', getScaleBandForZoom(currentZoom).name + ' View')
    if (!name?.trim()) return
    const port: PortOfCall = {
      id: crypto.randomUUID(),
      name: name.trim(),
      x: Math.round(currentX),
      y: Math.round(currentY),
      zoom: currentZoom,
    }
    addPort(boardId, port)
    setPorts(loadPorts(boardId))
  }

  const handleDelete = (portId: string) => {
    removePort(boardId, portId)
    setPorts(loadPorts(boardId))
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 48,
        right: 8,
        width: 220,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>🧭 Ports of Call</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 0 }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Port list */}
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {ports.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
            No ports saved yet.<br />Save your current view below.
          </div>
        ) : (
          ports.map((port) => {
            const band = getScaleBandForZoom(port.zoom)
            return (
              <div
                key={port.id}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f9fafb', gap: 8 }}
              >
                <button
                  onClick={() => onNavigate(port)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{port.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{band.emoji} {band.name} · {Math.round(port.zoom * 100)}%</div>
                </button>
                <button
                  onClick={() => handleDelete(port.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Save button */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '6px 0',
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          + Save current view
        </button>
      </div>
    </div>
  )
}
