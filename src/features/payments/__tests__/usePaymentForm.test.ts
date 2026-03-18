import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import type { PaymentFormData } from '../payment.types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreatePayment = vi.fn()
const mockUpdatePayment = vi.fn()
vi.mock('../payment.service', () => ({
  createPayment: (...args: unknown[]) => mockCreatePayment(...args),
  updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
}))

vi.mock('../usePaymentFormActions', () => ({
  usePaymentFormActions: (setForm: Function, setErrors: Function) => ({
    updateField: vi.fn((key: string, value: unknown) => {
      setForm((prev: PaymentFormData) => ({ ...prev, [key]: value }))
      setErrors((prev: Record<string, string>) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }),
    updateMode: vi.fn(),
    toggleAllocation: vi.fn(),
    updateAllocationAmount: vi.fn(),
    autoAllocate: vi.fn(),
    toggleDiscount: vi.fn(),
    updateDiscount: vi.fn(),
  }),
}))

vi.mock('../paymentForm.helpers', () => ({
  buildInitialForm: (type: string) => ({
    type,
    partyId: '',
    amount: 0,
    mode: 'CASH',
    date: '2026-03-19',
    referenceNumber: '',
    notes: '',
    allocations: [],
    discount: null,
  }),
  buildFormFromPayment: vi.fn(),
  buildApiPayload: vi.fn((form: PaymentFormData) => form),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { usePaymentForm } from '../usePaymentForm'

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(MemoryRouter, null, children)
}

function renderPaymentForm(opts = {}) {
  return renderHook(() => usePaymentForm(opts), { wrapper })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Default initial state
  it('initialises with PAYMENT_IN defaults', () => {
    const { result } = renderPaymentForm()

    expect(result.current.form.type).toBe('PAYMENT_IN')
    expect(result.current.form.amount).toBe(0)
    expect(result.current.form.mode).toBe('CASH')
    expect(result.current.errors).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.activeSection).toBe('details')
  })

  // 2. Custom defaultType
  it('initialises with custom defaultType', () => {
    const { result } = renderPaymentForm({ defaultType: 'PAYMENT_OUT' })
    expect(result.current.form.type).toBe('PAYMENT_OUT')
  })

  // 3a. Validate — missing partyId
  it('validate returns false when partyId is empty', () => {
    const { result } = renderPaymentForm()
    let valid: boolean
    act(() => { valid = result.current.validate() })
    expect(valid!).toBe(false)
    expect(result.current.errors.partyId).toBeTruthy()
  })

  // 3b. Validate — zero amount
  it('validate returns false when amount is zero', () => {
    const { result } = renderPaymentForm()
    act(() => { result.current.updateField('partyId' as never, 'party-1' as never) })
    let valid: boolean
    act(() => { valid = result.current.validate() })
    expect(valid!).toBe(false)
    expect(result.current.errors.amount).toBeTruthy()
  })

  // 3c. Validate — valid form passes
  it('validate returns true for a valid form', () => {
    const { result } = renderPaymentForm()
    act(() => {
      result.current.updateField('partyId' as never, 'party-1' as never)
      result.current.updateField('amount' as never, 5000 as never)
    })
    let valid: boolean
    act(() => { valid = result.current.validate() })
    expect(valid!).toBe(true)
    expect(result.current.errors).toEqual({})
  })

  // 4. setActiveSection
  it('setActiveSection changes the active section', () => {
    const { result } = renderPaymentForm()
    act(() => { result.current.setActiveSection('allocations' as never) })
    expect(result.current.activeSection).toBe('allocations')
  })

  // 5. handleSubmit — success (create)
  it('handleSubmit calls createPayment, navigates, and toasts on success', async () => {
    mockCreatePayment.mockResolvedValueOnce({ id: 'pay-1' })
    const { result } = renderPaymentForm()

    act(() => {
      result.current.updateField('partyId' as never, 'party-1' as never)
      result.current.updateField('amount' as never, 5000 as never)
    })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockToast.success).toHaveBeenCalledWith('Payment recorded')
    expect(mockNavigate).toHaveBeenCalledWith('/payments')
  })

  // 6. handleSubmit — failure shows error toast
  it('handleSubmit shows error toast on failure', async () => {
    mockCreatePayment.mockRejectedValueOnce(new Error('Network'))
    const { result } = renderPaymentForm()

    act(() => {
      result.current.updateField('partyId' as never, 'party-1' as never)
      result.current.updateField('amount' as never, 5000 as never)
    })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to save payment. Please try again.',
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // 7. handleSubmit — skips if validation fails
  it('handleSubmit does nothing when validation fails', async () => {
    const { result } = renderPaymentForm()

    await act(async () => { await result.current.handleSubmit() })

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // 8. isSubmitting prevents double submit
  it('isSubmitting prevents double submit', async () => {
    let resolvePayment: (v: unknown) => void
    mockCreatePayment.mockImplementation(
      () => new Promise((r) => { resolvePayment = r }),
    )
    const { result } = renderPaymentForm()

    act(() => {
      result.current.updateField('partyId' as never, 'party-1' as never)
      result.current.updateField('amount' as never, 5000 as never)
    })

    // First call — starts submitting
    let firstSubmit: Promise<void>
    act(() => { firstSubmit = result.current.handleSubmit() })
    expect(result.current.isSubmitting).toBe(true)

    // Second call — should be blocked
    await act(async () => { await result.current.handleSubmit() })
    expect(mockCreatePayment).toHaveBeenCalledTimes(1)

    // Resolve first call
    await act(async () => {
      resolvePayment!({ id: 'pay-1' })
      await firstSubmit!
    })
    expect(result.current.isSubmitting).toBe(false)
  })
})
