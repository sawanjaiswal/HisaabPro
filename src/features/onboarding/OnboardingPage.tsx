import { Text } from '@/components/ui/Text'
import { ArrowLeft, Zap, FileText, Users, IndianRupee, BarChart3, X } from 'lucide-react'
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
import { Heading } from '@/components/ui/Heading'

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
        <div className="onboarding-card stagger-enter onboarding-welcome-card relative">
          <div className="flex justify-end mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="p-2 -mr-2 rounded-full min-h-0 h-auto"
              onClick={goToDashboard}
              aria-label="Close onboarding"
              title="Close and return to Dashboard"
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </div>
          <div className="onboarding-icon onboarding-welcome-icon" aria-hidden="true">{WELCOME_ICON}</div>

          <div className="onboarding-header">
            <Heading level={1} className="onboarding-title">{welcomeTitle}</Heading>
            <Text className="onboarding-subtitle">{t.onboardingWelcomeSubtitle}</Text>
          </div>

          <div className="onboarding-feature-list">
            {features.map((f) => (
              <div key={f.title} className="onboarding-feature-row">
                <div className="onboarding-feature-icon">{f.icon}</div>
                <div>
                  <Text className="onboarding-feature-title">{f.title}</Text>
                  <Text className="onboarding-feature-desc">{f.desc}</Text>
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

      {step === 'businessDetails' && (
        <div className="onboarding-card stagger-enter">
          <OnboardingStepper current={step} />
          <BusinessDetailsStep
            businessName={businessName} setBusinessName={setBusinessName}
            phone={phone} setPhone={setPhone}
            businessLocation={businessLocation} setBusinessLocation={setBusinessLocation}
            disabled={loading}
            onNext={() => goTo('businessType')}
            onBack={() => goTo('welcome')}
          />
          {error && (
            <Text className="onboarding-error" role="alert">{error}</Text>
          )}
        </div>
      )}

      {step === 'businessType' && (
        <div className="onboarding-card onboarding-card--scrollable stagger-enter">
          <div className="onboarding-card__scroll">
            <OnboardingStepper current={step} />
            <div className="onboarding-header onboarding-header--step">
              <Heading level={2} className="onboarding-step-title">{t.pickBusinessType}</Heading>
              <Text className="onboarding-step-desc">{t.pickBusinessTypeDesc}</Text>
            </div>
            <VerticalPicker
              value={hasPickedType ? (businessType as BusinessType) : undefined}
              onChange={pickBusinessType}
            />
          </div>

          <div className="onboarding-card__footer">
            <div className="onboarding-actions">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="onboarding-back-icon-btn"
                onClick={goBack}
                aria-label={t.onboardingBack}
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={!hasPickedType}
                className="onboarding-submit"
                onClick={() => goTo('dataSource')}
              >
                {t.onboardingContinue}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'dataSource' && (
        <div className="onboarding-card stagger-enter">
          <OnboardingStepper current={step} />
          <DataSourceStep
            value={dataSource}
            onChange={setDataSource}
            onNext={() => goTo('startPath')}
            onBack={goBack}
          />
        </div>
      )}

      {step === 'startPath' && (
        <div className="onboarding-card stagger-enter">
          <OnboardingStepper current={step} />
          <StartPathStep
            value={startPath}
            onChange={setStartPath}
            loading={loading}
            onNext={handleSubmit}
            onBack={goBack}
          />
          {error && (
            <Text className="onboarding-error" role="alert">{error}</Text>
          )}
        </div>
      )}
    </div>
  )
}
