/** Create/Edit Product — Form state hook
 *
 * TanStack Query v5 migration. Submit wrapped in useMutation for
 * automatic error handling and cache invalidation. Manages form state,
 * per-field validation, 3-section pill navigation, and paise conversion.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { createProduct, updateProduct, adjustStock } from './product.service'
import { uploadProductImages } from './product-images.service'
import { validateBarcode } from './barcode.utils'
import { useConflictReconcile, isConflictError } from '@/features/collaboration/useConflictReconcile'

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
  moq: 0,
}

export interface UseProductFormOptions {
  /** When set, form operates in edit mode -- calls updateProduct instead of createProduct */
  editId?: string
  /** Pre-fill form with existing product data (edit mode) */
  initialData?: ProductFormData
  /** #150 — the product's optimistic-lock version at load time (edit mode). */
  version?: number
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
  handleSubmit: (opts?: { addAnother?: boolean }) => Promise<boolean>
  reset: () => void
  /** #150 — conflict reconcile state + actions; page renders <ConflictDialog>. */
  conflictReconcile: ReturnType<typeof useConflictReconcile>
}

export function useProductForm(options: UseProductFormOptions = {}): UseProductFormReturn {
  const { editId, initialData, version } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const conflictReconcile = useConflictReconcile()

  const [form, setForm] = useState<ProductFormData>(initialData ?? INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
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

    // In create mode: opening stock cannot be negative
    if (!isEditMode && form.openingStock < 0) {
      next.openingStock = 'Opening stock cannot be negative'
    }

    // In edit mode: if the user explicitly enters a negative target stock, flag it
    if (isEditMode && form.openingStock < 0 && form.openingStock !== (initialData?.openingStock ?? 0)) {
      next.openingStock = 'Stock quantity cannot be negative'
    }

    if (form.minStockLevel < 0) {
      next.minStockLevel = 'Minimum stock level cannot be negative'
    }

    if (!form.autoGenerateSku && form.sku !== undefined && form.sku.trim() === '') {
      next.sku = 'SKU is required when auto-generate is off'
    }

    // Barcode validation (optional field -- only validate if filled)
    if (form.barcode) {
      const barcodeError = validateBarcode(form.barcode, form.barcodeFormat ?? 'CODE128')
      if (barcodeError) {
        next.barcode = barcodeError
      }
    }

    setErrors(next)
    const errKeys = Object.keys(next)
    if (errKeys.length > 0) {
      const k = errKeys[0]
      if (['name', 'unitId', 'salePrice', 'purchasePrice', 'sku'].includes(k)) setActiveSection('basic')
      else if (['openingStock', 'minStockLevel'].includes(k)) setActiveSection('stock')
      else setActiveSection('extra')
      toast.error(next[k])
      return false
    }
    return true
  }, [form, isEditMode, initialData, toast])

  const submitMutation = useMutation({
    mutationFn: async (vars: { versionOverride?: number; addAnother?: boolean } = {}) => {
      const { versionOverride, addAnother } = vars
      if (isEditMode && editId) {
        const { openingStock: _os, autoGenerateSku: _ag, pendingImages, ...editPayload } = form
        await updateProduct(editId, editPayload, undefined, versionOverride ?? version)
        if (pendingImages?.length) await uploadProductImages(editId, pendingImages)

        const stockDiff = (form.openingStock ?? 0) - (initialData?.openingStock ?? 0)
        if (stockDiff !== 0) {
          await adjustStock(editId, {
            type: stockDiff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            quantity: Math.abs(stockDiff),
            reason: 'AUDIT',
            notes: 'Stock updated via Edit Product',
          })
        }
        return { mode: 'edit' as const, editId, addAnother: false, name: form.name }
      }
      const { pendingImages, ...createPayload } = form
      const created = await createProduct(createPayload)
      if (pendingImages?.length && created?.id) await uploadProductImages(created.id, pendingImages)
      return { mode: 'create' as const, addAnother: Boolean(addAnother), name: form.name }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      if (result.mode === 'edit') {
        toast.success(`${result.name} updated`)
        navigate(`/products/${result.editId}`, { replace: true })
      } else if (result.addAnother) {
        toast.success(`${result.name} added. Enter next product.`)
        setForm(INITIAL_FORM)
        setErrors({})
        setActiveSection('basic')
      } else {
        toast.success(`${result.name} added`)
        navigate(ROUTES.PRODUCTS, { replace: true })
      }
    },
    onError: (err) => {
      if (isConflictError(err)) return
      const fallback = isEditMode ? t.productUpdateFailed : t.productSaveFailed
      if (err instanceof Error) toast.error(err.message || fallback, { detail: err })
      else toast.error(err ?? fallback)
    },
  })

  const isSubmitting = submitMutation.isPending

  const handleSubmit = useCallback(async (opts?: { addAnother?: boolean }): Promise<boolean> => {
    if (!validate() || isSubmitting) return false
    try {
      let ok = false
      await conflictReconcile.withConflictGuard(async (versionOverride) => {
        await submitMutation.mutateAsync({ versionOverride, addAnother: opts?.addAnother })
        ok = true
      })
      return ok
    } catch {
      return false
    }
  }, [validate, isSubmitting, submitMutation, conflictReconcile])

  const reset = useCallback(() => {
    setForm(isEditMode && initialData ? initialData : INITIAL_FORM)
    setErrors({})
    setActiveSection('basic')
  }, [isEditMode, initialData])

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
    conflictReconcile,
  }
}

// Re-export types needed by sub-components
export type { ProductStatus, StockValidationMode }
