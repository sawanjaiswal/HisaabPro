import { useRef, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { OTP_LENGTH } from '../auth.constants'
import { useLanguage } from '@/hooks/useLanguage'

interface OtpStepProps {
  phone: string
  otp: string
  onOtpChange: (value: string) => void
  onSubmit: () => void
  onResend: () => void
  onBack: () => void
  loading: boolean
  error: string
  resendCooldown: number
}

export function OtpStep({
  phone,
  otp,
  onOtpChange,
  onSubmit,
  onResend,
  onBack,
  loading,
  error,
  resendCooldown,
}: OtpStepProps) {
  const { t } = useLanguage()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Auto-submit when all digits entered
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !loading) {
      onSubmit()
    }
  }, [otp, loading, onSubmit])

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return

    const digits = otp.split('')
    digits[index] = value
    const newOtp = digits.join('').slice(0, OTP_LENGTH)
    onOtpChange(newOtp)

    // Auto-advance to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const digits = otp.split('')
      digits[index - 1] = ''
      onOtpChange(digits.join(''))
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    onOtpChange(pasted)
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()
  }

  const maskedPhone = `${phone.slice(0, 2)}****${phone.slice(-4)}`

  return (
    <div className="auth-otp">
      <button
        type="button"
        onClick={onBack}
        className="auth-otp__back"
        aria-label={t.goBackPhoneInput}
      >
        <ArrowLeft size={20} />
        <span>Change number</span>
      </button>

      <p className="auth-otp__info">
        Enter the 6-digit code sent to <strong>{maskedPhone}</strong>
      </p>

      <div className="auth-otp__inputs" onPaste={handlePaste}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={otp[i] || ''}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            className="auth-otp__digit"
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>

      {error && <p className="auth-otp__error">{error}</p>}

      {loading && <p className="auth-otp__verifying">Verifying...</p>}

      <div className="auth-otp__resend">
        {resendCooldown > 0 ? (
          <span className="auth-otp__cooldown">Resend OTP in {resendCooldown}s</span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onResend} disabled={loading}>
            Resend OTP
          </Button>
        )}
      </div>
    </div>
  )
}
