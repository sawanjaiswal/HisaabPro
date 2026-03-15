/** Create Product — Form state hook
 *
 * Mirrors usePartyForm.ts exactly. Manages form state, per-field
 * validation, 3-section pill navigation, and paise conversion on submit.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createProduct } from './product.service'
import { rupeesToPaise } from './product.utils'
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

export interface UseProductFormReturn {
  form: ProductFormData
  errors: Record<string, string>
  isSubmitting: boolean
  activeSection: FormSection
  setActiveSection: (section: FormSection) => void
  updateField: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
  reset: () => void
}

export function useProductForm(): UseProductFormReturn {
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<ProductFormData>(INITIAL_FORM)
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

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (isSubmitting) return

    setIsSubmitting(true)

    // Convert salePrice and purchasePrice from rupees to paise before sending.
    // Form fields display rupees; storage is always paise (integer).
    const payload: ProductFormData = {
      ...form,
      salePrice: rupeesToPaise(form.salePrice),
      purchasePrice: form.purchasePrice !== undefined
        ? rupeesToPaise(form.purchasePrice)
        : undefined,
    }

    try {
      await createProduct(payload)
      toast.success(`${form.name} added`)
      navigate(ROUTES.PRODUCTS)
    } catch {
      toast.error('Failed to save product. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, validate, toast, navigate])

  const reset = useCallback(() => {
    setForm(INITIAL_FORM)
    setErrors({})
    setActiveSection('basic')
  }, [])

  return {
    form,
    errors,
    isSubmitting,
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
