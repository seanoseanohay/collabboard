/**
 * Tests for shapeFactory: createShape for all tool types.
 */

import { createShape } from './shapeFactory'
import type { ToolType } from '../types/tools'

const SHAPE_TOOLS: ToolType[] = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky']

describe('shapeFactory', () => {
  describe('createShape', () => {
    it.each(SHAPE_TOOLS)('creates %s with assignId by default', (tool) => {
      const shape = createShape(tool, 0, 0, 100, 80)
      expect(shape).not.toBeNull()
      const data = shape!.get('data') as { id?: string }
      expect(data?.id).toBeDefined()
      expect(typeof data?.id).toBe('string')
      expect(data.id!.length).toBeGreaterThan(0)
    })

    it.each(SHAPE_TOOLS)('creates %s with assignId: false when requested', (tool) => {
      const shape = createShape(tool, 0, 0, 100, 80, { assignId: false })
      expect(shape).not.toBeNull()
      const data = shape!.get('data') as { id?: string }
      expect(data?.id ?? '').toBe('')
    })

    it('creates rect with correct dimensions (left/top origin)', () => {
      const shape = createShape('rect', 50, 60, 150, 120)
      expect(shape).not.toBeNull()
      expect(shape!.left).toBe(50)
      expect(shape!.top).toBe(60)
      expect(shape!.width).toBe(100)
      expect(shape!.height).toBe(60)
    })

    it('creates rect with flipped coords (min/max normalization)', () => {
      const shape = createShape('rect', 150, 120, 50, 60)
      expect(shape).not.toBeNull()
      expect(shape!.left).toBe(50)
      expect(shape!.top).toBe(60)
      expect(shape!.width).toBe(100)
      expect(shape!.height).toBe(60)
    })

    it('creates circle with radius from bounding box', () => {
      const shape = createShape('circle', 0, 0, 100, 100)
      expect(shape).not.toBeNull()
      expect(shape!.radius).toBe(50)
    })

    it('creates line (Polyline) with two points', () => {
      const shape = createShape('line', 10, 20, 110, 120)
      expect(shape).not.toBeNull()
      expect(['path', 'polyline']).toContain(shape!.type)
    })

    it('creates text with default content', () => {
      const shape = createShape('text', 0, 0, 100, 40)
      expect(shape).not.toBeNull()
      expect(shape!.text).toBe('Text')
    })

    it('creates sticky as Group', () => {
      const shape = createShape('sticky', 0, 0, 120, 80)
      expect(shape).not.toBeNull()
      expect(shape!.type).toBe('group')
    })

    it('returns null for invalid tool', () => {
      const shape = createShape('select' as ToolType, 0, 0, 100, 100)
      expect(shape).toBeNull()
    })

    it('ensures minimum width/height of 1', () => {
      const shape = createShape('rect', 0, 0, 0, 0)
      expect(shape).not.toBeNull()
      expect(shape!.width).toBe(1)
      expect(shape!.height).toBe(1)
    })
  })
})
