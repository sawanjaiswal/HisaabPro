/** Tax — Tax Category form hook (create/edit) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createTaxCategory, updateTaxCategory } from './tax.service'
import type { TaxCategoryFormData } from './tax.types'

const INITIAL: TaxCategoryFormData = { name: '', rate: 0, cessRate: 0, cessType: 'PERCENTAGE', hsnCode: '', sacCode: '' }

export interface UseTaxCategoryFormOpts {
  editId?: string
  initialData?: TaxCategoryFormData
  businessId: string
}

export function useTaxCategoryForm({ editId, initialData, businessId }: UseTaxCategoryFormOpts) {
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<TaxCategoryFormData>(initialData ?? INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = useCallback(<K extends keyof TaxCategoryFormData>(key: K, value: TaxCategoryFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }, [])

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.rate < 0 || form.rate > 10000) e.rate = 'Rate must be 0–100%'
    if (form.cessRate < 0) e.cessRate = 'Cess cannot be negative'
    setErrors(e)
    return Object.keys(e).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate() || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (isEdit && editId) { await updateTaxCategory(editId, form); toast.success(`${form.name} updated`) }
      else { await createTaxCategory(businessId, form); toast.success(`${form.name} created`) }
      navigate(ROUTES.SETTINGS_TAX_RATES)
    } catch { toast.error(isEdit ? 'Failed to update' : 'Failed to create') }
    finally { setIsSubmitting(false) }
  }, [form, isSubmitting, validate, toast, navigate, isEdit, editId, businessId])

  return { form, errors, isSubmitting, isEdit, updateField, handleSubmit }
}
