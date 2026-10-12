/** BusinessDetailsStep — Name, Phone, Location fields. */

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { APP_NAME } from '@/config/app.config'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  businessName: string
  setBusinessName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  businessLocation: string
  setBusinessLocation: (v: string) => void
  disabled?: boolean
  onNext?: () => void
  onBack?: () => void
  showActions?: boolean
}

export function BusinessDetailsStep({
  businessName, setBusinessName,
  phone, setPhone,
  businessLocation, setBusinessLocation,
  disabled,
  onNext, onBack,
  showActions = false,
}: Props) {
  const { t } = useLanguage()

  return (
    <form
      id="business-details-form"
      className="onboarding-form"
      onSubmit={(e) => { e.preventDefault(); onNext?.() }}
      noValidate
    >
      <div className="onboarding-header onboarding-header--step">
        <Heading level={2} className="onboarding-step-title">{t.onboardingTitle}</Heading>
        <Text className="onboarding-step-desc">
          {t.onboardingSubtitle.replace('{appName}', APP_NAME)}
        </Text>
      </div>

      <Input
        id="businessName"
        label={t.onboardingBusinessName}
        type="text"
        placeholder={t.onboardingBusinessNamePh}
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        disabled={disabled}
        autoFocus
        autoComplete="organization"
        maxLength={100}
        required
      />

      <Input
        id="phone"
        label={t.onboardingPhone}
        type="tel"
        placeholder={t.onboardingPhonePh || 'Enter your phone number'}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        maxLength={10}
        inputMode="numeric"
      />

      <Input
        id="businessLocation"
        label={t.onboardingBusinessLocation}
        type="text"
        placeholder={t.onboardingBusinessLocationPh}
        value={businessLocation}
        onChange={(e) => setBusinessLocation(e.target.value)}
        disabled={disabled}
        autoComplete="address-level2"
        maxLength={100}
      />

      {showActions && (
        <div className="onboarding-actions">
          {onBack && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="onboarding-back-icon-btn"
              onClick={onBack}
              aria-label={t.onboardingBack}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
          )}
          {onNext && (
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!businessName.trim()}
              className="onboarding-submit"
            >
              {t.onboardingContinue}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
