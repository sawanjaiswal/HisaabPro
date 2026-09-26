/** ReadyStep — success state (mirrors mockup's checkmark screen). */

import { Text } from '@/components/ui/Text'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { Heading } from '@/components/ui/Heading'

interface Props {
  onGoHome: () => void
  onExploreDemo: () => void
}

export function ReadyStep({ onGoHome, onExploreDemo }: Props) {
  const { t } = useLanguage()

  return (
    <div className="onboarding-form onboarding-ready">
      <div className="onboarding-icon onboarding-ready-icon" aria-hidden="true">
        <CheckCircle2 className="onboarding-ready-icon__svg" />
      </div>

      <div className="onboarding-header">
        <Heading level={1} className="onboarding-title">{t.onboardingReadyTitle}</Heading>
        <Text className="onboarding-subtitle">{t.onboardingReadyDesc}</Text>
      </div>

      <Button type="button" variant="primary" size="lg" className="onboarding-submit" onClick={onGoHome}>
        {t.onboardingGoHome}
      </Button>

      <Button type="button" variant="outline" size="lg" className="onboarding-submit" onClick={onExploreDemo}>
        {t.onboardingExploreDemo}
      </Button>

      <Text className="onboarding-ready-note">{t.onboardingDataSafeNote}</Text>
    </div>
  )
}
