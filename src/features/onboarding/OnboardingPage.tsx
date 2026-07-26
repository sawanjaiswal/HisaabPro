import { ArrowLeft, Zap, FileText, Users, IndianRupee, BarChart3 } from 'lucide-react'
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
import './onboarding.css'
import './onboarding-steps.css'

const WELCOME_ICON = <Zap className="onboarding-welcome-icon__svg" aria-hidden="true" />
const ICON_INVOICE = <FileText size={20} aria-hidden="true" />
const ICON_PARTY = <Users size={20} aria-hidden="true" />
const ICON_PAYMENT = <IndianRupee size={20} aria-hidden="true" />
const ICON_REPORT = <BarChart3 size={20} aria-hidden="true" />

export default function OnboardingPage() {
  const {
    step, goTo, goBack,
    businessName, setBusinessName,
    businessType, pickBusinessType, hasPickedType,
    phone, setPhone,
    businessLocation, setBusinessLocation,
    dataSource, setDataSource,
    startPath, setStartPath,
    loading, error,
    handleSubmit, goToDashboard,
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
              onChange={pickBusinessType}
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
