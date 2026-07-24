import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { api, ApiError } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { ROUTES } from '@/config/routes.config'
import {
  type Step,
  OTP_TTL_SEC,
  RESEND_COOLDOWN_SEC,
  phoneRegex,
  maskPhone,
  formatTime,
} from './forgot-password.utils'
import './LoginPage.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SEC)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC)
  const [resending, setResending] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const submittingRef = useRef(false)

  useEffect(() => {
    if (step !== 'verify' || secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [step, secondsLeft])
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleSendOtp = async () => {
    if (submittingRef.current || loading) return
    submittingRef.current = true
    setError('')
    setLoading(true)
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        offlineQueue: false,
      })
      setStep('verify')
      setSecondsLeft(OTP_TTL_SEC)
      setResendCooldown(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failedSendOtp)
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }
  const handleDigit = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    setError('')
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
  }, [otp])
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }, [otp])
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      inputRefs.current[5]?.focus()
    }
  }, [])
  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }
  const handleReset = async () => {
    if (submittingRef.current || loading) return
    const code = otp.join('')
    if (code.length < 6) return
    if (newPassword !== confirmPassword) { setError(t.passwordsNoMatch); return }
    if (newPassword.length < 6) { setError(t.passwordMin6); return }
    submittingRef.current = true
    setError('')
    setLoading(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: code, newPassword }),
        offlineQueue: false,
      })
      setStep('success')
    } catch (err) {
      triggerShake()
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setError(err instanceof ApiError ? err.message : t.resetFailed)
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError('')
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        offlineQueue: false,
      })
      setSecondsLeft(OTP_TTL_SEC)
      setResendCooldown(RESEND_COOLDOWN_SEC)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failedResendOtp)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="login-page">
      <SEO title={t.resetPassword} />
      <div className="login-page__card stagger-enter">
        {step === 'phone' && (
          <>
            <div className="login-page__header">
              <h1 className="login-page__title">{APP_NAME}</h1>
              <p className="login-page__subtitle">{t.resetYourPassword}</p>
            </div>
            <form className="login-page__form" onSubmit={(e) => { e.preventDefault(); if (phoneRegex.test(phone) && !loading) handleSendOtp() }}>
              <div className="login-page__field">
                <label className="login-page__label" htmlFor="phone">{t.registeredMobile}</label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  className="login-page__input"
                  placeholder={t.mobileNumberHint}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                />
              </div>
              {error && <p className="login-page__error">{error}</p>}
              <Button variant="none" type="submit" className="login-page__submit" disabled={!phoneRegex.test(phone) || loading}>
                {loading ? t.sendingOtp : t.sendOtp}
              </Button>
              <p className="login-page__hint">
                <Link to={ROUTES.LOGIN} className="login-page__link">{t.backToSignIn}</Link>
              </p>
            </form>
          </>
        )}
        {step === 'verify' && (
          <>
            <div className="login-page__header">
              <h1 className="login-page__title">{t.enterOtp}</h1>
              <p className="login-page__subtitle">{t.sentTo} {maskPhone(phone)}</p>
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
              <div className="login-page__field" style={{ marginTop: 'var(--space-2)' }}>
                <label className="login-page__label" htmlFor="newPassword">{t.newPasswordLabel}</label>
                <Input id="newPassword" type="password" className="login-page__input" placeholder={t.min6CharsHint} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="login-page__field">
                <label className="login-page__label" htmlFor="confirmPassword">{t.confirmPassword}</label>
                <Input id="confirmPassword" type="password" className="login-page__input" placeholder={t.repeatPasswordHint} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <p className="auth-otp__error">{error}</p>}
              <div className="auth-otp__resend">
                {secondsLeft > 0 && <p className="auth-otp__cooldown">{t.otpExpiresIn} {formatTime(secondsLeft)}</p>}
                {resendCooldown > 0
                  ? <p className="auth-otp__cooldown">{t.resendIn} {resendCooldown}s</p>
                  : <Button variant="none" className="auth-otp__back" onClick={handleResend} disabled={resending} type="button">{resending ? t.sending : t.resendOtp}</Button>
                }
              </div>
              <Button variant="none"
                className="login-page__submit"
                disabled={otp.join('').length < 6 || !newPassword || !confirmPassword || loading}
                onClick={handleReset}
                type="button"
              >
                {loading ? t.resetting : t.resetPassword}
              </Button>
            </div>
          </>
        )}
        {step === 'success' && (
          <>
            <div className="login-page__header">
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 'var(--space-2)' }}>✓</div>
              <h1 className="login-page__title" style={{ fontSize: 'var(--fs-2xl)' }}>{t.passwordResetDone}</h1>
              <p className="login-page__subtitle">{t.passwordResetDesc}</p>
            </div>
            <Button variant="none" className="login-page__submit" onClick={() => navigate(ROUTES.LOGIN, { replace: true })} type="button">
              {t.signIn}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
