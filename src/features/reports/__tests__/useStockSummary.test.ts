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
  data: { summary: { totalItems: 10 }, items: [{ id: '1', name: 'Widget' }] },
  meta: { hasMore: false, cursor: null },
}

const mockGetStockSummary = vi.fn().mockResolvedValue(mockResponse)
vi.mock('../report.service', () => ({
  getStockSummary: (...args: unknown[]) => mockGetStockSummary(...args),
}))
vi.mock('../report.constants', () => ({ DEFAULT_PAGE_LIMIT: 20 }))
vi.mock('@/config/app.config', () => ({ TIMEOUTS: { debounceMs: 0 } }))

import { useStockSummary } from '../hooks/useStockSummary'

describe('useStockSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetStockSummary.mockResolvedValue(mockResponse) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useStockSummary())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount', async () => {
    const { result } = renderHook(() => useStockSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockResponse)
    expect(mockGetStockSummary).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name_asc', limit: 20 }),
      expect.any(AbortSignal),
    )
  })

  it('setFilter updates filters and re-fetches', async () => {
    const { result } = renderHook(() => useStockSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setFilter('sortBy', 'value_desc'))
    await waitFor(() => expect(mockGetStockSummary).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'value_desc' }),
      expect.any(AbortSignal),
    ))
  })

  it('setSearch triggers debounced re-fetch', async () => {
    const { result } = renderHook(() => useStockSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setSearch('Widget'))
    await waitFor(() => expect(mockGetStockSummary).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Widget' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useStockSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetStockSummary.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetStockSummary.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetStockSummary.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useStockSummary())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load stock summary')
  })
})
