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
  data: { transactions: [{ id: '1' }], summary: { totalIn: 100 } },
  meta: { hasMore: false, cursor: null },
}

const mockGetDayBook = vi.fn().mockResolvedValue(mockResponse)
vi.mock('../report.service', () => ({ getDayBook: (...args: unknown[]) => mockGetDayBook(...args) }))
vi.mock('../report.utils', () => ({
  getTodayISO: () => '2026-03-19',
  getPrevDate: (d: string) => d === '2026-03-19' ? '2026-03-18' : '2026-03-17',
  getNextDate: (d: string) => d === '2026-03-18' ? '2026-03-19' : null,
}))
vi.mock('../report.constants', () => ({ STATEMENT_PAGE_LIMIT: 50 }))

import { useDayBook } from '../hooks/useDayBook'

describe('useDayBook', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetDayBook.mockResolvedValue(mockResponse) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useDayBook())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount and transitions to success', async () => {
    const { result } = renderHook(() => useDayBook())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockResponse)
    expect(mockGetDayBook).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-03-19', limit: 50 }),
      expect.any(AbortSignal),
    )
  })

  it('setDate updates filter and re-fetches', async () => {
    const { result } = renderHook(() => useDayBook())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setDate('2026-03-15'))
    await waitFor(() => expect(mockGetDayBook).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-03-15' }),
      expect.any(AbortSignal),
    ))
  })

  it('setTypeFilter updates filter', async () => {
    const { result } = renderHook(() => useDayBook())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setTypeFilter('sale'))
    await waitFor(() => expect(mockGetDayBook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sale' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useDayBook())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetDayBook.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetDayBook.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetDayBook.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useDayBook())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load day book')
  })
})
