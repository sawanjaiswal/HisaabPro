import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { Turnstile } from '../../components/ui/Turnstile'
import { APP_NAME, AUTH_MODE } from '../../config/app.config'
import { useLogin } from './useLogin'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

const isDevMode = AUTH_MODE === 'dev-login'

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
    <div className="login-page space-y-6">
      <SEO title="Login" />

      <div className="login-page__card stagger-enter space-y-6">
        <div className="login-page__header space-y-6">
          <h1 className="login-page__title space-y-6">{APP_NAME}</h1>
          <p className="login-page__subtitle space-y-6">Sign in to your account</p>
        </div>

        <form
          className="login-page__form space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid && !loading) handleLogin()
          }}
        >
          <div className="login-page__field space-y-6">
            <label className="login-page__label space-y-6" htmlFor="identifier">
              {isDevMode ? 'Username' : 'Phone or Email'}
            </label>
            <div className="login-page__input-wrapper space-y-6">
              <input
                id="identifier"
                type="text"
                inputMode={isDevMode ? 'text' : 'tel'}
                className="login-page__input space-y-6"
                placeholder={isDevMode ? 'admin or demo' : 'Mobile number or email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="login-page__field space-y-6">
            <label className="login-page__label space-y-6" htmlFor="password">Password</label>
            <div className="login-page__input-wrapper space-y-6">
              <input
                id="password"
                type="password"
                className="login-page__input space-y-6"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="login-page__error space-y-6">{error}</p>}

          {captchaRequired && (
            <div className="login-page__captcha space-y-6">
              <Turnstile
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken('')}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-page__submit space-y-6"
            disabled={!isValid || loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          {showBiometric && (
            <button
              type="button"
              className="login-page__submit space-y-6"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', marginTop: 0 }}
              disabled={biometricLoading}
              onClick={handleBiometric}
            >
              {biometricLoading ? 'Authenticating…' : 'Use Fingerprint / Face ID'}
            </button>
          )}

          <p className="login-page__hint space-y-6">
            <Link to={ROUTES.FORGOT_PASSWORD} style={{ color: 'var(--color-primary-500)' }}>
              Forgot password?
            </Link>
          </p>
          <p className="login-page__hint space-y-6">
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
