import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { Turnstile } from '../../components/ui/Turnstile'
import { APP_NAME, AUTH_MODE } from '../../config/app.config'
import { useLogin } from './useLogin'
import { useLanguage } from '@/context/LanguageContext'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

const isDevMode = AUTH_MODE === 'dev-login'

function LoginTips({ visible }: { visible: boolean }) {
  const { t } = useLanguage()
  const tips = useMemo(() => [
    { icon: '🧾', text: t.loginTip1 },
    { icon: '📦', text: t.loginTip2 },
    { icon: '📴', text: t.loginTip3 },
    { icon: '💸', text: t.loginTip4 },
    { icon: '📊', text: t.loginTip5 },
    { icon: '🖨️', text: t.loginTip6 },
  ], [t])
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % tips.length)
        setFading(false)
      }, 300)
    }, 3_000)
    return () => clearInterval(id)
  }, [visible, tips.length])

  if (!visible) return null

  const tip = tips[index]
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
  const { t } = useLanguage()
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
      <SEO title={t.login} />

      <div className="login-page__card stagger-enter">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">{t.signInToAccount}</p>
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
              {isDevMode ? t.username : t.phoneOrEmail}
            </label>
            <div className="login-page__input-wrapper">
              <input
                id="identifier"
                type="text"
                inputMode={isDevMode ? 'text' : 'tel'}
                className="login-page__input"
                placeholder={isDevMode ? t.adminOrDemoHint : t.mobileOrEmailHint}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="password">{t.password}</label>
            <div className="login-page__input-wrapper">
              <input
                id="password"
                type="password"
                className="login-page__input"
                placeholder={t.yourPasswordHint}
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
            {isRetrying ? t.connectingToServer : loading ? t.signingIn : t.signIn}
          </button>

          <LoginTips visible={isRetrying} />

          {showBiometric && (
            <button
              type="button"
              className="login-page__submit login-page__submit--biometric"
              disabled={biometricLoading}
              onClick={handleBiometric}
            >
              {biometricLoading ? t.authenticating : t.useBiometric}
            </button>
          )}

          <p className="login-page__hint">
            <Link to={ROUTES.FORGOT_PASSWORD} className="login-page__link">
              {t.forgotPassword}
            </Link>
          </p>
          <p className="login-page__hint">
            {t.newHere}{' '}
            <Link to={ROUTES.REGISTER} className="login-page__link">
              {t.createAccount}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
