/** POS — Single payment mode button */

import {
  Banknote, Smartphone, CreditCard, Building2, FileText, Clock,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PaymentMode } from '../../types/pos.types'
import type { TranslationKey } from '@/lib/translations'
import { Button } from '@/components/ui/Button'

const ICONS: Record<string, React.ElementType> = {
  Banknote, Smartphone, CreditCard, Building2, FileText, Clock,
}

interface PaymentModeButtonProps {
  mode:       PaymentMode
  labelKey:   string
  iconName:   string
  isSelected: boolean
  onSelect:   (mode: PaymentMode) => void
}

export function PaymentModeButton({
  mode,
  labelKey,
  iconName,
  isSelected,
  onSelect,
}: PaymentModeButtonProps) {
  const { t } = useLanguage()
  const Icon  = ICONS[iconName] ?? Banknote
  const label = t[labelKey as TranslationKey] as string ?? mode

  return (
    <Button variant="none"
      type="button"
      role="radio"
      aria-checked={isSelected}
      className={`pos-mode-btn${isSelected ? ' pos-mode-btn--active' : ''}`}
      onClick={() => onSelect(mode)}
      aria-label={label}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="pos-mode-btn__label">{label}</span>
    </Button>
  )
}
