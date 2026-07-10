import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SEO } from '../../components/layout/SEO'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_NAME } from '../../config/app.config'
import { useLanguage } from '../../context/LanguageContext'
import type { BusinessType } from '@/config/verticals.config'
import { VerticalPicker } from './components/VerticalPicker'
import { useOnboarding } from './useOnboarding'
import './onboarding.css'

type Step = 'welcome' | 'pickType' | 'setup'

const ICON_INVOICE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)
const ICON_PARTY = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const ICON_PAYMENT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)
const ICON_REPORT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome')
  const [hasPickedType, setHasPickedType] = useState(false)
  const {
    businessName, setBusinessName,
    businessType, setBusinessType,
    phone, setPhone,
    loading, error,
    handleSubmit,
  } = useOnboarding()
  const { t } = useLanguage()

  const features = [
    { icon: ICON_INVOICE, title: t.onboardingFeatureInvoiceTitle, desc: t.onboardingFeatureInvoiceDesc },
    { icon: ICON_PARTY,   title: t.onboardingFeaturePartyTitle,   desc: t.onboardingFeaturePartyDesc },
    { icon: ICON_PAYMENT, title: t.onboardingFeaturePaymentTitle, desc: t.onboardingFeaturePaymentDesc },
    { icon: ICON_REPORT,  title: t.onboardingFeatureReportTitle,  desc: t.onboardingFeatureReportDesc },
  ]
  const welcomeTitle = t.onboardingWelcomeTitle.replace('{appName}', APP_NAME)

  if (step === 'welcome') {
    return (
      <div className="onboarding-page space-y-6">
        <SEO title={welcomeTitle} />
        <div className="onboarding-card stagger-enter onboarding-welcome-card">
          <div className="onboarding-icon onboarding-welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="onboarding-welcome-icon__svg">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>

          <div className="onboarding-header">
            <h1 className="onboarding-title">{welcomeTitle}</h1>
            <p className="onboarding-subtitle">{t.onboardingWelcomeSubtitle}</p>
          </div>

          <div className="onboarding-feature-list">
            {features.map((f) => (
              <div key={f.title} className="onboarding-feature-row">
                <div className="onboarding-feature-icon">{f.icon}</div>
                <div>
                  <p className="onboarding-feature-title">{f.title}</p>
                  <p className="onboarding-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="onboarding-submit"
            onClick={() => setStep('pickType')}
          >
            {t.onboardingGetStarted}
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'pickType') {
    return (
      <div className="onboarding-page space-y-6">
        <SEO title={t.pickBusinessType} />
        <div className="onboarding-card stagger-enter onboarding-card--scrollable">
          <div className="onboarding-card__scroll">
            <div className="onboarding-header">
              <h1 className="onboarding-title">{t.pickBusinessType}</h1>
              <p className="onboarding-subtitle">{t.pickBusinessTypeDesc}</p>
            </div>

            <VerticalPicker
              value={hasPickedType ? (businessType as BusinessType) : undefined}
              onChange={(type) => { setBusinessType(type); setHasPickedType(true) }}
            />
          </div>

          {hasPickedType && (
            <div className="onboarding-card__footer fade-up">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="onboarding-submit"
                onClick={() => setStep('setup')}
              >
                {t.onboardingGetStarted}
              </Button>
              <Button variant="none"
                type="button"
                className="onboarding-back-btn"
                onClick={() => setStep('welcome')}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                {t.onboardingBack}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding-page space-y-6">
      <SEO title={t.onboardingTitle} />

      <div className="onboarding-card stagger-enter">
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

          <Button variant="none"
            type="button"
            className="onboarding-back-btn"
            onClick={() => setStep('pickType')}
          >
            {t.onboardingBack}
          </Button>
        </form>
      </div>
    </div>
  )
}
