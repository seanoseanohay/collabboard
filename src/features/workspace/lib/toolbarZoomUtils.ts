import { ZOOM_SLIDER_MIN, ZOOM_SLIDER_MAX } from './toolbarConstants'

export function zoomToLabel(z: number): string {
  const pct = z * 100
  if (pct >= 100) return `${Math.round(pct)}%`
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

export function zoomToSliderValue(zoom: number): number {
  const clamped = Math.min(ZOOM_SLIDER_MAX, Math.max(ZOOM_SLIDER_MIN, zoom))
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return 100 * ((Math.log(clamped) - logMin) / (logMax - logMin))
}

export function sliderValueToZoom(value: number): number {
  const t = value / 100
  const logMin = Math.log(ZOOM_SLIDER_MIN)
  const logMax = Math.log(ZOOM_SLIDER_MAX)
  return Math.exp(logMin + t * (logMax - logMin))
}
