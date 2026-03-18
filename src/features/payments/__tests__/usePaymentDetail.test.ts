import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

const mockGetPayment = vi.fn()
const mockDeletePayment = vi.fn()
vi.mock('../payment.service', () => ({
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
  deletePayment: (...args: unknown[]) => mockDeletePayment(...args),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('@/config/routes.config', () => ({ ROUTES: { PAYMENTS: '/payments' } }))

import { usePaymentDetail } from '../usePaymentDetail'

const MOCK_PAYMENT = { id: 'pay-1', amount: 150000, partyName: 'Test' }

describe('usePaymentDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetPayment.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => usePaymentDetail('pay-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.payment).toBeNull()
  })

  it('fetches payment on mount', async () => {
    mockGetPayment.mockResolvedValue(MOCK_PAYMENT)
    const { result } = renderHook(() => usePaymentDetail('pay-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.payment).toEqual(MOCK_PAYMENT)
  })

  it('shows error toast on failure', async () => {
    mockGetPayment.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => usePaymentDetail('pay-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load payment')
  })

  it('handleDelete calls service and navigates', async () => {
    mockGetPayment.mockResolvedValue(MOCK_PAYMENT)
    mockDeletePayment.mockResolvedValue(undefined)
    const { result } = renderHook(() => usePaymentDetail('pay-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.handleDelete()
    await waitFor(() => expect(mockDeletePayment).toHaveBeenCalledWith('pay-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/payments')
  })

  it('refresh triggers re-fetch', async () => {
    mockGetPayment.mockResolvedValue(MOCK_PAYMENT)
    const { result } = renderHook(() => usePaymentDetail('pay-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockGetPayment).toHaveBeenCalledTimes(2))
  })
})
