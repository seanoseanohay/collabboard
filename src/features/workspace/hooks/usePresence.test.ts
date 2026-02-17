/**
 * Tests for usePresence: debounce (50ms) and presence latency under throttle.
 */

import { renderHook, act } from '@testing-library/react'
import { usePresence } from './usePresence'

const writePresenceMock = jest.fn()

jest.mock('../api/presenceApi', () => ({
  writePresence: (...args: unknown[]) => writePresenceMock(...args),
  subscribeToPresence: (_boardId: string, onPresence: (entries: never[]) => void) => {
    onPresence([])
    return () => {}
  },
  setupPresenceDisconnect: () => () => {},
}))

beforeEach(() => {
  jest.useFakeTimers()
  writePresenceMock.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('usePresence', () => {
  it('debounces rapid updates to single write after 50ms', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        userId: 'user-1',
        userName: 'Alice',
      })
    )

    act(() => {
      result.current.updatePresence(10, 20)
      result.current.updatePresence(15, 25)
      result.current.updatePresence(20, 30)
    })

    expect(writePresenceMock).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(50)
    })

    expect(writePresenceMock).toHaveBeenCalledTimes(1)
    expect(writePresenceMock).toHaveBeenCalledWith(
      'board-1',
      'user-1',
      expect.objectContaining({ x: 20, y: 30, name: 'Alice' })
    )
  })

  it('writes only latest position after debounce period', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        userId: 'user-1',
        userName: 'Bob',
      })
    )

    act(() => {
      result.current.updatePresence(1, 1)
      result.current.updatePresence(2, 2)
      result.current.updatePresence(3, 3)
    })
    act(() => jest.advanceTimersByTime(50))

    expect(writePresenceMock).toHaveBeenCalledTimes(1)
    expect(writePresenceMock).toHaveBeenLastCalledWith(
      'board-1',
      'user-1',
      expect.objectContaining({ x: 3, y: 3 })
    )
  })

  it('resets debounce on each new batch of rapid updates', () => {
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        userId: 'user-1',
        userName: 'Charlie',
      })
    )

    act(() => {
      result.current.updatePresence(1, 1)
    })
    act(() => jest.advanceTimersByTime(30))
    act(() => {
      result.current.updatePresence(2, 2)
    })
    act(() => jest.advanceTimersByTime(30))

    expect(writePresenceMock).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(25))

    expect(writePresenceMock).toHaveBeenCalledTimes(1)
    expect(writePresenceMock).toHaveBeenLastCalledWith(
      'board-1',
      'user-1',
      expect.objectContaining({ x: 2, y: 2 })
    )
  })

  it('does not write when boardId or userId is empty', () => {
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
    act(() => jest.advanceTimersByTime(100))

    expect(writePresenceMock).not.toHaveBeenCalled()
  })
})
