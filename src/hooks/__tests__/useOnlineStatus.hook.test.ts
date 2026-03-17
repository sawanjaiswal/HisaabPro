import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { mockFetch, getHook } from './useOnlineStatus.helpers'

// ---------------------------------------------------------------------------
// useOnlineStatus — core hook behavior
// ---------------------------------------------------------------------------
describe('useOnlineStatus', () => {
  it('returns true when navigator.onLine is true at mount time', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { useOnlineStatus } = await getHook()
    const { result } = renderHook(() => useOnlineStatus())

    // Allow the initial heartbeat microtask to settle
    await act(async () => { await Promise.resolve() })

    expect(result.current).toBe(true)
  })

  it('returns false when navigator.onLine is false at mount time', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    // Heartbeat also fails — confirms offline
    mockFetch.mockRejectedValue(new Error('network error'))

    const { useOnlineStatus } = await getHook()
    const { result } = renderHook(() => useOnlineStatus())

    await act(async () => { await Promise.resolve() })

    expect(result.current).toBe(false)
  })

  it('transitions to online when the "online" browser event fires', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    mockFetch.mockRejectedValue(new Error('network error'))

    const { useOnlineStatus } = await getHook()
    const { result } = renderHook(() => useOnlineStatus())

    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe(false)

    // Simulate browser online event + successful heartbeat.
    // The online handler triggers runHeartbeat -> async fetch -> setGlobalOnline.
    // We flush the microtask/promise chain with repeated yields (no timer advance
    // needed — the state update lives purely in the microtask queue).
    mockFetch.mockResolvedValue({ ok: true })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      // Yield enough times to let the fetch promise chain settle
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current).toBe(true)
  })

  it('transitions to offline after consecutive heartbeat failures', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    // First heartbeat succeeds (initial), then all fail
    mockFetch.mockResolvedValueOnce({ ok: true }).mockRejectedValue(new Error('offline'))

    const { useOnlineStatus } = await getHook()
    const { result } = renderHook(() => useOnlineStatus())

    // Settle the initial heartbeat
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe(true)

    // Trigger offline browser event.
    // The offline handler calls setGlobalOnline(false) synchronously before
    // scheduling the next heartbeat, so a single flush is sufficient.
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current).toBe(false)
  })

  it('cleans up listeners when the last instance unmounts', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { useOnlineStatus } = await getHook()
    const { unmount } = renderHook(() => useOnlineStatus())

    await act(async () => { await Promise.resolve() })

    unmount()

    // The heartbeat event listeners should have been removed
    expect(removeEventListenerSpy).toHaveBeenCalled()
  })

  it('does not start a second heartbeat for multiple hook instances', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { useOnlineStatus } = await getHook()

    // Mount two instances
    const hook1 = renderHook(() => useOnlineStatus())
    const hook2 = renderHook(() => useOnlineStatus())

    await act(async () => { await Promise.resolve() })

    // Initial heartbeat called once, not twice
    expect(mockFetch).toHaveBeenCalledTimes(1)

    hook1.unmount()
    hook2.unmount()
  })

  it('restarts heartbeat when a new instance mounts after all were unmounted', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { useOnlineStatus } = await getHook()

    const hook1 = renderHook(() => useOnlineStatus())
    await act(async () => { await Promise.resolve() })
    const callsAfterFirst = mockFetch.mock.calls.length

    hook1.unmount()

    // Mount a second instance — heartbeat should restart
    const hook2 = renderHook(() => useOnlineStatus())
    await act(async () => { await Promise.resolve() })

    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst)

    hook2.unmount()
  })
})
