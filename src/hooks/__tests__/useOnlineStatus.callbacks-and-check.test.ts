import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { mockFetch, getHook } from './useOnlineStatus.helpers'

// ---------------------------------------------------------------------------
// useOnlineStatusWithCallbacks
// ---------------------------------------------------------------------------
describe('useOnlineStatusWithCallbacks', () => {
  it('calls onOnline when transitioning from offline to online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    mockFetch.mockRejectedValue(new Error('network error'))

    const { useOnlineStatusWithCallbacks } = await getHook()

    const onOnline = vi.fn()
    const onOffline = vi.fn()

    renderHook(() =>
      useOnlineStatusWithCallbacks({ onOnline, onOffline }),
    )

    await act(async () => { await Promise.resolve() })

    // Come back online
    mockFetch.mockResolvedValue({ ok: true })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onOnline).toHaveBeenCalledTimes(1)
    expect(onOffline).not.toHaveBeenCalled()
  })

  it('calls onOffline when transitioning from online to offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    mockFetch.mockResolvedValueOnce({ ok: true }).mockRejectedValue(new Error('offline'))

    const { useOnlineStatusWithCallbacks } = await getHook()

    const onOnline = vi.fn()
    const onOffline = vi.fn()

    renderHook(() =>
      useOnlineStatusWithCallbacks({ onOnline, onOffline }),
    )

    await act(async () => { await Promise.resolve() })

    await act(async () => {
      window.dispatchEvent(new Event('offline'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onOffline).toHaveBeenCalledTimes(1)
    expect(onOnline).not.toHaveBeenCalled()
  })

  it('returns isOnline reflecting current status', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { useOnlineStatusWithCallbacks } = await getHook()
    const { result } = renderHook(() => useOnlineStatusWithCallbacks())

    await act(async () => { await Promise.resolve() })

    expect(result.current.isOnline).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkOnlineNow (exported pure-async utility)
// ---------------------------------------------------------------------------
describe('checkOnlineNow', () => {
  it('returns true when the health endpoint responds with ok', async () => {
    mockFetch.mockResolvedValue({ ok: true })

    const { checkOnlineNow } = await getHook()

    const result = await act(async () => checkOnlineNow())
    expect(result).toBe(true)
  })

  it('returns false when the health endpoint returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { checkOnlineNow } = await getHook()

    // Need 2 consecutive failures to flip global state — check the raw return value
    const result1 = await act(async () => checkOnlineNow())
    expect(result1).toBe(false)
  })

  it('returns false when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    const { checkOnlineNow } = await getHook()

    const result = await act(async () => checkOnlineNow())
    expect(result).toBe(false)
  })
})
