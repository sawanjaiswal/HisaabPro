import { SEO } from '../../components/layout/SEO'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_NAME } from '../../config/app.config'
import { useLanguage } from '../../context/LanguageContext'
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
  const { t } = useLanguage()

  return (
    <div className="onboarding-page">
      <SEO title={t.onboardingTitle} />

      <div className="onboarding-card">
        <div className="onboarding-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>

        <div className="onboarding-header">
          <h1 className="onboarding-title">{t.onboardingTitle}</h1>
          <p className="onboarding-subtitle">
            {t.onboardingSubtitle.replace('{appName}', APP_NAME)}
          </p>
        </div>

        <form
          className="onboarding-form"
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          noValidate
        >
          <Input
            id="businessName"
            label={t.onboardingBusinessName}
            type="text"
            placeholder={t.onboardingBusinessNamePh}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={loading}
            autoFocus
            autoComplete="organization"
            maxLength={100}
            required
          />

          <div className="input-group">
            <label htmlFor="businessType" className="input-label">
              {t.onboardingBusinessType}
            </label>
            <select
              id="businessType"
              className="input onboarding-select"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loading}
              aria-label={t.onboardingBusinessType}
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t[type.labelKey]}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="phone"
            label={t.onboardingPhone}
            type="tel"
            placeholder={t.onboardingPhonePh}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            autoComplete="tel"
            maxLength={10}
            inputMode="numeric"
          />

          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!businessName.trim()}
            className="onboarding-submit"
            aria-label={loading ? t.onboardingSubmitting : t.onboardingSubmitAria}
          >
            {loading ? t.onboardingSubmitting : t.onboardingSubmit}
          </Button>
        </form>
      </div>
    </div>
  )
}
