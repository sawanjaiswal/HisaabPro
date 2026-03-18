/** Create/Edit Product — Form state hook
 *
 * Mirrors usePartyForm.ts exactly. Manages form state, per-field
 * validation, 3-section pill navigation, and paise conversion on submit.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createProduct, updateProduct } from './product.service'
import { validateBarcode } from './barcode.utils'

import type { ProductFormData, ProductStatus, StockValidationMode } from './product.types'

type FormSection = 'basic' | 'stock' | 'extra'

const INITIAL_FORM: ProductFormData = {
  name: '',
  autoGenerateSku: true,
  sku: '',
  categoryId: null,
  unitId: '',
  salePrice: 0,
  purchasePrice: 0,
  openingStock: 0,
  minStockLevel: 0,
  stockValidation: 'GLOBAL',
  hsnCode: '',
  description: '',
  status: 'ACTIVE',
}

export interface UseProductFormOptions {
  /** When set, form operates in edit mode — calls updateProduct instead of createProduct */
  editId?: string
  /** Pre-fill form with existing product data (edit mode) */
  initialData?: ProductFormData
}

export interface UseProductFormReturn {
  form: ProductFormData
  errors: Record<string, string>
  isSubmitting: boolean
  isEditMode: boolean
  activeSection: FormSection
  setActiveSection: (section: FormSection) => void
  updateField: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
  reset: () => void
}

export function useProductForm(options: UseProductFormOptions = {}): UseProductFormReturn {
  const { editId, initialData } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<ProductFormData>(initialData ?? INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<FormSection>('basic')

  const updateField = useCallback(<K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))

    // Clear field error on change
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}

    if (!form.name.trim()) {
      next.name = 'Product name is required'
    }

    if (!form.unitId) {
      next.unitId = 'Unit is required'
    }

    if (form.salePrice < 0) {
      next.salePrice = 'Sale price cannot be negative'
    }

    if (form.purchasePrice !== undefined && form.purchasePrice < 0) {
      next.purchasePrice = 'Purchase price cannot be negative'
    }

    if (form.openingStock < 0) {
      next.openingStock = 'Opening stock cannot be negative'
    }

    if (form.minStockLevel < 0) {
      next.minStockLevel = 'Minimum stock level cannot be negative'
    }

    if (!form.autoGenerateSku && form.sku !== undefined && form.sku.trim() === '') {
      next.sku = 'SKU is required when auto-generate is off'
    }

    // Barcode validation (optional field — only validate if filled)
    if (form.barcode) {
      const barcodeError = validateBarcode(form.barcode, form.barcodeFormat ?? 'CODE128')
      if (barcodeError) {
        next.barcode = barcodeError
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      if (isEditMode && editId) {
        // openingStock and autoGenerateSku cannot be changed after creation
        const { openingStock: _os, autoGenerateSku: _ag, ...editPayload } = form
        await updateProduct(editId, editPayload)
        toast.success(`${form.name} updated`)
        navigate(`/products/${editId}`)
      } else {
        // Form already stores prices in paise (ProductFormBasic multiplies by 100 on input)
        await createProduct(form)
        toast.success(`${form.name} added`)
        navigate(ROUTES.PRODUCTS)
      }
    } catch {
      toast.error(isEditMode ? 'Failed to update product.' : 'Failed to save product. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, validate, toast, navigate, isEditMode, editId])

  const reset = useCallback(() => {
    setForm(initialData ?? INITIAL_FORM)
    setErrors({})
    setActiveSection('basic')
  }, [initialData])

  return {
    form,
    errors,
    isSubmitting,
    isEditMode,
    activeSection,
    setActiveSection,
    updateField,
    validate,
    handleSubmit,
    reset,
  }
}

// Re-export types needed by sub-components
export type { ProductStatus, StockValidationMode }
