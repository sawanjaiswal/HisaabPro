import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetAccounts = vi.fn()
const mockSeedAccounts = vi.fn()
vi.mock('../accounting.service', () => ({
  getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
  seedDefaultAccounts: (...args: unknown[]) => mockSeedAccounts(...args),
}))
vi.mock('../accounting.utils', () => ({
  groupAccountsByType: (items: unknown[]) => new Map([['ASSET', items]]),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { useChartOfAccounts } from '../useChartOfAccounts'

const MOCK_RES = { items: [{ id: 'acc-1', name: 'Cash', type: 'ASSET' }], total: 1 }

describe('useChartOfAccounts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetAccounts.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useChartOfAccounts())
    expect(result.current.status).toBe('loading')
    expect(result.current.total).toBe(0)
  })

  it('fetches accounts on mount', async () => {
    mockGetAccounts.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useChartOfAccounts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.total).toBe(1)
    expect(result.current.grouped).toBeInstanceOf(Map)
    expect(mockGetAccounts).toHaveBeenCalledWith(1, 200, expect.any(AbortSignal))
  })

  it('shows error toast on failure', async () => {
    mockGetAccounts.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useChartOfAccounts())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load accounts')
  })

  it('handleSeed calls service and refreshes', async () => {
    mockGetAccounts.mockResolvedValue(MOCK_RES)
    mockSeedAccounts.mockResolvedValue(undefined)
    const { result } = renderHook(() => useChartOfAccounts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    await act(async () => { await result.current.handleSeed() })
    expect(mockSeedAccounts).toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledWith('Default accounts created')
    expect(mockGetAccounts).toHaveBeenCalledTimes(2)
  })

  it('refresh triggers re-fetch', async () => {
    mockGetAccounts.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useChartOfAccounts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.refresh() })
    await waitFor(() => expect(mockGetAccounts).toHaveBeenCalledTimes(2))
  })
})
