/** StartPathStep — "Choose your path" (Import [recommended] / Start Fresh). */

import { Text } from '@/components/ui/Text'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { START_PATH_OPTIONS } from '../onboarding.constants'
import type { StartPath } from '../onboarding.types'
import { OptionCard } from './OptionCard'
import { Heading } from '@/components/ui/Heading'

interface Props {
  value: StartPath | undefined
  onChange: (v: StartPath) => void
  loading?: boolean
  onNext: () => void
  onBack: () => void
}

export function StartPathStep({ value, onChange, loading, onNext, onBack }: Props) {
  const { t } = useLanguage()

  return (
    <div className="onboarding-form">
      <div className="onboarding-header onboarding-header--step">
        <Heading level={2} className="onboarding-step-title">{t.onboardingPathTitle}</Heading>
        <Text className="onboarding-step-desc">{t.onboardingPathDesc}</Text>
      </div>

      <div className="onboarding-option-list" role="radiogroup" aria-label={t.onboardingPathTitle}>
        {START_PATH_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.value}
            title={t[opt.titleKey]}
            description={t[opt.descKey]}
            active={value === opt.value}
            recommendedLabel={opt.recommended ? t.onboardingPathRecommended : undefined}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!value || loading}
        className="onboarding-submit"
        onClick={onNext}
      >
        {loading ? t.onboardingSubmitting : t.onboardingContinue}
      </Button>

      <Button variant="none" type="button" className="onboarding-back-btn" onClick={onBack} disabled={loading}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t.onboardingBack}
      </Button>
    </div>
  )
}
