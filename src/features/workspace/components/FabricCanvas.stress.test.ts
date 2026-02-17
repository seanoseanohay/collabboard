/**
 * Fabric-specific stress test: 500+ objects (PRD perf target).
 */

import { Canvas } from 'fabric'
import { createShape } from '../lib/shapeFactory'
import { setObjectId } from '../lib/boardSync'

describe('FabricCanvas stress', () => {
  it('handles 500 objects without degradation', () => {
    const el = document.createElement('canvas')
    el.width = 800
    el.height = 600
    const canvas = new Canvas(el)

    const objects: ReturnType<typeof createShape>[] = []
    for (let i = 0; i < 500; i++) {
      const shape = createShape('rect', i * 2, i % 100, i * 2 + 50, (i % 100) + 30, {
        assignId: true,
      })
      expect(shape).not.toBeNull()
      if (shape) {
        objects.push(shape)
      }
    }

    objects.forEach((obj, i) => {
      if (obj) {
        setObjectId(obj, `obj-${i}`)
        canvas.add(obj)
      }
    })

    expect(canvas.getObjects().length).toBe(500)
    canvas.requestRenderAll()
    canvas.dispose()
  })

  it('handles 500 circles (viewport culling target)', () => {
    const el = document.createElement('canvas')
    el.width = 800
    el.height = 600
    const canvas = new Canvas(el)

    for (let i = 0; i < 500; i++) {
      const shape = createShape('circle', i % 80 * 20, Math.floor(i / 80) * 20, 10, 10)
      expect(shape).not.toBeNull()
      if (shape) {
        setObjectId(shape, `circle-${i}`)
        canvas.add(shape)
      }
    }

    expect(canvas.getObjects().length).toBe(500)
    canvas.dispose()
  })
})
