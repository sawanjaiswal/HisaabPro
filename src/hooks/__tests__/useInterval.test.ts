import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInterval } from '../useInterval'

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the callback at the specified interval', () => {
    const callback = vi.fn()
    renderHook(() => useInterval(callback, 1000))

    expect(callback).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1000) })
    expect(callback).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(callback).toHaveBeenCalledTimes(2)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('does not call the callback before the interval elapses', () => {
    const callback = vi.fn()
    renderHook(() => useInterval(callback, 1000))

    act(() => { vi.advanceTimersByTime(999) })

    expect(callback).not.toHaveBeenCalled()
  })

  it('pauses when delay is null', () => {
    const callback = vi.fn()
    renderHook(() => useInterval(callback, null))

    act(() => { vi.advanceTimersByTime(10_000) })

    expect(callback).not.toHaveBeenCalled()
  })

  it('stops calling callback when delay changes from a number to null', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(callback, delay),
      { initialProps: { delay: 500 as number | null } },
    )

    act(() => { vi.advanceTimersByTime(500) })
    expect(callback).toHaveBeenCalledTimes(1)

    rerender({ delay: null })

    // After setting delay to null, no further calls
    act(() => { vi.advanceTimersByTime(5000) })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('resumes calling callback when delay changes from null to a number', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(callback, delay),
      { initialProps: { delay: null as number | null } },
    )

    act(() => { vi.advanceTimersByTime(5000) })
    expect(callback).not.toHaveBeenCalled()

    rerender({ delay: 1000 })

    act(() => { vi.advanceTimersByTime(1000) })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('calls the latest callback without resetting the interval when callback changes', () => {
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useInterval(cb, 1000),
      { initialProps: { cb: firstCallback } },
    )

    // Advance partway through an interval, then swap the callback
    act(() => { vi.advanceTimersByTime(600) })
    rerender({ cb: secondCallback })

    // Complete the interval — should fire the NEW callback, not reset the timer
    act(() => { vi.advanceTimersByTime(400) })

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledTimes(1)
  })

  it('cleans up the interval on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useInterval(callback, 500))

    act(() => { vi.advanceTimersByTime(500) })
    expect(callback).toHaveBeenCalledTimes(1)

    unmount()

    // After unmount no more calls
    act(() => { vi.advanceTimersByTime(5000) })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('respects interval change — resets to new timing', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(callback, delay),
      { initialProps: { delay: 1000 as number | null } },
    )

    act(() => { vi.advanceTimersByTime(1000) })
    expect(callback).toHaveBeenCalledTimes(1)

    rerender({ delay: 500 })

    act(() => { vi.advanceTimersByTime(500) })
    expect(callback).toHaveBeenCalledTimes(2)

    act(() => { vi.advanceTimersByTime(500) })
    expect(callback).toHaveBeenCalledTimes(3)
  })
})
