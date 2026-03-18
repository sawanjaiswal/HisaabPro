import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; status: number; constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s } },
}))

const mockGetPayments = vi.fn()
const mockDeletePayment = vi.fn()
vi.mock('../payment.service', () => ({
  getPayments: (...args: unknown[]) => mockGetPayments(...args),
  deletePayment: (...args: unknown[]) => mockDeletePayment(...args),
}))

import { usePayments } from '../usePayments'

const MOCK_RESPONSE = {
  payments: [{ id: '1', partyName: 'Party A', amount: 50000 }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

describe('usePayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPayments.mockResolvedValue(MOCK_RESPONSE)
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => usePayments())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches payments on mount', async () => {
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
    expect(mockGetPayments).toHaveBeenCalledTimes(1)
  })

  it('setFilter updates filter and resets page to 1', async () => {
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setFilter('type', 'PAYMENT_IN'))
    expect(result.current.filters.type).toBe('PAYMENT_IN')
    expect(result.current.filters.page).toBe(1)
  })

  it('setPage changes page number', async () => {
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setPage(4))
    expect(result.current.filters.page).toBe(4)
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetPayments.mock.calls.length

    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetPayments.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('handleDelete optimistically removes item from list', async () => {
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.handleDelete('1', 'PAY-001'))
    expect(result.current.data?.payments).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
    expect(mockToast.success).toHaveBeenCalledWith('PAY-001 deleted', expect.any(Object))
  })

  it('shows error toast on fetch failure', async () => {
    mockGetPayments.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => usePayments())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load payments')
  })
})
