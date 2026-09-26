import { Text } from '@/components/ui/Text'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api, ApiError } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { ROUTES } from '@/config/routes.config'
import {
  type Step,
  OTP_TTL_SEC,
  RESEND_COOLDOWN_SEC,
  maskPhone,
  maskEmail,
  formatTime,
} from './forgot-password.utils'
import './LoginPage.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('email')
  const [identifier, setIdentifier] = useState('')
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

  const isEmail = identifier.includes('@')

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
    const clean = identifier.trim()
    if (!clean) {
      setError('Please enter your email address or mobile number.')
      return
    }
    submittingRef.current = true
    setError('')
    setLoading(true)
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(isEmail ? { email: clean } : { phone: clean }),
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
      const clean = identifier.trim()
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          ...(isEmail ? { email: clean } : { phone: clean }),
          otp: code,
          newPassword,
        }),
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
      const clean = identifier.trim()
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(isEmail ? { email: clean } : { phone: clean }),
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
        {(step === 'email' || step === 'phone') && (
          <>
            <div className="login-page__header">
              <BrandLogo
                variant="horizontal"
                size={48}
                className="login-page__brand-logo"
                style={{ maxWidth: '210px', height: 'auto', margin: '0 auto 8px auto', display: 'block' }}
              />
              <Heading level={1} className="login-page__title sr-only">{APP_NAME}</Heading>
              <Text className="login-page__subtitle">{t.resetYourPassword}</Text>
            </div>
            <form className="login-page__form" onSubmit={(e) => { e.preventDefault(); if (!loading) handleSendOtp() }}>
              <div className="login-page__field">
                <label className="login-page__label" htmlFor="identifier">Registered Email Address</label>
                <Input
                  id="identifier"
                  type="email"
                  className="login-page__input"
                  placeholder="you@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <Text className="login-page__error">{error}</Text>}
              <Button variant="none" type="submit" className="login-page__submit" disabled={!identifier.trim() || loading}>
                {loading ? 'Sending code...' : 'Send Recovery Code'}
              </Button>
              <Text className="login-page__hint">
                <Link to={ROUTES.LOGIN} className="login-page__link">{t.backToSignIn}</Link>
              </Text>
            </form>
          </>
        )}
        {step === 'verify' && (
          <>
            <div className="login-page__header">
              <Heading level={1} className="login-page__title">{t.enterOtp}</Heading>
              <Text className="login-page__subtitle">
                {t.sentTo} {isEmail ? maskEmail(identifier) : maskPhone(identifier)}
              </Text>
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
              {error && <Text className="auth-otp__error">{error}</Text>}
              <div className="auth-otp__resend">
                {secondsLeft > 0 && <Text className="auth-otp__cooldown">{t.otpExpiresIn} {formatTime(secondsLeft)}</Text>}
                {resendCooldown > 0
                  ? <Text className="auth-otp__cooldown">{t.resendIn} {resendCooldown}s</Text>
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
              <Heading level={1} className="login-page__title" style={{ fontSize: 'var(--fs-2xl)' }}>{t.passwordResetDone}</Heading>
              <Text className="login-page__subtitle">{t.passwordResetDesc}</Text>
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
