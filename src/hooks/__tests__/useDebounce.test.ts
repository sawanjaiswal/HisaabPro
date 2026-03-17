import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

// TIMEOUTS.debounceMs = 300 — same as the default used by the hook
const DEFAULT_DELAY = 300

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately without waiting', () => {
    const { result } = renderHook(() => useDebounce('hello', DEFAULT_DELAY))
    expect(result.current).toBe('hello')
  })

  it('still returns the old value before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 'first' } },
    )

    rerender({ value: 'second' })

    // Advance only partially — value should still be stale
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY - 1) })

    expect(result.current).toBe('first')
  })

  it('updates to the new value after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 'first' } },
    )

    rerender({ value: 'second' })

    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    expect(result.current).toBe('second')
  })

  it('resets the timer on rapid consecutive changes (only last value lands)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 'a' } },
    )

    // Rapid changes before delay expires
    rerender({ value: 'ab' })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'abc' })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'abcd' })

    // Intermediate values never committed
    expect(result.current).toBe('a')

    // Full delay from last change
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    expect(result.current).toBe('abcd')
  })

  it('does not update if value changes back to the initial before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 'original' } },
    )

    rerender({ value: 'changed' })
    act(() => { vi.advanceTimersByTime(100) })

    // Revert before delay fires
    rerender({ value: 'original' })
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    expect(result.current).toBe('original')
  })

  it('respects a custom delay when provided', () => {
    const customDelay = 1000
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, customDelay),
      { initialProps: { value: 'start' } },
    )

    rerender({ value: 'end' })

    // 300ms should not be enough
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })
    expect(result.current).toBe('start')

    // Full custom delay should commit the value
    act(() => { vi.advanceTimersByTime(customDelay - DEFAULT_DELAY) })
    expect(result.current).toBe('end')
  })

  it('works with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 0 } },
    )

    rerender({ value: 42 })
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    expect(result.current).toBe(42)
  })

  it('works with object values (reference equality after update)', () => {
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: obj1 } },
    )

    rerender({ value: obj2 })
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    expect(result.current).toBe(obj2)
  })

  it('cleans up the timer on unmount (no state update after unmount)', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, DEFAULT_DELAY),
      { initialProps: { value: 'initial' } },
    )

    rerender({ value: 'updated' })

    // Unmount before timer fires
    unmount()

    // Timer should be cleared — no error or state update
    act(() => { vi.advanceTimersByTime(DEFAULT_DELAY) })

    // Value stays as it was when unmounted (initial, since timer was cleared)
    expect(result.current).toBe('initial')
  })
})
