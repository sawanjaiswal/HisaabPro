import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLoans } from '../useLoans'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListLoans = vi.fn()
vi.mock('../loan.service', () => ({
  listLoans: (...args: unknown[]) => mockListLoans(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: 'l1', amount: 100000 }], total: 1 }

describe('useLoans', () => {
  it('starts in loading state', () => {
    mockListLoans.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useLoans())
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
  })

  it('fetches loans on mount', async () => {
    mockListLoans.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useLoans())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListLoans.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useLoans())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load loans')
  })

  it('shows ApiError message on error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockListLoans.mockRejectedValue(new ApiError('Unauthorized', 'AUTH', 401))
    renderHook(() => useLoans())

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Unauthorized'))
  })

  it('refresh triggers re-fetch', async () => {
    mockListLoans.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useLoans())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListLoans.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListLoans).toHaveBeenCalledTimes(2)
  })
})
