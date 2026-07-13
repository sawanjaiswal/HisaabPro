/** OnboardingStepper — dot progress bar with the current step's label. */

import { useLanguage } from '@/hooks/useLanguage'
import { ONBOARDING_STEPS } from '../onboarding.constants'
import type { OnboardingStep } from '../onboarding.types'

interface Props {
  current: OnboardingStep
}

export function OnboardingStepper({ current }: Props) {
  const { t } = useLanguage()
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.step === current)
  const currentLabel = t[ONBOARDING_STEPS[currentIndex]?.labelKey ?? 'onboardingStepWelcome']

  return (
    <div className="onboarding-stepper" role="progressbar"
      aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={ONBOARDING_STEPS.length}
      aria-label={currentLabel}
    >
      <div className="onboarding-stepper__dots">
        {ONBOARDING_STEPS.map((s, i) => (
          <span
            key={s.step}
            className={`onboarding-stepper__dot${
              i === currentIndex ? ' is-active' : i < currentIndex ? ' is-done' : ''
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="onboarding-stepper__label">{currentLabel}</p>
    </div>
  )
}
