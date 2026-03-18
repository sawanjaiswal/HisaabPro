import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetOutstanding = vi.fn()
vi.mock('../payment.service', () => ({ getOutstanding: (...args: unknown[]) => mockGetOutstanding(...args) }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('@/config/app.config', () => ({ TIMEOUTS: { debounceMs: 0 } }))
vi.mock('../payment.constants', () => ({
  DEFAULT_OUTSTANDING_FILTERS: { search: '', type: 'ALL', sortBy: 'amount', page: 1, limit: 20 },
}))

import { useOutstanding } from '../useOutstanding'

const MOCK_RESPONSE = { items: [{ id: 'o-1', amount: 5000 }], total: 1, page: 1, limit: 20 }

describe('useOutstanding', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetOutstanding.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useOutstanding())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches outstanding list on mount', async () => {
    mockGetOutstanding.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOutstanding())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
  })

  it('shows error toast on failure', async () => {
    mockGetOutstanding.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useOutstanding())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load outstanding')
  })

  it('setFilter updates filters and resets page', async () => {
    mockGetOutstanding.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOutstanding())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setFilter('type', 'RECEIVABLE' as never) })
    await waitFor(() => expect(mockGetOutstanding).toHaveBeenCalledTimes(2))
    expect(result.current.filters.page).toBe(1)
  })

  it('refresh triggers re-fetch', async () => {
    mockGetOutstanding.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOutstanding())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(mockGetOutstanding).toHaveBeenCalledTimes(2))
  })
})
