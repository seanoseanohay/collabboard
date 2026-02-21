import { useState, useEffect } from 'react'

/**
 * Breakpoint below which mobile hamburger layout is used.
 * Matches common phone widths; tablets (768px+) use desktop layout.
 */
export const MOBILE_BREAKPOINT_PX = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`

/**
 * Returns true when viewport width is below the mobile breakpoint.
 * Used to switch to hamburger/drawer UI (Figma-like) on phones.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const handler = () => setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
