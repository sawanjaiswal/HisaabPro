/**
 * GST Settings — form state hook
 *
 * Keeps local draft, validates GSTIN on blur, derives stateCode.
 * On submit: calls updateGst with only changed fields.
 */

import { useState, useCallback, useEffect } from 'react'
import { validateGstin } from '@/features/tax/gstin.utils'
import type { GstSettings, PatchGstSettingsInput, TaxPricingMode, CompositionRate } from './gst.types'

export interface GstFormState {
  gstin: string
  gstEnabled: boolean
  taxPricingMode: TaxPricingMode
  compositionScheme: boolean
  compositionRate: CompositionRate | null
  gstDeclarationText: string
}

export interface GstinValidation {
  valid: boolean | null   // null = not yet validated
  stateCode: string | null
  error: string | null
}

const COMPOSITION_RATES: CompositionRate[] = [100, 500, 600]

function rateLabel(rate: CompositionRate): string {
  return `${rate / 100}%`
}

function toFormState(s: GstSettings): GstFormState {
  return {
    gstin: s.gstin ?? '',
    gstEnabled: s.gstEnabled,
    taxPricingMode: s.taxPricingMode,
    compositionScheme: s.compositionScheme,
    compositionRate: s.compositionRate,
    gstDeclarationText: s.gstDeclarationText ?? '',
  }
}

export function useGstSettingsForm(
  settings: GstSettings,
  updateGst: (patch: PatchGstSettingsInput) => void,
  isSaving: boolean,
) {
  const [form, setForm] = useState<GstFormState>(() => toFormState(settings))
  const [gstinValidation, setGstinValidation] = useState<GstinValidation>({
    valid: settings.gstin ? true : null,
    stateCode: settings.stateCode,
    error: null,
  })
  const [dirty, setDirty] = useState(false)

  // Sync if server data changes (e.g. initial load)
  useEffect(() => {
    setForm(toFormState(settings))
    setGstinValidation({
      valid: settings.gstin ? true : null,
      stateCode: settings.stateCode,
      error: null,
    })
    setDirty(false)
  }, [settings])

  const patch = useCallback(<K extends keyof GstFormState>(key: K, value: GstFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  const handleGstinBlur = useCallback(() => {
    const raw = form.gstin.trim().toUpperCase()
    if (!raw) {
      setGstinValidation({ valid: null, stateCode: null, error: null })
      return
    }
    const result = validateGstin(raw)
    setGstinValidation({
      valid: result.valid,
      stateCode: result.stateCode,
      error: result.valid ? null : (result.error ?? 'Invalid GSTIN'),
    })
  }, [form.gstin])

  const handleSubmit = useCallback(() => {
    if (isSaving) return
    if (gstinValidation.valid === false) return

    const input: PatchGstSettingsInput = {}
    const orig = toFormState(settings)

    if (form.gstEnabled !== orig.gstEnabled) input.gstEnabled = form.gstEnabled
    if (form.taxPricingMode !== orig.taxPricingMode) input.taxPricingMode = form.taxPricingMode
    if (form.compositionScheme !== orig.compositionScheme) input.compositionScheme = form.compositionScheme
    if (form.compositionRate !== orig.compositionRate) input.compositionRate = form.compositionRate ?? undefined
    if (form.gstDeclarationText !== orig.gstDeclarationText) {
      input.gstDeclarationText = form.gstDeclarationText || null
    }

    const gstinNorm = form.gstin.trim().toUpperCase() || null
    const origGstin = settings.gstin
    if (gstinNorm !== origGstin) input.gstin = gstinNorm

    if (Object.keys(input).length > 0) updateGst(input)
  }, [form, settings, gstinValidation, isSaving, updateGst])

  return {
    form,
    patch,
    gstinValidation,
    handleGstinBlur,
    handleSubmit,
    dirty,
    COMPOSITION_RATES,
    rateLabel,
  }
}
