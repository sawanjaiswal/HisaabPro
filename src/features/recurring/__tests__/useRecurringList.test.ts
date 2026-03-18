import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRecurringList } from '../hooks/useRecurringList'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListRecurring = vi.fn()
vi.mock('../../recurring/recurring.service', () => ({
  listRecurring: (...args: unknown[]) => mockListRecurring(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: 'r1', frequency: 'MONTHLY' }], total: 1 }

describe('useRecurringList', () => {
  it('starts in loading state with default filter ALL', () => {
    mockListRecurring.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useRecurringList())
    expect(result.current.status).toBe('loading')
    expect(result.current.statusFilter).toBe('ALL')
  })

  it('fetches recurring invoices on mount', async () => {
    mockListRecurring.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useRecurringList())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListRecurring.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useRecurringList())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load recurring invoices')
  })

  it('setStatusFilter resets page to 1', async () => {
    mockListRecurring.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useRecurringList())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.setPage(4) })
    act(() => { result.current.setStatusFilter('ACTIVE') })

    expect(result.current.statusFilter).toBe('ACTIVE')
    expect(result.current.page).toBe(1)
  })

  it('refresh triggers re-fetch', async () => {
    mockListRecurring.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useRecurringList())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListRecurring.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListRecurring).toHaveBeenCalledTimes(2)
  })
})
