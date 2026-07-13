/** BusinessDetailsStep — Name, Phone, Location fields. */

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  businessName: string
  setBusinessName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  businessLocation: string
  setBusinessLocation: (v: string) => void
  disabled?: boolean
  onNext: () => void
  onBack: () => void
}

export function BusinessDetailsStep({
  businessName, setBusinessName,
  phone, setPhone,
  businessLocation, setBusinessLocation,
  disabled,
  onNext, onBack,
}: Props) {
  const { t } = useLanguage()

  return (
    <form
      className="onboarding-form"
      onSubmit={(e) => { e.preventDefault(); onNext() }}
      noValidate
    >
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
        placeholder={t.onboardingPhonePh}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={disabled}
        autoComplete="tel"
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

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!businessName.trim()}
        className="onboarding-submit"
      >
        {t.onboardingContinue}
      </Button>

      <Button variant="none" type="button" className="onboarding-back-btn" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t.onboardingBack}
      </Button>
    </form>
  )
}
