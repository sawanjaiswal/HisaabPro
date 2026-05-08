/** useProductionRunForm — wizard state machine (step 0→3) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { executeProductionRun } from '../production-run.service'
import { generateIdempotencyKey, todayISODate } from '../production-run.utils'
import { prKeys } from './useProductionRuns'
import type { WizardFormState, WizardStep } from '../production-run.types'
// WizardStep is 0|1|2|3

const defaultWizard = (): WizardFormState => ({
  bomId: '',
  bomName: '',
  bomVersion: 0,
  finishedProductId: '',
  finishedProductName: '',
  quantityProduced: '',
  runDate: todayISODate(),
  notes: '',
  idempotencyKey: generateIdempotencyKey(),
})

export function useProductionRunForm(initialBomId?: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [step, setStep] = useState<WizardStep>(initialBomId ? 1 : 0)
  const [wizard, setWizard] = useState<WizardFormState>(() => ({
    ...defaultWizard(),
    bomId: initialBomId ?? '',
  }))
  const [submitting, setSubmitting] = useState(false)

  const updateWizard = useCallback(
    (updates: Partial<WizardFormState>) => setWizard((prev) => ({ ...prev, ...updates })),
    [],
  )

  const goNext = useCallback(() => {
    setStep((s: WizardStep) => Math.min(s + 1, 3) as WizardStep)
  }, [])

  const goBack = useCallback(() => {
    setStep((s: WizardStep) => Math.max(s - 1, 0) as WizardStep)
  }, [])

  const submit = useCallback(async () => {
    const qty = parseFloat(wizard.quantityProduced)
    if (!wizard.bomId || isNaN(qty) || qty <= 0) {
      toast.error('Please complete all required fields')
      return
    }

    setSubmitting(true)
    try {
      const run = await executeProductionRun(wizard)
      await queryClient.invalidateQueries({ queryKey: prKeys.all() })
      toast.success('Production run completed')
      if (navigator.onLine && run.id) {
        navigate(`/production-runs/${run.id}`)
      } else {
        navigate('/production-runs')
      }
    } catch (err) {
      let msg = 'Could not complete run. Check connection and try again.'
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          msg = `Not enough stock: ${err.message}`
        } else if (err.code === 'BOM_NOT_ACTIVE') {
          msg = 'This recipe is no longer active'
        } else {
          msg = err.message
        }
      }
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [wizard, navigate, queryClient, toast])

  return { step, wizard, submitting, updateWizard, goNext, goBack, submit }
}
