import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetDocument = vi.fn()
vi.mock('../invoice.service', () => ({ getDocument: (...args: unknown[]) => mockGetDocument(...args) }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { useInvoiceDetail } from '../useInvoiceDetail'

const MOCK_DOC = { id: 'inv-1', number: 'INV-001', total: 10000 }

describe('useInvoiceDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetDocument.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useInvoiceDetail('inv-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.document).toBeNull()
  })

  it('fetches document on mount and sets success', async () => {
    mockGetDocument.mockResolvedValue(MOCK_DOC)
    const { result } = renderHook(() => useInvoiceDetail('inv-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.document).toEqual(MOCK_DOC)
    expect(mockGetDocument).toHaveBeenCalledWith('inv-1', expect.any(AbortSignal))
  })

  it('shows error toast on failure', async () => {
    mockGetDocument.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useInvoiceDetail('inv-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load invoice')
  })

  it('sets active tab', async () => {
    mockGetDocument.mockResolvedValue(MOCK_DOC)
    const { result } = renderHook(() => useInvoiceDetail('inv-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.activeTab).toBe('overview')
  })

  it('refresh triggers re-fetch', async () => {
    mockGetDocument.mockResolvedValue(MOCK_DOC)
    const { result } = renderHook(() => useInvoiceDetail('inv-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalledTimes(2))
  })
})
