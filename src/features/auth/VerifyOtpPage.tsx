import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SEO } from '../../components/layout/SEO'
import { useVerifyOtp } from './useVerifyOtp'
import { useLanguage } from '@/context/LanguageContext'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function VerifyOtpPage() {
  const { t } = useLanguage()
  const {
    phone, otp, loading, error, shake,
    secondsLeft, resendCooldown, resending,
    inputRefs, formatTime,
    handleDigit, handleKeyDown, handlePaste, handleVerify, handleResend,
  } = useVerifyOtp()

  const isComplete = otp.every(d => d !== '')

  return (
    <div className="login-page">
      <SEO title={t.verifyOtp} />

      <div className="login-page__card stagger-enter">
        <Link to={ROUTES.REGISTER} className="auth-otp__back" aria-label={t.backToRegistration}>
          <ArrowLeft size={20} />
          <span>{t.changeNumber}</span>
        </Link>

        <div className="login-page__header">
          <h1 className="login-page__title">{t.verifyOtp}</h1>
          <p className="login-page__subtitle">
            {t.sentTo} +91 {phone.slice(0, 5)}XXXXX
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

          {loading && <p className="auth-otp__verifying">{t.verifying}</p>}

          <div className="auth-otp__resend">
            {secondsLeft > 0 && (
              <p className="auth-otp__cooldown">
                {t.otpExpiresIn} {formatTime(secondsLeft)}
              </p>
            )}
            {resendCooldown > 0 ? (
              <p className="auth-otp__cooldown">
                {t.resendIn} {resendCooldown}s
              </p>
            ) : (
              <Button variant="none"
                className="auth-otp__back"
                onClick={handleResend}
                disabled={resending}
                type="button"
              >
                {resending ? t.sending : t.resendOtp}
              </Button>
            )}
          </div>

          <Button variant="none"
            className="login-page__submit"
            disabled={!isComplete || loading}
            onClick={handleVerify}
            type="button"
          >
            {loading ? t.verifying : t.verifyAndCreate}
          </Button>
        </div>
      </div>
    </div>
  )
}
