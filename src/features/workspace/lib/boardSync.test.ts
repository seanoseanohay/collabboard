/**
 * Tests for boardSync: getObjectId, setObjectId, and throttle behavior.
 */

import { Rect } from 'fabric'
import { getObjectId, setObjectId } from './boardSync'

describe('boardSync', () => {
  describe('getObjectId / setObjectId', () => {
    it('returns null when object has no id in data', () => {
      const rect = new Rect({ width: 10, height: 10 })
      expect(getObjectId(rect)).toBeNull()
    })

    it('returns id when set via setObjectId', () => {
      const rect = new Rect({ width: 10, height: 10 })
      setObjectId(rect, 'obj-123')
      expect(getObjectId(rect)).toBe('obj-123')
    })

    it('preserves other data when setting id', () => {
      const rect = new Rect({ width: 10, height: 10 })
      rect.set('data', { foo: 'bar' })
      setObjectId(rect, 'obj-456')
      const data = rect.get('data') as { id?: string; foo?: string }
      expect(data.id).toBe('obj-456')
      expect(data.foo).toBe('bar')
    })
  })
})
