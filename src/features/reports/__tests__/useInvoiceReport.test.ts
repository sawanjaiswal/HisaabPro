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
  data: { summary: { totalAmount: 5000 }, items: [{ id: '1' }], groups: undefined },
  meta: { hasMore: false, cursor: null },
}

const mockGetInvoiceReport = vi.fn().mockResolvedValue(mockResponse)
vi.mock('../report.service', () => ({
  getInvoiceReport: (...args: unknown[]) => mockGetInvoiceReport(...args),
}))
vi.mock('../report.utils', () => ({
  getDateRange: () => ({ from: '2026-03-01', to: '2026-03-19' }),
  getTodayISO: () => '2026-03-19',
}))

import { useInvoiceReport } from '../hooks/useInvoiceReport'

describe('useInvoiceReport', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetInvoiceReport.mockResolvedValue(mockResponse) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useInvoiceReport({ type: 'sale' }))
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount with correct type', async () => {
    const { result } = renderHook(() => useInvoiceReport({ type: 'purchase' }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockResponse)
    expect(mockGetInvoiceReport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'purchase' }),
      expect.any(AbortSignal),
    )
  })

  it('setFilter updates filters and re-fetches', async () => {
    const { result } = renderHook(() => useInvoiceReport({ type: 'sale' }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setFilter('groupBy', 'party'))
    await waitFor(() => expect(mockGetInvoiceReport).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'party' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useInvoiceReport({ type: 'sale' }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetInvoiceReport.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetInvoiceReport.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetInvoiceReport.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useInvoiceReport({ type: 'sale' }))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load invoice report')
  })
})
