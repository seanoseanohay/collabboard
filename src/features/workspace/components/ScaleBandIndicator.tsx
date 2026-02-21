import { getScaleBandForZoom } from '../lib/scaleBands'

interface ScaleBandIndicatorProps {
  zoom: number
}

export function ScaleBandIndicator({ zoom }: ScaleBandIndicatorProps) {
  const band = getScaleBandForZoom(zoom)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        right: 16,
        padding: '4px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid #e5e7eb',
        fontSize: 12,
        color: '#374151',
        pointerEvents: 'none',
        zIndex: 6,
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
      }}
    >
      {band.emoji} {band.name} View
    </div>
  )
}
