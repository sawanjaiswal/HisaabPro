/** Convert-to-bill — graceful 501/404 + idempotency-key reuse across retries. */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { apiMock, ApiError } = vi.hoisted(() => {
  class ApiErr extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  }
  return { apiMock: vi.fn(), ApiError: ApiErr }
})
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError,
}))

const toastInfo = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ info: toastInfo, success: toastSuccess, error: toastError }),
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: new Proxy({}, { get: (_t, k: string) => k }),
  }),
}))

import { useConvertAppointment } from '../hooks/useConvertAppointment'
import { createTestWrapper } from '@/test/query-wrapper'

const Wrapper = createTestWrapper()

beforeEach(() => {
  apiMock.mockReset()
  toastInfo.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('useConvertAppointment', () => {
  it('surfaces a "coming soon" toast on 501', async () => {
    apiMock.mockRejectedValueOnce(new ApiError('Not implemented', 'NOT_IMPLEMENTED', 501))
    const { result } = renderHook(() => useConvertAppointment(), { wrapper: Wrapper })
    await act(async () => {
      const res = await result.current.convert({
        appointmentId: 'a1',
        body: { target: 'job' },
        partyName: 'Raju',
        startAtISO: new Date().toISOString(),
      })
      expect(res).toBeNull()
    })
    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1))
    expect(toastInfo.mock.calls[0][0]).toContain('conversionComingSoon')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('surfaces a "coming soon" toast on 404 (route missing)', async () => {
    apiMock.mockRejectedValueOnce(new ApiError('Not Found', 'NOT_FOUND', 404))
    const { result } = renderHook(() => useConvertAppointment(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.convert({
        appointmentId: 'a1',
        body: { target: 'invoice' },
        partyName: 'Priya',
        startAtISO: new Date().toISOString(),
      })
    })
    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1))
  })

  it('reuses the same idempotency-key across retries', async () => {
    apiMock
      .mockRejectedValueOnce(new ApiError('Conflict', 'CONFLICT', 409))
      .mockResolvedValueOnce({ jobId: 'j1' })

    const { result } = renderHook(() => useConvertAppointment(), { wrapper: Wrapper })
    const firstKey = result.current.idempotencyKey()
    expect(firstKey).toBeTruthy()

    await act(async () => {
      await result.current.convert({
        appointmentId: 'a1',
        body: { target: 'job' },
        partyName: 'Raju',
        startAtISO: new Date().toISOString(),
      })
    })
    await act(async () => {
      await result.current.convert({
        appointmentId: 'a1',
        body: { target: 'job' },
        partyName: 'Raju',
        startAtISO: new Date().toISOString(),
      })
    })

    expect(apiMock).toHaveBeenCalledTimes(2)
    const headers1 = apiMock.mock.calls[0][1].headers
    const headers2 = apiMock.mock.calls[1][1].headers
    expect(headers1['X-Idempotency-Key']).toBe(firstKey)
    expect(headers2['X-Idempotency-Key']).toBe(firstKey)
  })

  it('nextKey() rotates the key for a fresh attempt', async () => {
    apiMock.mockResolvedValue({ jobId: 'j2' })
    const { result } = renderHook(() => useConvertAppointment(), { wrapper: Wrapper })
    const first = result.current.idempotencyKey()
    act(() => { result.current.nextKey() })
    const second = result.current.idempotencyKey()
    expect(second).not.toBe(first)
  })
})
