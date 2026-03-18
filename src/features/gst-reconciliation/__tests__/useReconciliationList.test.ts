import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockList = vi.fn()
const mockDelete = vi.fn()
vi.mock('../reconciliation.service', () => ({
  listReconciliations: (...args: unknown[]) => mockList(...args),
  deleteReconciliation: (...args: unknown[]) => mockDelete(...args),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('../reconciliation.constants', () => ({ RECON_PAGE_LIMIT: 20 }))

import { useReconciliationList } from '../useReconciliationList'

const MOCK_RES = { data: [{ id: 'r-1', period: '2024-01' }], total: 1 }

describe('useReconciliationList', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useReconciliationList())
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
  })

  it('fetches list on mount', async () => {
    mockList.mockResolvedValue(MOCK_RES)
    const { result } = renderHook(() => useReconciliationList())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RES.data)
    expect(result.current.total).toBe(1)
  })

  it('shows error toast on failure', async () => {
    mockList.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useReconciliationList())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load reconciliations')
  })

  it('remove calls delete and refreshes', async () => {
    mockList.mockResolvedValue(MOCK_RES)
    mockDelete.mockResolvedValue(undefined)
    const { result } = renderHook(() => useReconciliationList())
    await waitFor(() => expect(result.current.status).toBe('success'))
    await act(async () => { await result.current.remove('r-1') })
    expect(mockDelete).toHaveBeenCalledWith('r-1')
    expect(mockToast.success).toHaveBeenCalledWith('Reconciliation deleted')
  })

  it('loadMore increments page', async () => {
    mockList.mockResolvedValue({ data: [{ id: 'r-1' }], total: 5 })
    const { result } = renderHook(() => useReconciliationList())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.loadMore() })
    expect(result.current.page).toBe(2)
  })
})
