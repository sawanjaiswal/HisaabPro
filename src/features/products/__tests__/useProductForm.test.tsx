import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreateProduct = vi.fn()
const mockUpdateProduct = vi.fn()
vi.mock('../product.service', () => ({
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
}))

import { useProductForm } from '../useProductForm'
import type { ProductFormData } from '../product.types'

const wrap = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>
const VALID: Partial<ProductFormData> = { name: 'Test', unitId: 'u-1', salePrice: 100, purchasePrice: 50 }
const EDIT_DATA: ProductFormData = {
  name: 'Old', autoGenerateSku: true, sku: '', categoryId: null, unitId: 'u-1',
  salePrice: 100, purchasePrice: 50, openingStock: 0, minStockLevel: 0,
  stockValidation: 'GLOBAL', hsnCode: '', description: '', status: 'ACTIVE',
}

function fillValid(result: { current: ReturnType<typeof useProductForm> }) {
  for (const [k, v] of Object.entries(VALID))
    act(() => result.current.updateField(k as keyof ProductFormData, v as never))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateProduct.mockResolvedValue({ id: 'new-1' })
  mockUpdateProduct.mockResolvedValue({ id: 'edit-1' })
})

describe('useProductForm', () => {
  describe('initial state', () => {
    it('returns defaults in create mode', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      expect(result.current.isEditMode).toBe(false)
      expect(result.current.form.name).toBe('')
      expect(result.current.form.autoGenerateSku).toBe(true)
      expect(result.current.form.status).toBe('ACTIVE')
      expect(result.current.activeSection).toBe('basic')
      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.errors).toEqual({})
    })
    it('uses initialData in edit mode', () => {
      const data = { ...EDIT_DATA, name: 'Existing', sku: 'SKU-001' }
      const { result } = renderHook(
        () => useProductForm({ editId: 'p-1', initialData: data }), { wrapper: wrap },
      )
      expect(result.current.isEditMode).toBe(true)
      expect(result.current.form.name).toBe('Existing')
      expect(result.current.form.sku).toBe('SKU-001')
    })
  })

  describe('updateField', () => {
    it('updates value and clears field error', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => { result.current.validate() })
      expect(result.current.errors.name).toBeDefined()
      act(() => result.current.updateField('name', 'Widget'))
      expect(result.current.form.name).toBe('Widget')
      expect(result.current.errors.name).toBeUndefined()
    })
  })

  describe('validate', () => {
    it('rejects empty name', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => { result.current.validate() })
      expect(result.current.errors.name).toBe('Product name is required')
    })
    it('rejects missing unitId', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('name', 'X'))
      act(() => { result.current.validate() })
      expect(result.current.errors.unitId).toBe('Unit is required')
    })
    it('rejects negative salePrice', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('salePrice', -1))
      act(() => { result.current.validate() })
      expect(result.current.errors.salePrice).toBe('Sale price cannot be negative')
    })
    it('rejects negative openingStock', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('openingStock', -5))
      act(() => { result.current.validate() })
      expect(result.current.errors.openingStock).toBe('Opening stock cannot be negative')
    })
    it('requires SKU when autoGenerateSku is off', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('autoGenerateSku', false))
      act(() => { result.current.validate() })
      expect(result.current.errors.sku).toBe('SKU is required when auto-generate is off')
    })
    it('validates barcode format (invalid EAN13)', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('barcode', 'abc'))
      act(() => result.current.updateField('barcodeFormat', 'EAN13'))
      act(() => { result.current.validate() })
      expect(result.current.errors.barcode).toMatch(/Invalid for EAN13/)
    })
    it('returns true for valid form', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      fillValid(result)
      let valid = false
      act(() => { valid = result.current.validate() })
      expect(valid).toBe(true)
      expect(result.current.errors).toEqual({})
    })
  })

  describe('reset + setActiveSection', () => {
    it('reset returns form to initial state', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.updateField('name', 'Dirty'))
      act(() => result.current.setActiveSection('stock'))
      act(() => result.current.reset())
      expect(result.current.form.name).toBe('')
      expect(result.current.activeSection).toBe('basic')
      expect(result.current.errors).toEqual({})
    })
    it('setActiveSection changes section', () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      act(() => result.current.setActiveSection('extra'))
      expect(result.current.activeSection).toBe('extra')
    })
  })

  describe('handleSubmit', () => {
    it('calls createProduct in create mode', async () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      fillValid(result)
      await act(() => result.current.handleSubmit())
      expect(mockCreateProduct).toHaveBeenCalledTimes(1)
      expect(mockToast.success).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalled()
    })
    it('calls updateProduct in edit mode', async () => {
      const { result } = renderHook(
        () => useProductForm({ editId: 'p-1', initialData: EDIT_DATA }), { wrapper: wrap },
      )
      await act(() => result.current.handleSubmit())
      expect(mockUpdateProduct).toHaveBeenCalledWith(
        'p-1', expect.not.objectContaining({ openingStock: expect.anything() }),
      )
      expect(mockToast.success).toHaveBeenCalledWith('Old updated')
      expect(mockNavigate).toHaveBeenCalledWith('/products/p-1')
    })
    it('sets isSubmitting during submit', async () => {
      let resolveCreate: () => void
      mockCreateProduct.mockReturnValue(new Promise<void>((r) => { resolveCreate = r }))
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      fillValid(result)
      let submitPromise: Promise<void>
      act(() => { submitPromise = result.current.handleSubmit() })
      expect(result.current.isSubmitting).toBe(true)
      await act(async () => { resolveCreate!(); await submitPromise! })
      expect(result.current.isSubmitting).toBe(false)
    })
    it('shows error toast on failure', async () => {
      mockCreateProduct.mockRejectedValue(new Error('Network'))
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      fillValid(result)
      await act(() => result.current.handleSubmit())
      expect(mockToast.error).toHaveBeenCalledWith('Failed to save product. Please try again.')
      expect(result.current.isSubmitting).toBe(false)
    })
    it('does not submit when validation fails', async () => {
      const { result } = renderHook(() => useProductForm(), { wrapper: wrap })
      await act(() => result.current.handleSubmit())
      expect(mockCreateProduct).not.toHaveBeenCalled()
    })
  })
})
