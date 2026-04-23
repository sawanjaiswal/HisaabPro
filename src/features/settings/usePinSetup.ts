import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH } from './settings.constants'
import { setPin as setPinApi } from './security.service'
import { isWeakPin } from './settings.utils'

type SetupStep = 'enter' | 'confirm'

export function usePinSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isOnboarding = searchParams.get('onboarding') === '1'
  const hasExistingPin = searchParams.get('change') === '1'

  const [step, setStep] = useState<SetupStep>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setActivePin = step === 'enter' ? setPin : setConfirmPin

  const pageTitle = hasExistingPin ? 'Change PIN' : 'Set PIN'
  const stepTitle =
    step === 'enter' ? 'Enter a new PIN' : 'Confirm your PIN'
  const stepSubtitle =
    step === 'enter'
      ? 'Choose a 4–6 digit PIN to protect your app'
      : 'Re-enter your PIN to confirm'

  const showWeakWarning =
    step === 'enter' && pin.length >= PIN_MIN_LENGTH && isWeakPin(pin)
  const showContinue =
    step === 'enter' &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length < PIN_MAX_LENGTH

  // ─── Auto-advance at max length ──────────────────────────────────────────

  const handleKeyPress = useCallback(
    (digit: string) => {
      setError(null)
      setActivePin((prev) => {
        const next = prev + digit
        if (next.length === PIN_MAX_LENGTH && step === 'enter') {
          setTimeout(() => {
            setStep('confirm')
            setPin(next)
          }, 0)
          return next
        }
        return next
      })
    },
    [step, setActivePin],
  )

  const handleBackspace = useCallback(() => {
    setError(null)
    setActivePin((prev) => prev.slice(0, -1))
  }, [setActivePin])

  // ─── Continue button (manual advance between min and max-1) ──────────────

  const handleContinue = useCallback(() => {
    if (step === 'enter') {
      setStep('confirm')
    }
  }, [step])

  // ─── Submit (after confirm step) ─────────────────────────────────────────

  const handleConfirmComplete = useCallback(
    async (finalConfirm: string) => {
      if (finalConfirm !== pin) {
        setError("PINs don't match")
        setConfirmPin('')
        return
      }

      if (!user?.id) {
        setError('Not signed in')
        setConfirmPin('')
        return
      }

      setIsSubmitting(true)
      try {
        await setPinApi(user.id, { newPin: pin })
        navigate(ROUTES.SETTINGS)
      } catch {
        setError('Failed to save PIN. Please try again.')
        setConfirmPin('')
      } finally {
        setIsSubmitting(false)
      }
    },
    [pin, navigate, user?.id],
  )

  // ─── Confirm pad auto-submit at matching length ──────────────────────────

  const handleConfirmKeyPress = useCallback(
    (digit: string) => {
      setError(null)
      const next = confirmPin + digit
      setConfirmPin(next)
      if (next.length === pin.length && next.length >= PIN_MIN_LENGTH) {
        void handleConfirmComplete(next)
      }
    },
    [confirmPin, pin.length, handleConfirmComplete],
  )

  const handleConfirmBackspace = useCallback(() => {
    setError(null)
    setConfirmPin((prev) => prev.slice(0, -1))
  }, [])

  // ─── Back navigation ────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (step === 'confirm') {
      setStep('enter')
      setConfirmPin('')
      setError(null)
    } else {
      navigate(ROUTES.SETTINGS)
    }
  }, [step, navigate])

  const handleSkip = useCallback(() => {
    navigate(ROUTES.DASHBOARD)
  }, [navigate])

  return {
    // State
    step,
    pin,
    confirmPin,
    error,
    isSubmitting,

    // Derived
    isOnboarding,
    pageTitle,
    stepTitle,
    stepSubtitle,
    showWeakWarning,
    showContinue,

    // Handlers
    handleKeyPress,
    handleBackspace,
    handleContinue,
    handleConfirmKeyPress,
    handleConfirmBackspace,
    handleBack,
    handleSkip,
  }
}
