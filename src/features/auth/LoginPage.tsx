import { SEO } from '../../components/layout/SEO'
import { Turnstile } from '../../components/ui/Turnstile'
import { APP_NAME, IS_DEV } from '../../config/app.config'
import { useLogin } from './useLogin'
import './LoginPage.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function LoginPage() {
  const { t } = useLanguage()
  const {
    username, setUsername,
    password, setPassword,
    loading, error,
    captchaRequired, setCaptchaToken,
    handleLogin,
  } = useLogin()

  const isValid = username.trim().length > 0 && password.length > 0

  return (
    <div className="login-page">
      <SEO title="Login" />

      <div className="login-page__card">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">{t.signInSubtitle}</p>
        </div>

        <form
          className="login-page__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid && !loading) handleLogin()
          }}
        >
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="username">{t.username}</label>
            <div className="login-page__input-wrapper">
              <input
                id="username"
                type="text"
                className="login-page__input"
                placeholder={t.enterUsername}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                placeholder={t.enterPassword}
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
            aria-label={t.signIn}
          >
            {loading ? t.signingIn : t.signIn}
          </button>

          {IS_DEV && (
            <p className="login-page__hint">
              Dev accounts: admin / admin123 or demo / demo123
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

// --- OTP-based login (commented out for dev, restore for production) ---
// import { PhoneStep } from './components/PhoneStep'
// import { OtpStep } from './components/OtpStep'
