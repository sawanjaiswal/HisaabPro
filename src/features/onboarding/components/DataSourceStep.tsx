/** DataSourceStep — "How do you currently work?" single-column option cards. */

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { DATA_SOURCE_OPTIONS } from '../onboarding.constants'
import type { DataSource } from '../onboarding.types'
import { OptionCard } from './OptionCard'

interface Props {
  value: DataSource | undefined
  onChange: (v: DataSource) => void
  onNext: () => void
  onBack: () => void
}

export function DataSourceStep({ value, onChange, onNext, onBack }: Props) {
  const { t } = useLanguage()

  return (
    <div className="onboarding-form">
      <div className="onboarding-header onboarding-header--step">
        <h2 className="onboarding-step-title">{t.onboardingDataSourceTitle}</h2>
        <p className="onboarding-step-desc">{t.onboardingDataSourceDesc}</p>
      </div>

      <div className="onboarding-option-list" role="radiogroup" aria-label={t.onboardingDataSourceTitle}>
        {DATA_SOURCE_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.value}
            title={t[opt.titleKey]}
            description={t[opt.descKey]}
            active={value === opt.value}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!value}
        className="onboarding-submit"
        onClick={onNext}
      >
        {t.onboardingContinue}
      </Button>

      <Button variant="none" type="button" className="onboarding-back-btn" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t.onboardingBack}
      </Button>
    </div>
  )
}
