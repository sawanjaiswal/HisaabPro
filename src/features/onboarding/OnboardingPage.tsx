import { Text } from '@/components/ui/Text'
import { ArrowLeft, Zap, FileText, Users, IndianRupee, BarChart3, X } from 'lucide-react'
import { SEO } from '@/components/layout/SEO'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'
import { APP_NAME } from '@/config/app.config'
import { useLanguage } from '@/hooks/useLanguage'
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

  const handleNext = () => {
    if (step === 'businessDetails') {
      if (businessName.trim()) goTo('businessType')
    } else if (step === 'businessType') {
      goTo('dataSource')
    } else if (step === 'dataSource') {
      goTo('startPath')
    } else if (step === 'startPath') {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step === 'businessDetails') {
      goTo('welcome')
    } else {
      goBack()
    }
  }

  const isNextDisabled =
    (step === 'businessDetails' && !businessName.trim()) ||
    (step === 'businessType' && !hasPickedType) ||
    (step === 'dataSource' && !dataSource) ||
    (step === 'startPath' && !startPath) ||
    loading

  const closeButton = (
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
  )

  if (step === 'welcome') {
    return (
      <AppShell>
        <Header title={APP_NAME} actions={closeButton} />
        <main className="onboarding-page">
          <SEO title={welcomeTitle} />
          <div className="onboarding-card stagger-enter onboarding-welcome-card">
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
          </div>
        </main>
        <BottomActionBar>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => goTo('businessDetails')}
          >
            {t.onboardingGetStarted}
          </Button>
        </BottomActionBar>
      </AppShell>
    )
  }

  if (step === 'ready') {
    return (
      <AppShell>
        <Header title={APP_NAME} />
        <main className="onboarding-page">
          <SEO title={t.onboardingStepReady} />
          <div className="onboarding-card stagger-enter onboarding-welcome-card">
            <ReadyStep onGoHome={goToDashboard} onExploreDemo={goToDashboard} />
          </div>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header
        title={APP_NAME}
        onBack={handleBack}
        actions={closeButton}
      />
      <main className="onboarding-page">
        <SEO title={t.onboardingTitle} />
        <div className="onboarding-card stagger-enter">
          <OnboardingStepper current={step} />

          {step === 'businessDetails' && (
            <BusinessDetailsStep
              businessName={businessName} setBusinessName={setBusinessName}
              phone={phone} setPhone={setPhone}
              businessLocation={businessLocation} setBusinessLocation={setBusinessLocation}
              disabled={loading}
              onNext={handleNext}
            />
          )}

          {step === 'businessType' && (
            <div>
              <div className="onboarding-header onboarding-header--step">
                <Heading level={2} className="onboarding-step-title">{t.pickBusinessType}</Heading>
                <Text className="onboarding-step-desc">{t.pickBusinessTypeDesc}</Text>
              </div>
              <VerticalPicker
                value={hasPickedType ? (businessType as BusinessType) : undefined}
                onChange={pickBusinessType}
              />
            </div>
          )}

          {step === 'dataSource' && (
            <DataSourceStep
              value={dataSource}
              onChange={setDataSource}
            />
          )}

          {step === 'startPath' && (
            <StartPathStep
              value={startPath}
              onChange={setStartPath}
            />
          )}

          {error && (
            <Text className="onboarding-error mt-4" role="alert">{error}</Text>
          )}
        </div>
      </main>

      <BottomActionBar>
        <div className="onboarding-actions">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="onboarding-back-icon-btn"
            onClick={handleBack}
            disabled={loading}
            aria-label={t.onboardingBack}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <Button
            type={step === 'businessDetails' ? 'submit' : 'button'}
            form={step === 'businessDetails' ? 'business-details-form' : undefined}
            variant="primary"
            size="lg"
            disabled={isNextDisabled}
            loading={loading && step === 'startPath'}
            className="onboarding-submit"
            onClick={handleNext}
          >
            {step === 'startPath' && loading ? t.onboardingSubmitting : t.onboardingContinue}
          </Button>
        </div>
      </BottomActionBar>
    </AppShell>
  )
}
