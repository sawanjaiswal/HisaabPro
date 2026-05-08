/** useBomForm — form state + validation + save handler for BOM create/edit */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createBom, updateBom } from '../bom.service'
import { validateBomForm, hasErrors, genRowId } from '../bom.utils'
import { EMPTY_COMPONENT_ROW } from '../bom.constants'
import { bomKeys } from './useBom'
import type { BomFormData, BomComponentFormRow, BomDetailDTO } from '../bom.types'
import type { BomValidationErrors } from '../bom.utils'

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultForm = (): BomFormData => ({
  name: '',
  productId: '',
  productName: '',
  isDefault: false,
  isActive: true,
  notes: '',
  components: [],
})

// ─── hydrate from detail ──────────────────────────────────────────────────────

export function hydrateFormFromDetail(detail: BomDetailDTO): BomFormData {
  return {
    name: detail.name,
    productId: detail.productId,
    productName: detail.productName,
    isDefault: detail.isDefault,
    isActive: detail.isActive,
    notes: detail.notes ?? '',
    components: detail.components.map((c) => ({
      id: genRowId(),
      componentProductId: c.componentProductId,
      componentProductName: c.componentProductName,
      quantity: String(c.quantity),
      unitId: c.unitId ?? '',
      notes: c.notes ?? '',
    })),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBomForm(editId?: string, initial?: BomFormData) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [form, setForm] = useState<BomFormData>(initial ?? defaultForm())
  const [errors, setErrors] = useState<BomValidationErrors>({})
  const [saving, setSaving] = useState(false)

  const updateField = useCallback(<K extends keyof BomFormData>(key: K, value: BomFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const addRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      components: [...prev.components, { ...EMPTY_COMPONENT_ROW, id: genRowId() }],
    }))
    setErrors((prev) => ({ ...prev, components: undefined }))
  }, [])

  const updateRow = useCallback((index: number, updates: Partial<BomComponentFormRow>) => {
    setForm((prev) => {
      const next = [...prev.components]
      next[index] = { ...next[index], ...updates }
      return { ...prev, components: next }
    })
    setErrors((prev) => {
      const rows = { ...(prev.rows ?? {}) }
      delete rows[index]
      return { ...prev, rows }
    })
  }, [])

  const removeRow = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }))
  }, [])

  const save = useCallback(async () => {
    const errs = validateBomForm(form, editId ? form.productId : undefined)
    if (hasErrors(errs)) {
      setErrors(errs)
      return
    }

    setSaving(true)
    try {
      if (editId) {
        const { data, versioned } = await updateBom(editId, form)
        await queryClient.invalidateQueries({ queryKey: bomKeys.all() })
        if (versioned) {
          toast.success(`New recipe version created (v${data.version})`)
        } else {
          toast.success('Recipe saved')
        }
        navigate(`/bom/${data.id}`)
      } else {
        const created = await createBom(form)
        await queryClient.invalidateQueries({ queryKey: bomKeys.all() })
        toast.success('Recipe saved')
        if (navigator.onLine && created.id) {
          navigate(`/bom/${created.id}`)
        } else {
          navigate('/bom')
        }
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save recipe'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [form, editId, navigate, queryClient, toast])

  return { form, errors, saving, updateField, addRow, updateRow, removeRow, save }
}
