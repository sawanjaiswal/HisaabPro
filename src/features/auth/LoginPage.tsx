import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { Turnstile } from '../../components/ui/Turnstile'
import { APP_NAME, AUTH_MODE } from '../../config/app.config'
import { useLogin } from './useLogin'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

const isDevMode = AUTH_MODE === 'dev-login'

const TIPS = [
  { icon: '🧾', text: 'Send GST-ready invoices via WhatsApp in seconds' },
  { icon: '📦', text: 'Track stock levels and get low-inventory alerts' },
  { icon: '📴', text: 'Works fully offline — syncs automatically when back online' },
  { icon: '💸', text: 'Accept UPI, cash, and card payments in one place' },
  { icon: '📊', text: 'Daily, weekly, and monthly business reports at a glance' },
  { icon: '🖨️', text: 'Print on 58mm and 80mm thermal printers instantly' },
]

function LoginTips({ visible }: { visible: boolean }) {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % TIPS.length)
        setFading(false)
      }, 300)
    }, 3_000)
    return () => clearInterval(id)
  }, [visible])

  if (!visible) return null

  const tip = TIPS[index]
  return (
    <div className="login-tips" aria-live="polite">
      <div className={`login-tips__card${fading ? ' login-tips__card--fade' : ''}`}>
        <span className="login-tips__icon">{tip.icon}</span>
        <p className="login-tips__text">{tip.text}</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const {
    identifier, setIdentifier,
    password, setPassword,
    loading, isRetrying, error,
    captchaRequired, setCaptchaToken,
    handleLogin,
    showBiometric, biometricLoading, handleBiometric,
  } = useLogin()

  const isValid = identifier.trim().length > 0 && password.length > 0

  return (
    <div className="login-page">
      <SEO title="Login" />

      <div className="login-page__card stagger-enter">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">Sign in to your account</p>
        </div>

        <form
          className="login-page__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid && !loading) handleLogin()
          }}
        >
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="identifier">
              {isDevMode ? 'Username' : 'Phone or Email'}
            </label>
            <div className="login-page__input-wrapper">
              <input
                id="identifier"
                type="text"
                inputMode={isDevMode ? 'text' : 'tel'}
                className="login-page__input"
                placeholder={isDevMode ? 'admin or demo' : 'Mobile number or email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="password">Password</label>
            <div className="login-page__input-wrapper">
              <input
                id="password"
                type="password"
                className="login-page__input"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="login-page__error">{error}</p>}

          {captchaRequired && (
            <div className="login-page__captcha">
              <Turnstile
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken('')}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-page__submit"
            disabled={!isValid || loading}
          >
            {isRetrying ? 'Connecting to server…' : loading ? 'Signing in…' : 'Sign In'}
          </button>

          <LoginTips visible={isRetrying} />

          {showBiometric && (
            <button
              type="button"
              className="login-page__submit"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', marginTop: 0 }}
              disabled={biometricLoading}
              onClick={handleBiometric}
            >
              {biometricLoading ? 'Authenticating…' : 'Use Fingerprint / Face ID'}
            </button>
          )}

          <p className="login-page__hint">
            <Link to={ROUTES.FORGOT_PASSWORD} style={{ color: 'var(--color-primary-500)' }}>
              Forgot password?
            </Link>
          </p>
          <p className="login-page__hint">
            New here?{' '}
            <Link to={ROUTES.REGISTER} style={{ color: 'var(--color-primary-500)' }}>
              Create account
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
