import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { LineItemFormData, AdditionalChargeFormData } from '../invoice.types'

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreateDocument = vi.fn()
const mockUpdateDocument = vi.fn()
vi.mock('../invoice.service', () => ({
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  validateStock: vi.fn().mockResolvedValue({ items: [] }),
}))

vi.mock('../useStockValidation', () => ({
  useStockValidation: () => ({ stockWarnings: [], hasStockBlocks: false }),
}))

// ─── Helpers ────────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(MemoryRouter, null, children)

function makeLineItem(overrides: Partial<LineItemFormData> = {}): LineItemFormData {
  return {
    productId: 'prod-1',
    quantity: 2,
    rate: 10000, // 100.00 rupees in paise
    discountType: 'PERCENTAGE',
    discountValue: 0,
    ...overrides,
  }
}

function makeCharge(overrides: Partial<AdditionalChargeFormData> = {}): AdditionalChargeFormData {
  return { name: 'Shipping', type: 'FIXED', value: 5000, ...overrides }
}

// Lazy import so mocks register first
async function importHook() {
  const mod = await import('../useInvoiceForm')
  return mod.useInvoiceForm
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('useInvoiceForm', () => {
  let useInvoiceForm: Awaited<ReturnType<typeof importHook>>

  beforeEach(async () => {
    vi.clearAllMocks()
    useInvoiceForm = await importHook()
  })

  // 1 — Initial state
  it('initializes with SALE_INVOICE defaults', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })
    expect(result.current.form.type).toBe('SALE_INVOICE')
    expect(result.current.form.status).toBe('DRAFT')
    expect(result.current.form.lineItems).toEqual([])
    expect(result.current.form.additionalCharges).toEqual([])
    expect(result.current.isEditMode).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.activeSection).toBe('items')
  })

  // 2 — updateField
  it('updateField updates form and clears that field error', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    // Trigger validation to create errors
    act(() => { result.current.validate() })
    expect(result.current.errors.partyId).toBeTruthy()

    act(() => { result.current.updateField('partyId', 'party-123') })
    expect(result.current.form.partyId).toBe('party-123')
    expect(result.current.errors.partyId).toBeUndefined()
  })

  // 3 — addLineItem
  it('addLineItem appends item and clears lineItems error', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    act(() => { result.current.validate() })
    expect(result.current.errors.lineItems).toBeTruthy()

    const item = makeLineItem()
    act(() => { result.current.addLineItem(item) })

    expect(result.current.form.lineItems).toHaveLength(1)
    expect(result.current.form.lineItems[0].productId).toBe('prod-1')
    expect(result.current.errors.lineItems).toBeUndefined()
  })

  // 4 — updateLineItem
  it('updateLineItem patches item at given index', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    act(() => { result.current.addLineItem(makeLineItem()) })
    act(() => { result.current.updateLineItem(0, { quantity: 5 }) })

    expect(result.current.form.lineItems[0].quantity).toBe(5)
    expect(result.current.form.lineItems[0].productId).toBe('prod-1')
  })

  // 5 — removeLineItem
  it('removeLineItem removes item at given index', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    act(() => { result.current.addLineItem(makeLineItem({ productId: 'a' })) })
    act(() => { result.current.addLineItem(makeLineItem({ productId: 'b' })) })
    act(() => { result.current.removeLineItem(0) })

    expect(result.current.form.lineItems).toHaveLength(1)
    expect(result.current.form.lineItems[0].productId).toBe('b')
  })

  // 6 — addCharge + removeCharge
  it('addCharge appends and removeCharge removes by index', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    act(() => { result.current.addCharge(makeCharge({ name: 'Shipping' })) })
    act(() => { result.current.addCharge(makeCharge({ name: 'Packing' })) })
    expect(result.current.form.additionalCharges).toHaveLength(2)

    act(() => { result.current.removeCharge(0) })
    expect(result.current.form.additionalCharges).toHaveLength(1)
    expect(result.current.form.additionalCharges[0].name).toBe('Packing')
  })

  // 7 — validate
  describe('validate', () => {
    it('fails when partyId is empty', () => {
      const { result } = renderHook(() => useInvoiceForm(), { wrapper })
      act(() => { result.current.validate() })
      expect(result.current.errors.partyId).toBeTruthy()
    })

    it('fails when lineItems is empty', () => {
      const { result } = renderHook(() => useInvoiceForm(), { wrapper })
      act(() => { result.current.updateField('partyId', 'p-1') })
      act(() => { result.current.validate() })
      expect(result.current.errors.lineItems).toBeTruthy()
    })

    it('passes when partyId and lineItems are present', () => {
      const { result } = renderHook(() => useInvoiceForm(), { wrapper })
      act(() => { result.current.updateField('partyId', 'p-1') })
      act(() => { result.current.addLineItem(makeLineItem()) })

      let valid = false
      act(() => { valid = result.current.validate() })
      expect(valid).toBe(true)
      expect(Object.keys(result.current.errors)).toHaveLength(0)
    })
  })

  // 8 — reset
  it('reset clears form, errors, and activeSection', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    act(() => { result.current.updateField('partyId', 'p-1') })
    act(() => { result.current.addLineItem(makeLineItem()) })
    act(() => { result.current.setActiveSection('charges') })
    act(() => { result.current.validate() }) // set some errors context

    act(() => { result.current.reset() })

    expect(result.current.form.partyId).toBe('')
    expect(result.current.form.lineItems).toEqual([])
    expect(result.current.activeSection).toBe('items')
    expect(Object.keys(result.current.errors)).toHaveLength(0)
  })

  // 9 — setActiveSection
  it('setActiveSection changes the active section', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })
    act(() => { result.current.setActiveSection('details') })
    expect(result.current.activeSection).toBe('details')
  })

  // 10 — totals computed from line items
  it('totals reflect line items via useMemo', () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    // Empty — all zeros
    expect(result.current.totals.grandTotal).toBe(0)

    // Add item: qty 2 × rate 10000 paise = 20000 paise subtotal
    act(() => { result.current.addLineItem(makeLineItem()) })
    expect(result.current.totals.subtotal).toBe(20000)
    expect(result.current.totals.grandTotal).toBe(20000)
  })

  // 11 — handleSubmit creates document, toasts, navigates
  it('handleSubmit calls createDocument, shows toast, navigates', async () => {
    mockCreateDocument.mockResolvedValueOnce({ id: 'inv-1' })

    const { result } = renderHook(() => useInvoiceForm(), { wrapper })

    // Fill valid form
    act(() => { result.current.updateField('partyId', 'p-1') })
    act(() => { result.current.addLineItem(makeLineItem()) })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockCreateDocument).toHaveBeenCalledTimes(1)
    expect(mockToast.success).toHaveBeenCalledWith('Invoice saved')
    expect(mockNavigate).toHaveBeenCalledWith('/invoices')
  })

  it('handleSubmit shows error toast on failure', async () => {
    mockCreateDocument.mockRejectedValueOnce(new Error('Network'))

    const { result } = renderHook(() => useInvoiceForm(), { wrapper })
    act(() => { result.current.updateField('partyId', 'p-1') })
    act(() => { result.current.addLineItem(makeLineItem()) })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to save invoice. Please try again.',
    )
    expect(result.current.isSubmitting).toBe(false)
  })

  it('handleSubmit skips when validation fails', async () => {
    const { result } = renderHook(() => useInvoiceForm(), { wrapper })
    // partyId empty → validation fails
    await act(async () => { await result.current.handleSubmit() })
    expect(mockCreateDocument).not.toHaveBeenCalled()
  })
})
