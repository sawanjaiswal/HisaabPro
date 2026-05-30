/** POS — Single split payment row with amount input */

import { Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToInrNumeric } from '../../utils/pos.format'
import { PAYMENT_MODES } from '../../utils/pos.constants'
import type { PaymentSplit } from '../../types/pos.types'
import type { TranslationKey } from '@/lib/translations'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface SplitTenderRowProps {
  split:        PaymentSplit
  index:        number
  onAmountChange: (index: number, paise: number) => void
  onRemove:     (index: number) => void
  canRemove:    boolean
}

export function SplitTenderRow({
  split,
  index,
  onAmountChange,
  onRemove,
  canRemove,
}: SplitTenderRowProps) {
  const { t }    = useLanguage()
  const modeConf = PAYMENT_MODES.find((m) => m.value === split.mode)
  const label    = modeConf ? (t[modeConf.labelKey as TranslationKey] as string ?? split.mode) : split.mode

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rupees = parseFloat(e.target.value) || 0
    onAmountChange(index, Math.round(rupees * 100))
  }

  return (
    <div className="pos-split-row">
      <span className="pos-split-row__mode">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        className="pos-split-row__amount"
        min="0"
        step="0.01"
        value={split.amount > 0 ? paiseToInrNumeric(split.amount) : ''}
        onChange={handleChange}
        aria-label={`${label} amount`}
        placeholder="0.00"
      />
      {canRemove && (
        <Button variant="none"
          type="button"
          className="pos-split-row__remove"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${label} payment`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
