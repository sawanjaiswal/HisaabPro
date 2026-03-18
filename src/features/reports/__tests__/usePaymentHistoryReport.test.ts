import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockResponse = {
  data: { summary: { totalIn: 5000 }, items: [{ id: '1' }], groups: undefined },
  meta: { hasMore: false, cursor: null },
}

const mockGetPaymentHistory = vi.fn().mockResolvedValue(mockResponse)
vi.mock('../report.service', () => ({
  getPaymentHistory: (...args: unknown[]) => mockGetPaymentHistory(...args),
}))
vi.mock('../report.utils', () => ({
  getDateRange: () => ({ from: '2026-03-01', to: '2026-03-19' }),
  getTodayISO: () => '2026-03-19',
}))
vi.mock('../report.constants', () => ({ DEFAULT_PAGE_LIMIT: 20 }))

import { usePaymentHistoryReport } from '../hooks/usePaymentHistoryReport'

describe('usePaymentHistoryReport', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetPaymentHistory.mockResolvedValue(mockResponse) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => usePaymentHistoryReport())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount', async () => {
    const { result } = renderHook(() => usePaymentHistoryReport())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockResponse)
    expect(mockGetPaymentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'none', sortBy: 'date_desc' }),
      expect.any(AbortSignal),
    )
  })

  it('setFilter updates filters and re-fetches', async () => {
    const { result } = renderHook(() => usePaymentHistoryReport())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setFilter('direction', 'in'))
    await waitFor(() => expect(mockGetPaymentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'in' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => usePaymentHistoryReport())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetPaymentHistory.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetPaymentHistory.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetPaymentHistory.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => usePaymentHistoryReport())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load payment history')
  })
})
