/**
 * DataTable shape factory.
 * A DataTable is a standalone canvas object (Fabric Group: bg Rect + title IText)
 * that renders an HTML form overlay for structured data entry.
 * Unlike a Frame, a DataTable does NOT capture child canvas objects —
 * it is the exclusive occupant of its area.
 */

import { Rect, IText, Group, type FabricObject } from 'fabric'

export const TABLE_HEADER_HEIGHT = 40
export const TABLE_MIN_WIDTH = 280
export const TABLE_MIN_HEIGHT = 180

/**
 * Creates a DataTable Fabric Group.
 *
 * @param assignId - When false, no UUID is assigned (drag preview only;
 *   boardSync.emitAdd skips objects without an id).
 */
export function createDataTableShape(
  left: number,
  top: number,
  width: number,
  height: number,
  title = 'Untitled Table',
  assignId = true
): FabricObject {
  const w = Math.max(width, TABLE_MIN_WIDTH)
  const h = Math.max(height, TABLE_MIN_HEIGHT)

  const bg = new Rect({
    left: 0,
    top: 0,
    width: w,
    height: h,
    fill: '#ffffff',
    stroke: '#93c5fd',
    strokeWidth: 2,
    rx: 6,
    ry: 6,
    originX: 'left',
    originY: 'top',
  })

  const titleText = new IText(title, {
    left: 12,
    top: 10,
    fontSize: 12,
    fontWeight: 'bold',
    fill: '#1d4ed8',
    editable: true,
    originX: 'left',
    originY: 'top',
  })

  const group = new Group([bg, titleText], {
    left,
    top,
    originX: 'left',
    originY: 'top',
  })

  if (assignId) {
    const id = crypto.randomUUID()
    group.set('data', { id, subtype: 'table', title, formSchema: null })
  } else {
    group.set('data', { subtype: 'table', formSchema: null })
  }
  return group
}
