import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { api, ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

type Step = 'phone' | 'verify' | 'success'

const OTP_TTL_SEC = 5 * 60
const RESEND_COOLDOWN_SEC = 30
const phoneRegex = /^[6-9]\d{9}$/

function maskPhone(phone: string) {
  return `+91 ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP.')
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
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
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
      setError(err instanceof ApiError ? err.message : 'Reset failed. Please try again.')
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
      setError(err instanceof ApiError ? err.message : 'Failed to resend OTP.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="login-page space-y-6">
      <SEO title="Reset Password" />
      <div className="login-page__card stagger-enter space-y-6">
        {step === 'phone' && (
          <>
            <div className="login-page__header space-y-6">
              <h1 className="login-page__title space-y-6">{APP_NAME}</h1>
              <p className="login-page__subtitle space-y-6">Reset your password</p>
            </div>
            <form className="login-page__form space-y-6" onSubmit={(e) => { e.preventDefault(); if (phoneRegex.test(phone) && !loading) handleSendOtp() }}>
              <div className="login-page__field space-y-6">
                <label className="login-page__label space-y-6" htmlFor="phone">Registered Mobile Number</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  className="login-page__input space-y-6"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                />
              </div>
              {error && <p className="login-page__error space-y-6">{error}</p>}
              <button type="submit" className="login-page__submit space-y-6" disabled={!phoneRegex.test(phone) || loading}>
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
              <p className="login-page__hint space-y-6">
                <Link to={ROUTES.LOGIN} style={{ color: 'var(--color-primary-500)' }}>Back to Sign In</Link>
              </p>
            </form>
          </>
        )}
        {step === 'verify' && (
          <>
            <div className="login-page__header space-y-6">
              <h1 className="login-page__title space-y-6">Enter OTP</h1>
              <p className="login-page__subtitle space-y-6">Sent to {maskPhone(phone)}</p>
            </div>
            <div className="auth-otp">
              <div
                className="auth-otp__inputs"
                style={{ animation: shake ? 'shake 0.4s ease' : undefined }}
                onPaste={handlePaste}
              >
                {otp.map((digit, i) => (
                  <input
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
              <div className="login-page__field space-y-6" style={{ marginTop: 'var(--space-2)' }}>
                <label className="login-page__label space-y-6" htmlFor="newPassword">New Password</label>
                <input id="newPassword" type="password" className="login-page__input space-y-6" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="login-page__field space-y-6">
                <label className="login-page__label space-y-6" htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" className="login-page__input space-y-6" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <p className="auth-otp__error">{error}</p>}
              <div className="auth-otp__resend">
                {secondsLeft > 0 && <p className="auth-otp__cooldown">OTP expires in {formatTime(secondsLeft)}</p>}
                {resendCooldown > 0
                  ? <p className="auth-otp__cooldown">Resend in {resendCooldown}s</p>
                  : <button className="auth-otp__back" onClick={handleResend} disabled={resending} type="button">{resending ? 'Sending…' : 'Resend OTP'}</button>
                }
              </div>
              <button
                className="login-page__submit space-y-6"
                disabled={otp.join('').length < 6 || !newPassword || !confirmPassword || loading}
                onClick={handleReset}
                type="button"
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
        {step === 'success' && (
          <>
            <div className="login-page__header space-y-6">
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 'var(--space-2)' }}>✓</div>
              <h1 className="login-page__title space-y-6" style={{ fontSize: 'var(--fs-2xl)' }}>Password Reset!</h1>
              <p className="login-page__subtitle space-y-6">Your password has been updated. All devices have been signed out.</p>
            </div>
            <button className="login-page__submit space-y-6" onClick={() => navigate(ROUTES.LOGIN, { replace: true })} type="button">
              Sign In
            </button>
          </>
        )}
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
