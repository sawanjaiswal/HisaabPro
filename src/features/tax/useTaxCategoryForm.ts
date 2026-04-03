/** Tax — Tax Category form hook (create/edit) — TanStack Query mutation */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TaxCategoryFormData>(initialData ?? INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: async (data: TaxCategoryFormData) => {
      if (isEdit && editId) return updateTaxCategory(editId, data)
      return createTaxCategory(businessId, data)
    },
    onSuccess: () => {
      toast.success(`${form.name} ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.tax.categories() })
      if (editId) queryClient.invalidateQueries({ queryKey: queryKeys.tax.detail(editId) })
      navigate(ROUTES.SETTINGS_TAX_RATES)
    },
    onError: () => {
      toast.error(isEdit ? 'Failed to update' : 'Failed to create')
    },
  })

  const updateField = useCallback(<K extends keyof TaxCategoryFormData>(key: K, value: TaxCategoryFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }, [])

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.rate < 0 || form.rate > 10000) e.rate = 'Rate must be 0-100%'
    if (form.cessRate < 0) e.cessRate = 'Cess cannot be negative'
    setErrors(e)
    return Object.keys(e).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate() || mutation.isPending) return
    mutation.mutate(form)
  }, [form, validate, mutation])

  return { form, errors, isSubmitting: mutation.isPending, isEdit, updateField, handleSubmit }
}
