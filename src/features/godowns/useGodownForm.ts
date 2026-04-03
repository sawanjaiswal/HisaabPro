/** Godown create/edit -- Form hook */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { GODOWN_NAME_MAX, ADDRESS_MAX } from './godown.constants'
import type { CreateGodownData, Godown } from './godown.types'

interface UseGodownFormOptions {
  editId?: string
  initialData?: CreateGodownData
}

interface UseGodownFormReturn {
  form: CreateGodownData
  errors: Record<string, string>
  isSubmitting: boolean
  updateField: <K extends keyof CreateGodownData>(key: K, value: CreateGodownData[K]) => void
  handleSubmit: () => Promise<void>
}

const INITIAL_FORM: CreateGodownData = {
  name: '',
  address: '',
  isDefault: false,
}

export function useGodownForm({ editId, initialData }: UseGodownFormOptions = {}): UseGodownFormReturn {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(editId)

  const [form, setForm] = useState<CreateGodownData>(initialData ?? INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateField = useCallback(<K extends keyof CreateGodownData>(key: K, value: CreateGodownData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}
    const name = form.name.trim()

    if (!name) {
      next.name = 'Godown name is required'
    } else if (name.length > GODOWN_NAME_MAX) {
      next.name = `Name must be under ${GODOWN_NAME_MAX} characters`
    }

    if (form.address && form.address.length > ADDRESS_MAX) {
      next.address = `Address must be under ${ADDRESS_MAX} characters`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const mutation = useMutation({
    mutationFn: async (payload: CreateGodownData) => {
      if (isEditMode && editId) {
        return api<Godown>(`/godowns/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          entityType: 'godown',
          entityLabel: payload.name,
        })
      }
      return api<Godown>('/godowns', {
        method: 'POST',
        body: JSON.stringify(payload),
        entityType: 'godown',
        entityLabel: payload.name,
      })
    },
    onSuccess: (_data, payload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.godowns.all() })
      toast.success(`${payload.name} ${isEditMode ? 'updated' : 'created'}`)
      if (isEditMode && editId) {
        navigate(ROUTES.GODOWN_DETAIL.replace(':id', editId))
      } else {
        navigate(ROUTES.GODOWNS)
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError
        ? err.message
        : isEditMode ? 'Failed to update godown' : 'Failed to create godown'
      toast.error(message)
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!validate() || mutation.isPending) return

    const payload: CreateGodownData = {
      name: form.name.trim(),
      address: form.address?.trim() || undefined,
      isDefault: form.isDefault,
    }

    await mutation.mutateAsync(payload)
  }, [form, mutation, validate])

  return { form, errors, isSubmitting: mutation.isPending, updateField, handleSubmit }
}
