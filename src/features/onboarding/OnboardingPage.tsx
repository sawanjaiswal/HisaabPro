import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SEO } from '../../components/layout/SEO'
import { Button } from '../../components/ui/Button'
import { APP_NAME } from '../../config/app.config'
import { useLanguage } from '../../context/LanguageContext'
import type { BusinessType } from '@/config/verticals.config'
import { VerticalPicker } from './components/VerticalPicker'
import { OnboardingStepper } from './components/OnboardingStepper'
import { BusinessDetailsStep } from './components/BusinessDetailsStep'
import { DataSourceStep } from './components/DataSourceStep'
import { StartPathStep } from './components/StartPathStep'
import { ReadyStep } from './components/ReadyStep'
import { useOnboarding } from './useOnboarding'
import type { OnboardingStep } from './onboarding.types'
import './onboarding.css'
import './onboarding-steps.css'

const STEP_ORDER: OnboardingStep[] = [
  'welcome', 'businessDetails', 'businessType', 'dataSource', 'startPath', 'ready',
]

const WELCOME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="onboarding-welcome-icon__svg">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
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
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [hasPickedType, setHasPickedType] = useState(false)
  const {
    businessName, setBusinessName,
    businessType, setBusinessType,
    phone, setPhone,
    businessLocation, setBusinessLocation,
    dataSource, setDataSource,
    startPath, setStartPath,
    loading, error, created,
    handleSubmit, goToDashboard,
  } = useOnboarding()
  const { t } = useLanguage()

  const stepIndex = STEP_ORDER.indexOf(step)
  const goTo = (s: OnboardingStep) => setStep(s)
  const goBack = () => goTo(STEP_ORDER[Math.max(0, stepIndex - 1)])

  useEffect(() => {
    if (created) setStep('ready')
  }, [created])

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
          <div className="onboarding-icon onboarding-welcome-icon" aria-hidden="true">{WELCOME_ICON}</div>

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
            onClick={() => goTo('businessDetails')}
          >
            {t.onboardingGetStarted}
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'ready') {
    return (
      <div className="onboarding-page space-y-6">
        <SEO title={t.onboardingStepReady} />
        <div className="onboarding-card stagger-enter onboarding-welcome-card">
          <ReadyStep onGoHome={goToDashboard} onExploreDemo={goToDashboard} />
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding-page space-y-6">
      <SEO title={t.onboardingTitle} />

      <div className="onboarding-card stagger-enter">
        <OnboardingStepper current={step} />

        {step === 'businessDetails' && (
          <BusinessDetailsStep
            businessName={businessName} setBusinessName={setBusinessName}
            phone={phone} setPhone={setPhone}
            businessLocation={businessLocation} setBusinessLocation={setBusinessLocation}
            disabled={loading}
            onNext={() => goTo('businessType')}
            onBack={() => goTo('welcome')}
          />
        )}

        {step === 'businessType' && (
          <div className="onboarding-form">
            <div className="onboarding-header onboarding-header--step">
              <h2 className="onboarding-step-title">{t.pickBusinessType}</h2>
              <p className="onboarding-step-desc">{t.pickBusinessTypeDesc}</p>
            </div>

            <VerticalPicker
              value={hasPickedType ? (businessType as BusinessType) : undefined}
              onChange={(type) => { setBusinessType(type); setHasPickedType(true) }}
            />

            {hasPickedType && (
              <div className="fade-up">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="onboarding-submit"
                  onClick={() => goTo('dataSource')}
                >
                  {t.onboardingContinue}
                </Button>
                <Button variant="none" type="button" className="onboarding-back-btn" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  {t.onboardingBack}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'dataSource' && (
          <DataSourceStep
            value={dataSource}
            onChange={setDataSource}
            onNext={() => goTo('startPath')}
            onBack={goBack}
          />
        )}

        {step === 'startPath' && (
          <StartPathStep
            value={startPath}
            onChange={setStartPath}
            loading={loading}
            onNext={handleSubmit}
            onBack={goBack}
          />
        )}

        {error && (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
