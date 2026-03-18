import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetEntries = vi.fn()
vi.mock('../accounting.service', () => ({
  getJournalEntries: (...args: unknown[]) => mockGetEntries(...args),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('../accounting.constants', () => ({ ACCOUNTING_PAGE_LIMIT: 20 }))

import { useJournalEntries } from '../useJournalEntries'

const MOCK_RES = { items: [{ id: 'je-1', amount: 5000, type: 'DEBIT' }], total: 1 }

describe('useJournalEntries', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetEntries.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useJournalEntries())
    expect(result.current.status).toBe('loading')
    expect(result.current.entries).toEqual([])
  })

  it('fetches entries on mount', async () => {
    mockGetEntries.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.entries).toEqual(MOCK_RES.items)
    expect(result.current.total).toBe(1)
  })

  it('shows error toast on failure', async () => {
    mockGetEntries.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load entries')
  })

  it('setTypeFilter resets page to 1', async () => {
    mockGetEntries.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setTypeFilter('SALES' as never) })
    expect(result.current.filters.page).toBe(1)
    await waitFor(() => expect(mockGetEntries).toHaveBeenCalledTimes(2))
  })

  it('setStatusFilter resets page to 1', async () => {
    mockGetEntries.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setStatusFilter('POSTED' as never) })
    expect(result.current.filters.page).toBe(1)
  })

  it('loadMore increments page', async () => {
    mockGetEntries.mockResolvedValue({ items: [{ id: 'je-1' }], total: 50 })
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.loadMore() })
    expect(result.current.filters.page).toBe(2)
  })

  it('refresh resets page and re-fetches', async () => {
    mockGetEntries.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useJournalEntries())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(mockGetEntries).toHaveBeenCalledTimes(2))
  })
})
