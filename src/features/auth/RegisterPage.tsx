import { Link } from 'react-router-dom'
import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { useRegister } from './useRegister'
import { ROUTES } from '@/config/routes.config'
import './LoginPage.css'

const phoneRegex = /^[6-9]\d{9}$/

export default function RegisterPage() {
  const {
    name, setName,
    phone, setPhone,
    password, setPassword,
    loading, error,
    handleRegister,
  } = useRegister()

  const isValid = name.trim().length > 0 && phoneRegex.test(phone) && password.length >= 6

  return (
    <div className="login-page">
      <SEO title="Create Account" />

      <div className="login-page__card stagger-enter">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">Create your free account</p>
        </div>

        <form
          className="login-page__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid && !loading) handleRegister()
          }}
        >
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="name">Full Name</label>
            <div className="login-page__input-wrapper">
              <input
                id="name"
                type="text"
                className="login-page__input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="phone">Mobile Number</label>
            <div className="login-page__input-wrapper">
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                className="login-page__input"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="tel"
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p className="login-page__error">{error}</p>}

          <button
            type="submit"
            className="login-page__submit"
            disabled={!isValid || loading}
          >
            {loading ? 'Sending OTP…' : 'Continue'}
          </button>

          <p className="login-page__hint">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} style={{ color: 'var(--color-primary-500)' }}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
