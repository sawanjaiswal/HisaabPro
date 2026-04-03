import { PIN_MAX_LENGTH } from './settings.constants'
import { useLanguage } from '@/hooks/useLanguage'
import { PinPad } from './components/PinPad'
import { usePinSetup } from './usePinSetup'
import './pin-setup.css'



export default function PinSetupPage() {
  const { t } = useLanguage()
  const {
    step,
    pin,
    confirmPin,
    error,
    isSubmitting,
    isOnboarding,
    pageTitle,
    stepTitle,
    stepSubtitle,
    showWeakWarning,
    showContinue,
    handleKeyPress,
    handleBackspace,
    handleContinue,
    handleConfirmKeyPress,
    handleConfirmBackspace,
    handleBack,
    handleSkip,
  } = usePinSetup()

  return (
    <div
      className="pin-screen stagger-enter"
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
        aria-label={t.goBack}
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
          {t.weakPinWarning}
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
          aria-label={t.continueToConfirmPin}
        >
          {t.continueBtn}
        </button>
      )}

      {/* Skip link — onboarding only */}
      {isOnboarding && step === 'enter' && (
        <button
          type="button"
          className="pin-forgot-link"
          onClick={handleSkip}
        >
          {t.skipSetUpLater}
        </button>
      )}
    </div>
  )
}
