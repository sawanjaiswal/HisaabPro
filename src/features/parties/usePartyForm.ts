/** Create/Edit Party — Form state hook */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createParty, updateParty } from './party.service'
import {
  PHONE_REGEX,
  GSTIN_REGEX,
} from './party.constants'
import { extractPanFromGstin, rupeesToPaise } from './party.utils'
import type { PartyFormData, PartyType, CreditLimitMode, BalanceType } from './party.types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INITIAL_FORM: PartyFormData = {
  name: '',
  type: 'CUSTOMER',
  tags: [],
  creditLimit: 0,
  creditLimitMode: 'WARN',
  addresses: [],
}

type FormSection = 'basic' | 'business' | 'credit'

export interface UsePartyFormOptions {
  /** When set, form operates in edit mode — calls updateParty instead of createParty */
  editId?: string
  /** Pre-fill form with existing party data (edit mode) */
  initialData?: PartyFormData
}

export interface UsePartyFormReturn {
  form: PartyFormData
  errors: Record<string, string>
  isSubmitting: boolean
  isEditMode: boolean
  activeSection: FormSection
  setActiveSection: (section: FormSection) => void
  updateField: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
  reset: () => void
}

export function usePartyForm(options: UsePartyFormOptions = {}): UsePartyFormReturn {
  const { editId, initialData } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<PartyFormData>(initialData ?? INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<FormSection>('basic')

  const updateField = useCallback(<K extends keyof PartyFormData>(
    key: K,
    value: PartyFormData[K],
  ) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }

      // Auto-extract PAN from GSTIN when GSTIN is a valid 15-char string
      if (key === 'gstin' && typeof value === 'string' && value.length === 15) {
        const extracted = extractPanFromGstin(value)
        if (extracted) {
          next.pan = extracted
        }
      }

      return next
    })

    // Clear field error on change
    setErrors(prev => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}

    if (!form.name.trim()) {
      next.name = 'Party name is required'
    } else if (form.name.trim().length < 2) {
      next.name = 'Name must be at least 2 characters'
    }

    if (form.phone && !PHONE_REGEX.test(form.phone)) {
      next.phone = 'Enter a valid 10-digit Indian mobile number'
    }

    if (form.email && !EMAIL_REGEX.test(form.email)) {
      next.email = 'Enter a valid email address'
    }

    if (form.gstin && !GSTIN_REGEX.test(form.gstin)) {
      next.gstin = 'Enter a valid 15-character GSTIN'
    }

    if (form.creditLimit < 0) {
      next.creditLimit = 'Credit limit cannot be negative'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (isSubmitting) return

    setIsSubmitting(true)

    // Convert opening balance amount from rupees to paise before sending
    const payload: PartyFormData = {
      ...form,
      openingBalance: form.openingBalance
        ? {
            ...form.openingBalance,
            amount: rupeesToPaise(form.openingBalance.amount),
          }
        : undefined,
    }

    try {
      if (isEditMode && editId) {
        await updateParty(editId, payload)
        toast.success(`${form.name} updated`)
        navigate(`/parties/${editId}`)
      } else {
        await createParty(payload)
        toast.success(`${form.name} added successfully`)
        navigate(ROUTES.PARTIES)
      }
    } catch {
      toast.error(isEditMode ? 'Failed to update party.' : 'Failed to save party. Please try again.')
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
export type { PartyType, CreditLimitMode, BalanceType }
