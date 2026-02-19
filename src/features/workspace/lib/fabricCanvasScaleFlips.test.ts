/**
 * Tests for fabricCanvasScaleFlips: normalizeScaleFlips utility.
 */

import { Rect } from 'fabric'
import { normalizeScaleFlips } from './fabricCanvasScaleFlips'

describe('fabricCanvasScaleFlips', () => {
  describe('normalizeScaleFlips', () => {
    it('converts negative scaleX to flipX + positive scale', () => {
      const rect = new Rect({ width: 100, height: 50, scaleX: -1.5, scaleY: 1 })
      normalizeScaleFlips(rect)
      expect(rect.scaleX).toBe(1.5)
      expect(rect.flipX).toBe(true)
      expect(rect.scaleY).toBe(1)
      expect(rect.flipY).toBe(false)
    })

    it('converts negative scaleY to flipY + positive scale', () => {
      const rect = new Rect({ width: 100, height: 50, scaleX: 1, scaleY: -0.8 })
      normalizeScaleFlips(rect)
      expect(rect.scaleX).toBe(1)
      expect(rect.flipX).toBe(false)
      expect(rect.scaleY).toBe(0.8)
      expect(rect.flipY).toBe(true)
    })

    it('leaves positive scale unchanged', () => {
      const rect = new Rect({ width: 100, height: 50, scaleX: 1.2, scaleY: 0.9 })
      normalizeScaleFlips(rect)
      expect(rect.scaleX).toBe(1.2)
      expect(rect.scaleY).toBe(0.9)
      expect(rect.flipX).toBe(false)
      expect(rect.flipY).toBe(false)
    })

    it('handles both axes negative', () => {
      const rect = new Rect({ width: 100, height: 50, scaleX: -2, scaleY: -0.5 })
      normalizeScaleFlips(rect)
      expect(rect.scaleX).toBe(2)
      expect(rect.scaleY).toBe(0.5)
      expect(rect.flipX).toBe(true)
      expect(rect.flipY).toBe(true)
    })
  })
})
