import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCheques } from '../useCheques'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListCheques = vi.fn()
vi.mock('../cheque.service', () => ({
  listCheques: (...args: unknown[]) => mockListCheques(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: 'c1', amount: 25000, status: 'PENDING' }], total: 1 }

describe('useCheques', () => {
  it('starts in loading state with default filter ALL', () => {
    mockListCheques.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCheques())
    expect(result.current.status).toBe('loading')
    expect(result.current.statusFilter).toBe('ALL')
  })

  it('fetches cheques on mount', async () => {
    mockListCheques.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useCheques())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListCheques.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useCheques())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load cheques')
  })

  it('setStatusFilter resets page to 1', async () => {
    mockListCheques.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useCheques())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setPage(3) })
    act(() => { result.current.setStatusFilter('CLEARED') })

    expect(result.current.statusFilter).toBe('CLEARED')
    expect(result.current.page).toBe(1)
  })

  it('refresh triggers re-fetch', async () => {
    mockListCheques.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useCheques())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListCheques.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListCheques).toHaveBeenCalledTimes(2)
  })
})
