import { Z_INDEX } from '@/shared/constants/zIndex'

export const fabricCanvasStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  container: {
    width: '100%',
    height: '100%',
    minHeight: 0,
    background: 'transparent',
    cursor: 'default',
    position: 'relative',
    zIndex: Z_INDEX.CANVAS,
    touchAction: 'none',
  },
}
