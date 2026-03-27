import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { useGstSettings } from '../useGstSettings'

const MOCK_SETTINGS = { gstin: '29ABCDE1234F1Z5', stateCode: '29', compositionScheme: false, eInvoiceEnabled: true, eWayBillEnabled: false }

describe('useGstSettings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state with empty settings', () => {
    mockApi.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useGstSettings('biz-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.settings.gstin).toBeNull()
  })

  it('fetches settings on mount', async () => {
    mockApi.mockResolvedValue(MOCK_SETTINGS)
    const { result } = renderHook(() => useGstSettings('biz-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.settings).toEqual(MOCK_SETTINGS)
    expect(mockApi).toHaveBeenCalledWith('/businesses/biz-1/gst-settings', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('shows error toast on fetch failure', async () => {
    mockApi.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useGstSettings('biz-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load GST settings')
  })

  it('skips fetch for empty businessId', () => {
    renderHook(() => useGstSettings(''))
    expect(mockApi).not.toHaveBeenCalled()
  })

  it('updateGst calls PUT and shows success toast', async () => {
    mockApi.mockResolvedValueOnce(MOCK_SETTINGS) // initial fetch
    const { result } = renderHook(() => useGstSettings('biz-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))

    const updated = { ...MOCK_SETTINGS, eWayBillEnabled: true }
    mockApi.mockResolvedValueOnce(updated)
    await act(async () => { await result.current.updateGst({ eWayBillEnabled: true }) })
    expect(mockApi).toHaveBeenCalledWith('/businesses/biz-1/gst-settings', expect.objectContaining({ method: 'PUT' }))
    expect(mockToast.success).toHaveBeenCalledWith('GST settings updated')
  })

  it('refresh triggers re-fetch', async () => {
    mockApi.mockResolvedValue(MOCK_SETTINGS)
    const { result } = renderHook(() => useGstSettings('biz-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
  })
})
