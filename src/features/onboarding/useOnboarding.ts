/** Onboarding hook — wizard state, session draft, and business creation. */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { createBusiness } from '../business/business-session.service'
import { createSessionDraft } from '../../lib/session-draft'
import { ROUTES } from '../../config/routes.config'
import { ONBOARDING_STEP_ORDER } from './onboarding.constants'
import type {
  DataSource,
  OnboardingDraft,
  OnboardingStep,
  StartPath,
} from './onboarding.types'

/**
 * Setup is the one form a shopkeeper cannot skip, and the phone it runs on
 * kills backgrounded tabs. Without a draft, a call mid-wizard costs them every
 * answer and they start again at the welcome screen.
 */
const draft = createSessionDraft<OnboardingDraft>('hp_onboarding_draft')

type ResumableStep = OnboardingDraft['step']

/** `ready` means the business exists on the server — never resume into it. */
function resumeStep(saved: OnboardingDraft['step'] | undefined): ResumableStep {
  return saved && saved !== 'welcome' && ONBOARDING_STEP_ORDER.includes(saved) ? saved : 'welcome'
}

export function useOnboarding() {
  const { user, refreshActiveBusiness } = useAuth()
  const saved = draft.load()

  const [step, setStep] = useState<OnboardingStep>(() => resumeStep(saved.step))
  const [businessName, setBusinessName] = useState(saved.businessName ?? '')
  const [businessType, setBusinessType] = useState(saved.businessType ?? 'general')
  const [hasPickedType, setHasPickedType] = useState(saved.hasPickedType ?? false)
  const [phone, setPhone] = useState(saved.phone ?? user?.phone ?? '')
  const [businessLocation, setBusinessLocation] = useState(saved.businessLocation ?? '')
  const [dataSource, setDataSource] = useState<DataSource | undefined>(saved.dataSource)
  const [startPath, setStartPath] = useState<StartPath | undefined>(saved.startPath)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const navigate = useNavigate()

  // Written on every answer, not on step change: a shopkeeper interrupted while
  // typing the business name has still typed it.
  useEffect(() => {
    if (created || step === 'ready') return
    draft.save({
      step: step as ResumableStep,
      businessName,
      businessType,
      hasPickedType,
      phone,
      businessLocation,
      ...(dataSource ? { dataSource } : {}),
      ...(startPath ? { startPath } : {}),
    })
  }, [
    created, step, businessName, businessType, hasPickedType, phone,
    businessLocation, dataSource, startPath,
  ])

  const goTo = useCallback((next: OnboardingStep) => setStep(next), [])

  const goBack = useCallback(() => {
    setStep((current) => {
      const index = ONBOARDING_STEP_ORDER.indexOf(current)
      return ONBOARDING_STEP_ORDER[Math.max(0, index - 1)] ?? 'welcome'
    })
  }, [])

  const pickBusinessType = useCallback((type: string) => {
    setBusinessType(type)
    setHasPickedType(true)
  }, [])

  const mutation = useMutation({
    mutationFn: (payload: {
      name: string
      businessType: string
      phone?: string
      city?: string
    }) =>
      // createBusiness activates the new shop in the session as part of
      // creating it: the token, not the database, is what every business-scoped
      // route reads for businessId, and this user's was minted at registration
      // before the business existed.
      createBusiness(payload),
    onSuccess: async () => {
      // The new business isn't in AuthContext yet — ProtectedRoute gates on
      // `businesses.length` and would bounce goToDashboard() straight back
      // to /onboarding without this refetch.
      await refreshActiveBusiness()
      // The answers are on the server now; a stale draft would resurrect this
      // wizard the next time the shopkeeper adds a second business.
      draft.clear()
      setCreated(true)
      setStep('ready')
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to create business. Please try again.')
    },
  })

  const handleSubmit = useCallback(async () => {
    if (mutation.isPending) return
    if (!businessName.trim()) {
      setError('Business name is required')
      return
    }

    setError('')
    mutation.mutate({
      name: businessName.trim(),
      businessType,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      // Collected on step 2 and dropped until now. createBusinessSchema takes
      // `city`, and the invoice header reads it.
      ...(businessLocation.trim() ? { city: businessLocation.trim() } : {}),
    })
  }, [businessName, businessType, phone, businessLocation, mutation])

  /**
   * Where the wizard hands the shopkeeper off.
   *
   * "Import my existing data" is the recommended path, so the user most likely
   * to have a Tally/Vyapar/Excel file is the one who must not be dropped on an
   * empty dashboard — the answer they gave on step 5 decides the destination.
   */
  const goToDashboard = useCallback(() => {
    navigate(startPath === 'import' ? ROUTES.IMPORTS : ROUTES.DASHBOARD, { replace: true })
  }, [navigate, startPath])

  return {
    step,
    goTo,
    goBack,
    businessName,
    setBusinessName,
    businessType,
    pickBusinessType,
    hasPickedType,
    phone,
    setPhone,
    businessLocation,
    setBusinessLocation,
    dataSource,
    setDataSource,
    startPath,
    setStartPath,
    loading: mutation.isPending,
    error,
    created,
    handleSubmit,
    goToDashboard,
  }
}
