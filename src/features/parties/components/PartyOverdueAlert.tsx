/**
 * Party Detail — overdue advisory banner.
 *
 * Names the single oldest still-owing invoice and offers the one action that
 * clears it. Renders nothing when nothing is overdue, so the caller does not
 * have to guard: absence of the banner IS the "all clear" state.
 *
 * Not `ErrorState` — that primitive means "the request failed, retry", and it
 * owns a full-width empty-ish block. This is advisory content about healthy
 * data, with a forward action rather than a retry.
 */

import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { formatAmount } from '../party.utils'
import './party-overdue-alert.css'

interface PartyOverdueAlertProps {
  /** Invoice number, e.g. "INV-1056". Empty string renders the label alone. */
  invoiceNumber: string
  /** Balance still owing on that invoice, in PAISE. */
  amountPaise: number
  daysOverdue: number
  onReceivePayment: () => void
}

export function PartyOverdueAlert({
  invoiceNumber,
  amountPaise,
  daysOverdue,
  onReceivePayment,
}: PartyOverdueAlertProps) {
  const { t } = useLanguage()

  return (
    <div className="pd-overdue" role="status">
      <span className="pd-overdue__icon" aria-hidden="true">
        <AlertTriangle className="w-5 h-5" />
      </span>

      <div className="pd-overdue__body">
        <p className="pd-overdue__title">
          {invoiceNumber
            ? `${t.oldestInvoiceOverdue} — ${invoiceNumber}`
            : t.oldestInvoiceOverdue}
        </p>
        <p className="pd-overdue__meta">
          <span className="tabular-nums">{formatAmount(amountPaise)}</span>
          {' · '}
          {t.overdueByDays.replace('{days}', String(daysOverdue))}
        </p>
      </div>

      <Button
        variant="none"
        className="pd-overdue__action"
        onClick={onReceivePayment}
        aria-label={t.receivePayment}
      >
        <span>{t.receivePayment}</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
