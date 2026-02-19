/**
 * Frame shape factory.
 * A Frame is a visual container (Fabric Group: bg Rect + title IText) whose
 * associated canvas objects are tracked by ID in data.childIds. Unlike a Fabric
 * Group, the children are independent canvas objects — they remain selectable and
 * fully editable, while the frame can be moved to translate all children together.
 */

import { Rect, IText, Group, type FabricObject } from 'fabric'

export const FRAME_HEADER_HEIGHT = 40
export const FRAME_MIN_WIDTH = 200
export const FRAME_MIN_HEIGHT = 150

/**
 * Creates a Frame Fabric Group object.
 * The group contains only visual chrome (bg Rect + title IText).
 * Associated canvas objects are tracked in data.childIds, not as Fabric children.
 */
export function createFrameShape(
  left: number,
  top: number,
  width: number,
  height: number,
  title = 'Frame'
): FabricObject {
  const w = Math.max(width, FRAME_MIN_WIDTH)
  const h = Math.max(height, FRAME_MIN_HEIGHT)

  const bg = new Rect({
    left: 0,
    top: 0,
    width: w,
    height: h,
    fill: 'rgba(241, 245, 249, 0.55)',
    stroke: '#94a3b8',
    strokeWidth: 2,
    rx: 8,
    ry: 8,
    originX: 'left',
    originY: 'top',
  })

  const titleText = new IText(title, {
    left: 12,
    top: 8,
    fontSize: 14,
    fontWeight: 'bold',
    fill: '#475569',
    editable: true,
    originX: 'left',
    originY: 'top',
  })

  const id = crypto.randomUUID()
  const group = new Group([bg, titleText], {
    left,
    top,
    originX: 'left',
    originY: 'top',
  })

  group.set('data', { id, subtype: 'frame', title, childIds: [] as string[] })
  return group
}
