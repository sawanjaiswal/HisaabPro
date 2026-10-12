/** DataSourceStep — "How do you currently work?" single-column option cards. */

import { Text } from '@/components/ui/Text'
import { useLanguage } from '@/hooks/useLanguage'
import { DATA_SOURCE_OPTIONS } from '../onboarding.constants'
import type { DataSource } from '../onboarding.types'
import { OptionCard } from './OptionCard'
import { Heading } from '@/components/ui/Heading'

interface Props {
  value: DataSource | undefined
  onChange: (v: DataSource) => void
}

export function DataSourceStep({ value, onChange }: Props) {
  const { t } = useLanguage()

  return (
    <div className="onboarding-form">
      <div className="onboarding-header onboarding-header--step">
        <Heading level={2} className="onboarding-step-title">{t.onboardingDataSourceTitle}</Heading>
        <Text className="onboarding-step-desc">{t.onboardingDataSourceDesc}</Text>
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
    </div>
  )
}
