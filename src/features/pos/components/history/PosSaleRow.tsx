/** POS — Single sale row in history list */

import { ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToInr } from '../../utils/pos.format'
import { formatDisplayDate, formatDisplayTime } from '../../utils/pos.format'
import type { PosSaleDTO } from '../../types/pos.types'
import type { TranslationKey } from '@/lib/translations'
import { Button } from '@/components/ui/Button'

interface PosSaleRowProps {
  sale:    PosSaleDTO
  onClick: (id: string) => void
}

const MODE_KEYS: Record<string, string> = {
  CASH:          'posModeCash',
  UPI:           'posModeUpi',
  CARD:          'posModeCard',
  BANK_TRANSFER: 'posModeBank',
  CHEQUE:        'modeCheque',
  CREDIT:        'posModeCredit',
}

export function PosSaleRow({ sale, onClick }: PosSaleRowProps) {
  const { t }       = useLanguage()
  const primaryMode = sale.paymentBreakdown[0]?.mode
  const modeLabel   = primaryMode
    ? (t[MODE_KEYS[primaryMode] as TranslationKey] as string ?? primaryMode)
    : ''

  const customerLabel = sale.walkInName
    ?? sale.partyName
    ?? (t.posWalkIn ?? 'Walk-in')

  return (
    <li className="pos-sale-row">
      <Button variant="none"
        type="button"
        className="pos-sale-row__btn"
        onClick={() => onClick(sale.id)}
        aria-label={`${sale.receiptNumber} — ${paiseToInr(sale.grandTotal)}`}
      >
        <div className="pos-sale-row__left">
          <span className="pos-sale-row__receipt">{sale.receiptNumber}</span>
          <span className="pos-sale-row__customer">{customerLabel}</span>
          <span className="pos-sale-row__meta">
            {formatDisplayDate(sale.createdAt)} · {formatDisplayTime(sale.createdAt)}
            {modeLabel && ` · ${modeLabel}`}
          </span>
        </div>
        <div className="pos-sale-row__right">
          <span className="pos-sale-row__amount">{paiseToInr(sale.grandTotal)}</span>
          {sale.status === 'VOIDED' && (
            <span className="pos-sale-row__badge pos-sale-row__badge--voided">
              {t.posVoided ?? 'Voided'}
            </span>
          )}
          <ChevronRight size={14} className="pos-sale-row__chevron" aria-hidden="true" />
        </div>
      </Button>
    </li>
  )
}
