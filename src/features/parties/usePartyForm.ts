/** Create/Edit Party — Form state hook */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createParty, updateParty } from './party.service'
import { reconcilePartyCreated, reconcilePartyUpdated } from './party-cache'
import {
  PHONE_REGEX,
  GSTIN_REGEX,
} from './party.constants'
import { extractPanFromGstin, rupeesToPaise } from './party.utils'
import { useGstinVerify } from './useGstinVerify'
import type { UseGstinVerifyReturn } from './useGstinVerify'
import { useConflictReconcile } from '@/features/collaboration/useConflictReconcile'
import type { PartyFormData, PartyType, CreditLimitMode, BalanceType } from './party.types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INITIAL_FORM: PartyFormData = {
  name: '',
  type: 'CUSTOMER',
  tags: [],
  creditLimit: 0,
  creditLimitMode: 'WARN',
  addresses: [],
  customFields: [],
}

export interface UsePartyFormOptions {
  /** When set, form operates in edit mode — calls updateParty instead of createParty */
  editId?: string
  /** Pre-fill form with existing party data (edit mode) */
  initialData?: PartyFormData
  /** #150 — the party's optimistic-lock version at load time (edit mode). */
  version?: number
}

export interface UsePartyFormReturn {
  form: PartyFormData
  errors: Record<string, string>
  isSubmitting: boolean
  isEditMode: boolean
  updateField: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
  reset: () => void
  gstinVerify: UseGstinVerifyReturn
  /** #150 — conflict reconcile state + actions; page renders <ConflictDialog>. */
  conflictReconcile: ReturnType<typeof useConflictReconcile>
}

export function usePartyForm(options: UsePartyFormOptions = {}): UsePartyFormReturn {
  const { editId, initialData, version } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const conflictReconcile = useConflictReconcile()

  const [form, setForm] = useState<PartyFormData>(initialData ?? INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const gstinVerify = useGstinVerify(
    initialData?.gstinVerified,
    initialData?.gstinLegalName,
    initialData?.gstinStatus,
  )

  // Auto-populate companyName when GSTIN is verified
  useEffect(() => {
    if (gstinVerify.status === 'verified' && gstinVerify.result?.legalName) {
      setForm(prev => ({
        ...prev,
        gstinVerified: true,
        gstinLegalName: gstinVerify.result?.legalName,
        gstinStatus: gstinVerify.result?.status,
        // Only auto-fill companyName if empty or was previously auto-filled
        companyName: prev.companyName ? prev.companyName : gstinVerify.result?.legalName,
      }))
    }
  }, [gstinVerify.status, gstinVerify.result])

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

      // Clear verification state when GSTIN changes
      if (key === 'gstin') {
        next.gstinVerified = false
        next.gstinLegalName = undefined
        next.gstinStatus = undefined
      }

      return next
    })

    // Trigger GSTIN verification on change
    if (key === 'gstin' && typeof value === 'string') {
      gstinVerify.onGstinChange(value)
    }

    // Clear field error on change
    setErrors(prev => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [gstinVerify])

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

    // Convert opening balance amount from rupees to paise before sending.
    // Strip empty/whitespace-only custom field values — server requires non-empty strings.
    const payload: PartyFormData = {
      ...form,
      customFields: form.customFields.filter(cf => cf.value != null && cf.value.trim() !== ''),
      openingBalance: form.openingBalance
        ? {
            ...form.openingBalance,
            amount: rupeesToPaise(form.openingBalance.amount),
          }
        : undefined,
    }

    try {
      if (isEditMode && editId) {
        // updatePartySchema is .strict() and only accepts the core mutable fields —
        // addresses / openingBalance / gstin* view-flags are managed elsewhere and
        // would 400 the request. Whitelist to the schema's field set. (see
        // .claude/fix-trace-party-update.md)
        const updatePayload: Partial<PartyFormData> = {
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          companyName: payload.companyName,
          type: payload.type,
          groupId: payload.groupId,
          tags: payload.tags,
          gstin: payload.gstin,
          pan: payload.pan,
          creditLimit: payload.creditLimit,
          creditLimitMode: payload.creditLimitMode,
          notes: payload.notes,
          customFields: payload.customFields,
          priceListId: payload.priceListId,
        }
        // #150 — a stale save 409s; withConflictGuard opens the reconcile dialog
        // instead of an error toast. versionOverride is supplied on overwrite.
        await conflictReconcile.withConflictGuard(async (versionOverride) => {
          const updated = await updateParty(editId, updatePayload, undefined, versionOverride ?? version)
          reconcilePartyUpdated(queryClient, updated)
          toast.success(`${form.name} updated`)
          navigate(`/parties/${editId}`)
        })
      } else {
        const created = await createParty(payload)
        reconcilePartyCreated(queryClient, created)
        toast.success(`${form.name} added successfully`)
        navigate(ROUTES.PARTIES)
      }
    } catch {
      toast.error(isEditMode ? 'Failed to update party.' : 'Failed to save party. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, validate, toast, navigate, queryClient, isEditMode, editId, version, conflictReconcile])

  const reset = useCallback(() => {
    setForm(initialData ?? INITIAL_FORM)
    setErrors({})
  }, [initialData])

  return {
    form,
    errors,
    isSubmitting,
    isEditMode,
    updateField,
    validate,
    handleSubmit,
    reset,
    gstinVerify,
    conflictReconcile,
  }
}

// Re-export types needed by sub-components
export type { PartyType, CreditLimitMode, BalanceType }
