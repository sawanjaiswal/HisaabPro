import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '../useMediaQuery'

describe('useMediaQuery', () => {
  let listeners: Array<(e: { matches: boolean }) => void> = []
  let currentMatches = false

  beforeEach(() => {
    listeners = []
    currentMatches = false

    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: currentMatches,
      media: query,
      addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler)
      },
      removeEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== handler)
      },
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns initial match state', () => {
    currentMatches = true
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('returns false when query does not match', () => {
    currentMatches = false
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when media query changes', () => {
    currentMatches = false
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      listeners.forEach((l) => l({ matches: true }))
    })
    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(listeners).toHaveLength(1)
    unmount()
    expect(listeners).toHaveLength(0)
  })
})
