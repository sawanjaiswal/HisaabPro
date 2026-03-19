import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBankAccounts } from '../useBankAccounts'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockListBankAccounts = vi.fn()
vi.mock('../bank-account.service', () => ({
  listBankAccounts: (...args: unknown[]) => mockListBankAccounts(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_RESPONSE = { items: [{ id: 'ba1', bankName: 'SBI', accountNumber: '1234' }], total: 1 }

describe('useBankAccounts', () => {
  it('starts in loading state', () => {
    mockListBankAccounts.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useBankAccounts())
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
  })

  it('fetches bank accounts on mount', async () => {
    mockListBankAccounts.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useBankAccounts())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toEqual(MOCK_RESPONSE.items)
    expect(result.current.total).toBe(1)
  })

  it('shows toast on error', async () => {
    mockListBankAccounts.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useBankAccounts())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load bank accounts')
  })

  it('shows ApiError message on error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockListBankAccounts.mockRejectedValue(new ApiError('DB down', 'DB_ERR', 500))
    renderHook(() => useBankAccounts())

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('DB down'))
  })

  it('refresh triggers re-fetch', async () => {
    mockListBankAccounts.mockResolvedValue(MOCK_RESPONSE)
    const { result } = renderHook(() => useBankAccounts())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListBankAccounts.mockResolvedValue({ items: [], total: 0 })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(mockListBankAccounts).toHaveBeenCalledTimes(2)
  })
})
