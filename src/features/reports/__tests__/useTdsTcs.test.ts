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

const mockSummary = { entries: [{ partyId: 'p1', tdsAmount: 1000 }], totals: { tds: 1000 } }

const mockGetTdsTcsSummary = vi.fn().mockResolvedValue(mockSummary)
vi.mock('../report.service', () => ({
  getTdsTcsSummary: (...args: unknown[]) => mockGetTdsTcsSummary(...args),
}))
vi.mock('../report.utils', () => ({
  getDateRange: () => ({ from: '2025-04-01', to: '2026-03-31' }),
}))

import { useTdsTcs } from '../hooks/useTdsTcs'

describe('useTdsTcs', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetTdsTcsSummary.mockResolvedValue(mockSummary) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useTdsTcs())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount with default filters', async () => {
    const { result } = renderHook(() => useTdsTcs())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockSummary)
    expect(mockGetTdsTcsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all', from: '2025-04-01' }),
      expect.any(AbortSignal),
    )
  })

  it('setFilters updates filters and re-fetches', async () => {
    const { result } = renderHook(() => useTdsTcs())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const newFilters = { from: '2025-04-01', to: '2026-03-31', type: 'tds' as const }
    act(() => result.current.setFilters(newFilters))
    await waitFor(() => expect(mockGetTdsTcsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tds' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useTdsTcs())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetTdsTcsSummary.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetTdsTcsSummary.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetTdsTcsSummary.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useTdsTcs())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load TDS/TCS report')
  })
})
