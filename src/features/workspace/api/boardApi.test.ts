/**
 * Tests for boardApi — named convenience wrappers.
 *
 * Strategy: mock aiClientApi and documentsApi (both hit Supabase); exercise every
 * public function and assert the correct lower-level calls are made.
 */

import {
  createStickyNote,
  createShape,
  createFrame,
  createConnector,
  moveObject,
  resizeObject,
  updateText,
  changeColor,
  getBoardState,
} from './boardApi'

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock('./aiClientApi', () => ({
  createObject: jest.fn(),
  updateObject: jest.fn(),
  queryObjects: jest.fn(),
}))

jest.mock('./documentsApi', () => ({
  writeDocument: jest.fn(),
  getDocumentsByIds: jest.fn(),
}))

import { createObject, updateObject, queryObjects } from './aiClientApi'
import { writeDocument, getDocumentsByIds } from './documentsApi'

const mockCreateObject = createObject as jest.MockedFunction<typeof createObject>
const mockUpdateObject = updateObject as jest.MockedFunction<typeof updateObject>
const mockQueryObjects = queryObjects as jest.MockedFunction<typeof queryObjects>
const mockWriteDocument = writeDocument as jest.MockedFunction<typeof writeDocument>
const mockGetDocumentsByIds = getDocumentsByIds as jest.MockedFunction<typeof getDocumentsByIds>

const BOARD_ID = 'board-test-001'

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateObject.mockResolvedValue('returned-object-id')
  mockUpdateObject.mockResolvedValue(undefined)
  mockWriteDocument.mockResolvedValue(undefined)
})

// ─── createStickyNote ─────────────────────────────────────────────────────────

describe('createStickyNote', () => {
  it('calls createObject with type sticky and provided args', async () => {
    await createStickyNote(BOARD_ID, 'Hello', 100, 200, '#fef08a')

    expect(mockCreateObject).toHaveBeenCalledWith(BOARD_ID, 'sticky', {
      left: 100,
      top: 200,
      fill: '#fef08a',
      text: 'Hello',
    })
  })

  it('returns the objectId from createObject', async () => {
    const id = await createStickyNote(BOARD_ID, 'Test', 0, 0)
    expect(id).toBe('returned-object-id')
  })

  it('uses yellow as default color', async () => {
    await createStickyNote(BOARD_ID, 'Note', 50, 60)
    const call = mockCreateObject.mock.calls[0]
    expect(call[2].fill).toBe('#fef08a')
  })
})

// ─── createShape ──────────────────────────────────────────────────────────────

describe('createShape', () => {
  it('calls createObject with correct type and dimensions', async () => {
    await createShape(BOARD_ID, 'rect', 10, 20, 300, 150, '#3b82f6')

    expect(mockCreateObject).toHaveBeenCalledWith(BOARD_ID, 'rect', {
      left: 10,
      top: 20,
      width: 300,
      height: 150,
      fill: '#3b82f6',
    })
  })

  it('returns the objectId', async () => {
    const id = await createShape(BOARD_ID, 'circle', 0, 0, 100, 100)
    expect(id).toBe('returned-object-id')
  })

  it('uses white as default color', async () => {
    await createShape(BOARD_ID, 'triangle', 0, 0, 80, 80)
    expect(mockCreateObject.mock.calls[0][2].fill).toBe('#ffffff')
  })

  it.each(['rect', 'circle', 'triangle', 'line', 'text'] as const)(
    'accepts type %s',
    async (type) => {
      await createShape(BOARD_ID, type, 0, 0, 100, 100)
      expect(mockCreateObject).toHaveBeenCalledWith(BOARD_ID, type, expect.any(Object))
    }
  )
})

// ─── createFrame ──────────────────────────────────────────────────────────────

describe('createFrame', () => {
  it('writes a document to Supabase and returns a UUID', async () => {
    const id = await createFrame(BOARD_ID, 'Sprint 1', 0, 0, 800, 600)

    expect(mockWriteDocument).toHaveBeenCalledTimes(1)
    const [boardId, objectId, payload] = mockWriteDocument.mock.calls[0]
    expect(boardId).toBe(BOARD_ID)
    expect(typeof objectId).toBe('string')
    expect(objectId).toHaveLength(36) // UUID
    expect(id).toBe(objectId)

    // frame shape data
    expect(payload).not.toHaveProperty('data') // stripped by boardApi
    expect(payload.zIndex).toBe(1) // always behind children
  })

  it('embeds the title in the serialized payload', async () => {
    await createFrame(BOARD_ID, 'My Frame', 50, 80, 400, 300)

    const payload = mockWriteDocument.mock.calls[0][2]
    // Frames are Fabric Groups; title IText is a child object
    const raw = JSON.stringify(payload)
    expect(raw).toContain('My Frame')
  })
})

// ─── createConnector ──────────────────────────────────────────────────────────

describe('createConnector', () => {
  const SRC_ID = 'src-obj'
  const TGT_ID = 'tgt-obj'

  beforeEach(() => {
    mockGetDocumentsByIds.mockResolvedValue([
      { objectId: SRC_ID, data: { left: 100, top: 100, width: 100, height: 80 } },
      { objectId: TGT_ID, data: { left: 300, top: 300, width: 100, height: 80 } },
    ])
  })

  it('fetches both objects from the board', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID)
    expect(mockGetDocumentsByIds).toHaveBeenCalledWith(BOARD_ID, [SRC_ID, TGT_ID])
  })

  it('writes a polyline connector document', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID)

    expect(mockWriteDocument).toHaveBeenCalledTimes(1)
    const [boardId, , payload] = mockWriteDocument.mock.calls[0]
    expect(boardId).toBe(BOARD_ID)
    expect(payload.type).toBe('polyline')
  })

  it('returns a new UUID', async () => {
    const id = await createConnector(BOARD_ID, SRC_ID, TGT_ID)
    expect(typeof id).toBe('string')
    expect(id).toHaveLength(36)
  })

  it('stores sourceObjectId and targetObjectId in connector data', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID)

    const payload = mockWriteDocument.mock.calls[0][2]
    const connData = payload.data as Record<string, unknown>
    expect(connData.subtype).toBe('connector')
    expect(connData.sourceObjectId).toBe(SRC_ID)
    expect(connData.targetObjectId).toBe(TGT_ID)
  })

  it('uses default arrow mode end and solid stroke', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID)

    const connData = mockWriteDocument.mock.calls[0][2].data as Record<string, unknown>
    expect(connData.arrowMode).toBe('end')
    expect(connData.strokeDash).toBe('solid')
  })

  it('respects custom style options', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID, {
      arrowMode: 'both',
      strokeDash: 'dashed',
      sourcePort: 'mr',
      targetPort: 'ml',
    })

    const connData = mockWriteDocument.mock.calls[0][2].data as Record<string, unknown>
    expect(connData.arrowMode).toBe('both')
    expect(connData.strokeDash).toBe('dashed')
    expect(connData.sourcePort).toBe('mr')
    expect(connData.targetPort).toBe('ml')
  })

  it('computes endpoints from object centers', async () => {
    await createConnector(BOARD_ID, SRC_ID, TGT_ID)

    const payload = mockWriteDocument.mock.calls[0][2]
    const points = payload.points as { x: number; y: number }[]

    // source center: left 100 + width 100 / 2 = 150, top 100 + height 80 / 2 = 140
    expect(points[0]).toEqual({ x: 150, y: 140 })
    // target center: left 300 + 50 = 350, top 300 + 40 = 340
    expect(points[1]).toEqual({ x: 350, y: 340 })
  })

  it('falls back to (0,0) when a source document is missing', async () => {
    mockGetDocumentsByIds.mockResolvedValue([
      { objectId: TGT_ID, data: { left: 300, top: 300, width: 100, height: 80 } },
    ])

    await createConnector(BOARD_ID, SRC_ID, TGT_ID)

    const points = mockWriteDocument.mock.calls[0][2].points as { x: number; y: number }[]
    expect(points[0]).toEqual({ x: 0, y: 0 })
  })
})

// ─── moveObject ───────────────────────────────────────────────────────────────

describe('moveObject', () => {
  it('calls updateObject with left and top', async () => {
    await moveObject(BOARD_ID, 'obj-1', 400, 250)
    expect(mockUpdateObject).toHaveBeenCalledWith(BOARD_ID, 'obj-1', { left: 400, top: 250 })
  })
})

// ─── resizeObject ─────────────────────────────────────────────────────────────

describe('resizeObject', () => {
  it('calls updateObject with width and height', async () => {
    await resizeObject(BOARD_ID, 'obj-2', 500, 200)
    expect(mockUpdateObject).toHaveBeenCalledWith(BOARD_ID, 'obj-2', { width: 500, height: 200 })
  })
})

// ─── updateText ───────────────────────────────────────────────────────────────

describe('updateText', () => {
  it('calls updateObject with the new text', async () => {
    await updateText(BOARD_ID, 'obj-3', 'New label')
    expect(mockUpdateObject).toHaveBeenCalledWith(BOARD_ID, 'obj-3', { text: 'New label' })
  })
})

// ─── changeColor ──────────────────────────────────────────────────────────────

describe('changeColor', () => {
  it('calls updateObject with fill color', async () => {
    await changeColor(BOARD_ID, 'obj-4', '#ef4444')
    expect(mockUpdateObject).toHaveBeenCalledWith(BOARD_ID, 'obj-4', { fill: '#ef4444' })
  })
})

// ─── getBoardState ────────────────────────────────────────────────────────────

describe('getBoardState', () => {
  const MOCK_DOCS = [
    {
      objectId: 'a1',
      data: { type: 'rect', left: 10, top: 20, width: 100, height: 80, fill: '#fff', text: null },
    },
    {
      objectId: 'b2',
      data: { type: 'sticky', left: 200, top: 300, width: 120, height: 100, fill: '#fef08a', text: 'Hi' },
    },
  ]

  beforeEach(() => {
    mockQueryObjects.mockResolvedValue(MOCK_DOCS)
  })

  it('calls queryObjects for the board', async () => {
    await getBoardState(BOARD_ID)
    expect(mockQueryObjects).toHaveBeenCalledWith(BOARD_ID)
  })

  it('returns one BoardObject per document', async () => {
    const result = await getBoardState(BOARD_ID)
    expect(result).toHaveLength(2)
  })

  it('maps standard fields correctly', async () => {
    const [rect] = await getBoardState(BOARD_ID)
    expect(rect.objectId).toBe('a1')
    expect(rect.type).toBe('rect')
    expect(rect.left).toBe(10)
    expect(rect.top).toBe(20)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(80)
    expect(rect.fill).toBe('#fff')
    expect(rect.text).toBeNull()
  })

  it('preserves the raw data field for full context', async () => {
    const [rect] = await getBoardState(BOARD_ID)
    expect(rect.data).toEqual(MOCK_DOCS[0].data)
  })

  it('defaults numeric fields to 0 when missing from document', async () => {
    mockQueryObjects.mockResolvedValue([
      { objectId: 'x', data: { type: 'rect' } },
    ])
    const [obj] = await getBoardState(BOARD_ID)
    expect(obj.left).toBe(0)
    expect(obj.top).toBe(0)
    expect(obj.width).toBe(0)
    expect(obj.height).toBe(0)
  })

  it('returns unknown as type when type field is missing', async () => {
    mockQueryObjects.mockResolvedValue([
      { objectId: 'x', data: {} },
    ])
    const [obj] = await getBoardState(BOARD_ID)
    expect(obj.type).toBe('unknown')
  })

  it('returns empty array when board has no objects', async () => {
    mockQueryObjects.mockResolvedValue([])
    const result = await getBoardState(BOARD_ID)
    expect(result).toEqual([])
  })
})
