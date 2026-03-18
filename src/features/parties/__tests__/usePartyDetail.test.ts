import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetParty = vi.fn()
vi.mock('../party.service', () => ({ getParty: (...args: unknown[]) => mockGetParty(...args) }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { usePartyDetail } from '../usePartyDetail'

const MOCK_PARTY = { id: 'p-1', name: 'Test Party', phone: '9876543210' }

describe('usePartyDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetParty.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => usePartyDetail('p-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.party).toBeNull()
  })

  it('fetches party on mount and sets success', async () => {
    mockGetParty.mockResolvedValue(MOCK_PARTY)
    const { result } = renderHook(() => usePartyDetail('p-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.party).toEqual(MOCK_PARTY)
    expect(mockGetParty).toHaveBeenCalledWith('p-1', expect.any(AbortSignal))
  })

  it('shows error toast on failure', async () => {
    mockGetParty.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => usePartyDetail('p-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load party')
  })

  it('defaults activeTab to overview', () => {
    mockGetParty.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => usePartyDetail('p-1'))
    expect(result.current.activeTab).toBe('overview')
  })

  it('refresh triggers re-fetch', async () => {
    mockGetParty.mockResolvedValue(MOCK_PARTY)
    const { result } = renderHook(() => usePartyDetail('p-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockGetParty).toHaveBeenCalledTimes(2))
  })
})
