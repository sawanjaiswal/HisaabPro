import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { Turnstile } from '../../components/ui/Turnstile'
import { APP_NAME } from '../../config/app.config'
import { useLogin } from './useLogin'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

export default function LoginPage() {
  const {
    identifier, setIdentifier,
    password, setPassword,
    loading, error,
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
            <label className="login-page__label" htmlFor="identifier">Phone or Email</label>
            <div className="login-page__input-wrapper">
              <input
                id="identifier"
                type="text"
                inputMode="tel"
                className="login-page__input"
                placeholder="Mobile number or email"
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
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

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
