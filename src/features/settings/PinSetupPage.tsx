import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH } from './settings.constants'
import { isWeakPin } from './settings.utils'
import { PinPad } from './components/PinPad'
import './settings.css'

type SetupStep = 'enter' | 'confirm'

const WEAK_PIN_WARNING =
  'This PIN is too simple. Consider using a stronger PIN.'

export default function PinSetupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === '1'

  const [step, setStep] = useState<SetupStep>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setActivePin = step === 'enter' ? setPin : setConfirmPin

  const hasExistingPin = searchParams.get('change') === '1'
  const pageTitle = hasExistingPin ? 'Change PIN' : 'Set PIN'

  const stepTitle =
    step === 'enter' ? 'Enter a new PIN' : 'Confirm your PIN'
  const stepSubtitle =
    step === 'enter'
      ? 'Choose a 4–6 digit PIN to protect your app'
      : 'Re-enter your PIN to confirm'

  // ─── Auto-advance at max length ──────────────────────────────────────────

  const handleKeyPress = useCallback(
    (digit: string) => {
      setError(null)
      setActivePin((prev) => {
        const next = prev + digit
        if (next.length === PIN_MAX_LENGTH && step === 'enter') {
          // auto-advance: defer state updates to avoid double-set
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

      setIsSubmitting(true)
      try {
        const API_URL = import.meta.env.VITE_API_URL as string
        const res = await fetch(`${API_URL}/settings/pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin }),
        })
        if (!res.ok) throw new Error('Failed to save PIN')
        navigate(ROUTES.SETTINGS)
      } catch {
        setError('Failed to save PIN. Please try again.')
        setConfirmPin('')
      } finally {
        setIsSubmitting(false)
      }
    },
    [pin, navigate],
  )

  // ─── When confirm pad reaches min length and user taps digit that brings
  //     it to full length — submit automatically ────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

  // Back arrow resets to enter step from confirm, or navigates away from enter
  const handleBack = () => {
    if (step === 'confirm') {
      setStep('enter')
      setConfirmPin('')
      setError(null)
    } else {
      navigate(ROUTES.SETTINGS)
    }
  }

  const showWeakWarning = step === 'enter' && pin.length >= PIN_MIN_LENGTH && isWeakPin(pin)
  const showContinue =
    step === 'enter' &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length < PIN_MAX_LENGTH

  return (
    <div
      className="pin-screen"
      style={{ position: 'relative' }}
      aria-label={pageTitle}
    >
      {/* Back button — top-left */}
      <button
        type="button"
        onClick={handleBack}
        style={{
          position: 'absolute',
          top: 'var(--space-5)',
          left: 'var(--space-4)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-gray-600)',
          minHeight: '44px',
          minWidth: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.375rem',
        }}
        aria-label="Go back"
      >
        &#8592;
      </button>

      {step === 'enter' ? (
        <PinPad
          key="enter"
          length={PIN_MAX_LENGTH}
          value={pin}
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          title={stepTitle}
          subtitle={stepSubtitle}
          error={error ?? undefined}
        />
      ) : (
        <PinPad
          key="confirm"
          length={pin.length}
          value={confirmPin}
          onKeyPress={handleConfirmKeyPress}
          onBackspace={handleConfirmBackspace}
          title={stepTitle}
          subtitle={stepSubtitle}
          error={error ?? undefined}
        />
      )}

      {/* Weak PIN warning — below the PinPad dots, non-blocking */}
      {showWeakWarning && (
        <p
          role="status"
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-warning-600, #d97706)',
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: '1.4',
            marginTop: 'calc(var(--space-3) * -1)',
          }}
        >
          {WEAK_PIN_WARNING}
        </p>
      )}

      {/* Manual Continue button (between min and max-1 digits) */}
      {showContinue && (
        <button
          type="button"
          onClick={handleContinue}
          disabled={isSubmitting}
          style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-8)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary-500)',
            color: 'var(--color-gray-0, #fff)',
            border: 'none',
            fontFamily: 'var(--font-primary)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '48px',
          }}
          aria-label="Continue to confirm PIN"
        >
          Continue
        </button>
      )}

      {/* Skip link — onboarding only */}
      {isOnboarding && step === 'enter' && (
        <button
          type="button"
          className="pin-forgot-link"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        >
          Skip — set up later
        </button>
      )}
    </div>
  )
}
