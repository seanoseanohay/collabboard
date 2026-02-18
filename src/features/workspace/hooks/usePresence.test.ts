/**
 * Tests for usePresence: throttle (33ms) and Realtime Presence channel.
 */

import { renderHook, act } from '@testing-library/react'
import { usePresence } from './usePresence'

const trackMock = jest.fn()

jest.mock('../api/presenceApi', () => ({
  setupPresenceChannel: (
    _boardId: string,
    _userId: string,
    _initial: { name: string; color: string },
    onPresence: (entries: unknown[]) => void
  ) => {
    onPresence([])
    return {
      track: (payload: unknown) => trackMock(payload),
      unsubscribe: () => {},
    }
  },
}))

beforeEach(() => {
  jest.useFakeTimers()
  trackMock.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('usePresence', () => {
  it('throttles rapid updates: first sends immediately, then at 33ms intervals', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        userId: 'user-1',
        userName: 'Alice',
      })
    )

    act(() => {
      result.current.updatePresence(10, 20)
    })
    // First update sends immediately (lastSendRef was 0)
    expect(trackMock).toHaveBeenCalledTimes(1)
    expect(trackMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 10, y: 20, name: 'Alice' })
    )

    act(() => {
      result.current.updatePresence(15, 25)
      result.current.updatePresence(20, 30)
    })
    // Throttled — no immediate additional sends
    expect(trackMock).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(33)
    })
    // Throttle window passed — scheduled send fires with latest position
    expect(trackMock).toHaveBeenCalledTimes(2)
    expect(trackMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 20, y: 30 })
    )
  })

  it('sends latest position when throttle fires', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        userId: 'user-1',
        userName: 'Bob',
      })
    )

    act(() => {
      result.current.updatePresence(1, 1)
    })
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ x: 1, y: 1 }))

    act(() => {
      result.current.updatePresence(2, 2)
      result.current.updatePresence(3, 3)
    })
    act(() => jest.advanceTimersByTime(33))

    expect(trackMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 3, y: 3 })
    )
  })

  it('does not track when boardId or userId is empty', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: '',
        userId: 'user-1',
        userName: 'Test',
      })
    )

    act(() => {
      result.current.updatePresence(10, 10)
    })

    // Channel never set up (boardId empty), so track is never called
    expect(trackMock).not.toHaveBeenCalled()
  })
})
