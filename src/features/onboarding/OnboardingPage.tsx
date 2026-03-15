import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { BUSINESS_TYPES } from './onboarding.constants'
import { useOnboarding } from './useOnboarding'
import './onboarding.css'

export default function OnboardingPage() {
  const {
    businessName, setBusinessName,
    businessType, setBusinessType,
    phone, setPhone,
    loading, error,
    handleSubmit,
  } = useOnboarding()

  return (
    <div className="onboarding-page">
      <SEO title="Set Up Your Business" />

      <div className="onboarding-page__card">
        <div className="onboarding-page__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>

        <div className="onboarding-page__header">
          <h1 className="onboarding-page__title">Set up your business</h1>
          <p className="onboarding-page__subtitle">
            Welcome to {APP_NAME}. Enter your business details to get started.
          </p>
        </div>

        <form
          className="onboarding-form"
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          noValidate
        >
          <div className="onboarding-form__field">
            <label htmlFor="businessName" className="onboarding-form__label onboarding-form__label--required">
              Business Name
            </label>
            <input
              id="businessName"
              type="text"
              className="onboarding-form__input"
              placeholder="e.g. Raju General Store"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="organization"
              maxLength={100}
              required
            />
          </div>

          <div className="onboarding-form__field">
            <label htmlFor="businessType" className="onboarding-form__label">
              Business Type
            </label>
            <select
              id="businessType"
              className="onboarding-form__select"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loading}
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="onboarding-form__field">
            <label htmlFor="phone" className="onboarding-form__label">
              Business Phone (optional)
            </label>
            <input
              id="phone"
              type="tel"
              className="onboarding-form__input"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="tel"
              maxLength={10}
              inputMode="numeric"
            />
          </div>

          {error && (
            <p className="onboarding-form__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="onboarding-form__submit"
            disabled={loading || !businessName.trim()}
            aria-label={loading ? 'Setting up your business…' : 'Get Started'}
          >
            {loading ? 'Setting up…' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}
