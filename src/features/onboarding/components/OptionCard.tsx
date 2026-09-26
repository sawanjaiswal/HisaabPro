/** OptionCard — single-column radio-style card, optional "recommended" badge. */

import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Props {
  title: string
  description: string
  active: boolean
  recommendedLabel?: string
  onSelect: () => void
}

export function OptionCard({ title, description, active, recommendedLabel, onSelect }: Props) {
  return (
    <Button
      variant="none"
      type="button"
      role="radio"
      aria-checked={active}
      className={`onboarding-option-card${active ? ' is-active' : ''}`}
      onClick={onSelect}
    >
      <div className="onboarding-option-card__body">
        <Text className="onboarding-option-card__title">{title}</Text>
        <Text className="onboarding-option-card__desc">{description}</Text>
      </div>
      {recommendedLabel && (
        <Badge variant="paid" className="onboarding-option-card__badge">
          {recommendedLabel}
        </Badge>
      )}
    </Button>
  )
}
