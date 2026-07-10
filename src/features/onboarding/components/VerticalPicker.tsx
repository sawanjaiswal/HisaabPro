/** VerticalPicker — visual card grid for choosing a business vertical.
 * Used by onboarding (step 2 of 3) and Settings → Business.
 */

import {
  Briefcase, Store, Warehouse, Factory, Wrench, UtensilsCrossed,
  Pill, Cake, Scissors, Stethoscope, Shirt, Laptop, Package,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import {
  VERTICAL_PROFILES, VERTICAL_PICKER_ORDER, type BusinessType,
} from '@/config/verticals.config'
import { Button } from '@/components/ui/Button'

const ICONS: Record<string, LucideIcon> = {
  Briefcase, Store, Warehouse, Factory, Wrench, UtensilsCrossed,
  Pill, Cake, Scissors, Stethoscope, Shirt, Laptop, Package,
}

interface Props {
  value: BusinessType | undefined
  onChange: (type: BusinessType) => void
  disabled?: boolean
}

export function VerticalPicker({ value, onChange, disabled }: Props) {
  const { t } = useLanguage()
  return (
    <div className="vertical-picker" role="radiogroup" aria-label={t.pickBusinessType}>
      {VERTICAL_PICKER_ORDER.map((type) => {
        const profile = VERTICAL_PROFILES[type]
        const Icon = ICONS[profile.iconName] ?? Package
        const active = value === type
        return (
          <Button variant="none"
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={`vertical-picker__card${active ? ' is-active' : ''}`}
            onClick={() => onChange(type)}
          >
            <span className="vertical-picker__icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className="vertical-picker__name">{t[profile.labelKey]}</span>
            <span className="vertical-picker__desc">{t[profile.descriptionKey]}</span>
          </Button>
        )
      })}
    </div>
  )
}
