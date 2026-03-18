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
  data: { transactions: [{ id: 't1' }], openingBalance: 0 },
  meta: { hasMore: false, cursor: null },
}

const mockGetPartyStatement = vi.fn().mockResolvedValue(mockResponse)
vi.mock('../report.service', () => ({
  getPartyStatement: (...args: unknown[]) => mockGetPartyStatement(...args),
}))
vi.mock('../report.constants', () => ({ STATEMENT_PAGE_LIMIT: 50 }))

import { usePartyStatement } from '../hooks/usePartyStatement'

describe('usePartyStatement', () => {
  const partyId = 'party-123'

  beforeEach(() => { vi.clearAllMocks(); mockGetPartyStatement.mockResolvedValue(mockResponse) })

  it('starts in loading status', () => {
    const { result } = renderHook(() => usePartyStatement(partyId))
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount with partyId', async () => {
    const { result } = renderHook(() => usePartyStatement(partyId))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockResponse)
    expect(mockGetPartyStatement).toHaveBeenCalledWith(
      partyId,
      expect.objectContaining({ limit: 50 }),
      expect.any(AbortSignal),
    )
  })

  it('does not fetch when partyId is empty', async () => {
    const { result } = renderHook(() => usePartyStatement(''))
    // Should remain loading since the effect returns early
    expect(result.current.status).toBe('loading')
    expect(mockGetPartyStatement).not.toHaveBeenCalled()
  })

  it('setFilter updates filters and re-fetches', async () => {
    const { result } = renderHook(() => usePartyStatement(partyId))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setFilter('from', '2026-01-01'))
    await waitFor(() => expect(mockGetPartyStatement).toHaveBeenCalledWith(
      partyId,
      expect.objectContaining({ from: '2026-01-01' }),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => usePartyStatement(partyId))
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetPartyStatement.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetPartyStatement.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetPartyStatement.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => usePartyStatement(partyId))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load party statement')
  })
})
