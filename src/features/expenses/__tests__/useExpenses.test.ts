import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExpenses } from '../useExpenses'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListExpenses = vi.fn()
vi.mock('../expense.service', () => ({
  listExpenses: (...args: unknown[]) => mockListExpenses(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: '1', amount: 5000 }], total: 1 }

describe('useExpenses', () => {
  it('starts in loading state', () => {
    mockListExpenses.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useExpenses())
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
  })

  it('fetches expenses on mount', async () => {
    mockListExpenses.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListExpenses.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load expenses')
  })

  it('setCategoryFilter resets page to 1', async () => {
    mockListExpenses.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setPage(3) })
    act(() => { result.current.setCategoryFilter('food') })

    expect(result.current.categoryFilter).toBe('food')
    expect(result.current.page).toBe(1)
  })

  it('refresh triggers re-fetch', async () => {
    mockListExpenses.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useExpenses())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListExpenses.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListExpenses).toHaveBeenCalledTimes(2)
  })
})
