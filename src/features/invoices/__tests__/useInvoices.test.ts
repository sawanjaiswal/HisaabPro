import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; status: number; constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s } },
}))

const mockGetDocuments = vi.fn()
const mockDeleteDocument = vi.fn()
vi.mock('../invoice.service', () => ({
  getDocuments: (...args: unknown[]) => mockGetDocuments(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}))

import { useInvoices } from '../useInvoices'

const MOCK_RESPONSE = {
  documents: [{ id: '1', documentNumber: 'INV-001' }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  summary: { totalAmount: 10000, totalPaid: 5000, totalDue: 5000 },
}

describe('useInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocuments.mockResolvedValue(MOCK_RESPONSE)
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches documents on mount', async () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
    expect(mockGetDocuments).toHaveBeenCalledTimes(1)
  })

  it('setFilter updates filter and resets page to 1', async () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setFilter('status', 'DRAFT'))
    expect(result.current.filters.status).toBe('DRAFT')
    expect(result.current.filters.page).toBe(1)
  })

  it('setPage changes page number', async () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setPage(3))
    expect(result.current.filters.page).toBe(3)
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetDocuments.mock.calls.length

    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetDocuments.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('handleDelete optimistically removes item from list', async () => {
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.handleDelete('1', 'INV-001'))
    expect(result.current.data?.documents).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
    expect(mockToast.success).toHaveBeenCalledWith('INV-001 deleted', expect.any(Object))
  })

  it('shows error toast on fetch failure', async () => {
    mockGetDocuments.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useInvoices({ type: 'SALE_INVOICE' }))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load invoices')
  })
})
