import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOtherIncome } from '../useOtherIncome'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListOtherIncome = vi.fn()
vi.mock('../other-income.service', () => ({
  listOtherIncome: (...args: unknown[]) => mockListOtherIncome(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: 'oi1', amount: 10000 }], total: 1 }

describe('useOtherIncome', () => {
  it('starts in loading state', () => {
    mockListOtherIncome.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useOtherIncome())
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
  })

  it('fetches other income on mount', async () => {
    mockListOtherIncome.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOtherIncome())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListOtherIncome.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useOtherIncome())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load other income')
  })

  it('setCategoryFilter resets page to 1', async () => {
    mockListOtherIncome.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOtherIncome())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setPage(5) })
    act(() => { result.current.setCategoryFilter('rent') })

    expect(result.current.categoryFilter).toBe('rent')
    expect(result.current.page).toBe(1)
  })

  it('refresh triggers re-fetch', async () => {
    mockListOtherIncome.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useOtherIncome())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListOtherIncome.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListOtherIncome).toHaveBeenCalledTimes(2)
  })
})
