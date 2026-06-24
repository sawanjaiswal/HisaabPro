import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SEO } from '../../components/layout/SEO'
import { useVerifyOtp } from './useVerifyOtp'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function VerifyOtpPage() {
  const {
    phone, otp, loading, error, shake,
    secondsLeft, resendCooldown, resending,
    inputRefs, formatTime,
    handleDigit, handleKeyDown, handlePaste, handleVerify, handleResend,
  } = useVerifyOtp()

  const isComplete = otp.every(d => d !== '')

  return (
    <div className="login-page">
      <SEO title="Verify OTP" />

      <div className="login-page__card stagger-enter">
        <Link to={ROUTES.REGISTER} className="auth-otp__back" aria-label="Back to registration">
          <ArrowLeft size={20} />
          <span>Change number</span>
        </Link>

        <div className="login-page__header">
          <h1 className="login-page__title">Verify OTP</h1>
          <p className="login-page__subtitle">
            Sent to +91 {phone.slice(0, 5)}XXXXX
          </p>
        </div>

        <div className="auth-otp">
          <div
            className="auth-otp__inputs"
            style={{ animation: shake ? 'shake 0.4s ease' : undefined }}
            onPaste={handlePaste}
          >
            {otp.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="auth-otp__digit"
                value={digit}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && <p className="auth-otp__error">{error}</p>}

          {loading && <p className="auth-otp__verifying">Verifying…</p>}

          <div className="auth-otp__resend">
            {secondsLeft > 0 && (
              <p className="auth-otp__cooldown">
                OTP expires in {formatTime(secondsLeft)}
              </p>
            )}
            {resendCooldown > 0 ? (
              <p className="auth-otp__cooldown">
                Resend in {resendCooldown}s
              </p>
            ) : (
              <Button variant="none"
                className="auth-otp__back"
                onClick={handleResend}
                disabled={resending}
                type="button"
              >
                {resending ? 'Sending…' : 'Resend OTP'}
              </Button>
            )}
          </div>

          <Button variant="none"
            className="login-page__submit"
            disabled={!isComplete || loading}
            onClick={handleVerify}
            type="button"
          >
            {loading ? 'Verifying…' : 'Verify & Create Account'}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
