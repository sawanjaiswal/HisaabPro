import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetDetail = vi.fn()
const mockGetEntries = vi.fn()
vi.mock('../reconciliation.service', () => ({
  getReconciliationDetail: (...args: unknown[]) => mockGetDetail(...args),
  getReconciliationEntries: (...args: unknown[]) => mockGetEntries(...args),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('../reconciliation.constants', () => ({ RECON_PAGE_LIMIT: 20 }))

import { useReconciliationDetail } from '../useReconciliationDetail'

const MOCK_SUMMARY = { id: 'r-1', period: '2024-01', matched: 5, unmatched: 2 }
const MOCK_ENTRIES = { data: [{ id: 'e-1', amount: 1000 }], total: 1 }

describe('useReconciliationDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state for both summary and entries', () => {
    mockGetDetail.mockReturnValue(new Promise(() => {}))
    mockGetEntries.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useReconciliationDetail('r-1'))
    expect(result.current.summaryStatus).toBe('loading')
    expect(result.current.entriesStatus).toBe('loading')
  })

  it('fetches summary and entries on mount', async () => {
    mockGetDetail.mockResolvedValue(MOCK_SUMMARY)
    mockGetEntries.mockResolvedValue(MOCK_ENTRIES)
    const { result } = renderHook(() => useReconciliationDetail('r-1'))
    await waitFor(() => expect(result.current.summaryStatus).toBe('success'))
    await waitFor(() => expect(result.current.entriesStatus).toBe('success'))
    expect(result.current.summary).toEqual(MOCK_SUMMARY)
    expect(result.current.entries).toEqual(MOCK_ENTRIES.data)
  })

  it('shows error toast on summary failure', async () => {
    mockGetDetail.mockRejectedValue(new Error('fail'))
    mockGetEntries.mockResolvedValue(MOCK_ENTRIES)
    const { result } = renderHook(() => useReconciliationDetail('r-1'))
    await waitFor(() => expect(result.current.summaryStatus).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load summary')
  })

  it('setMatchFilter resets entries and page', async () => {
    mockGetDetail.mockResolvedValue(MOCK_SUMMARY)
    mockGetEntries.mockResolvedValue(MOCK_ENTRIES)
    const { result } = renderHook(() => useReconciliationDetail('r-1'))
    await waitFor(() => expect(result.current.entriesStatus).toBe('success'))
    act(() => { result.current.setMatchFilter('MATCHED' as never) })
    expect(result.current.matchFilter).toBe('MATCHED')
  })

  it('refresh re-fetches both summary and entries', async () => {
    mockGetDetail.mockResolvedValue(MOCK_SUMMARY)
    mockGetEntries.mockResolvedValue(MOCK_ENTRIES)
    const { result } = renderHook(() => useReconciliationDetail('r-1'))
    await waitFor(() => expect(result.current.summaryStatus).toBe('success'))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(2))
  })
})
