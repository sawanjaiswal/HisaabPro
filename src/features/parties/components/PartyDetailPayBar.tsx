/**
 * Party Detail — sticky bottom action bar.
 *
 * Hosts the two primary party actions (Receive · Invoice) and, when money is
 * owed, a strip above them showing the outstanding balance. Positioning and the
 * safe-area math belong to the `BottomActionBar` primitive (PLATFORM_SHELL
 * C6/C9) — this component only fills it.
 *
 * Always rendered on a loaded party: the actions are the point, and the
 * outstanding strip simply appears when there is a balance to clear.
 */

import { PlusCircle, FilePlus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { Button } from '@/components/ui/Button'
import { formatAmount } from '../party.utils'
import './party-pay-bar.css'

interface PartyDetailPayBarProps {
  /** Outstanding balance in PAISE. `> 0` shows the amount strip. */
  outstandingPaise: number
  onReceivePayment: () => void
  onNewInvoice: () => void
}

export function PartyDetailPayBar({
  outstandingPaise,
  onReceivePayment,
  onNewInvoice,
}: PartyDetailPayBarProps) {
  const { t } = useLanguage()

  return (
    <BottomActionBar className="pd-paybar" role="group" aria-label={t.quickActions}>
      {outstandingPaise > 0 && (
        <div className="pd-paybar__strip">
          <span className="pd-paybar__label">{t.outstanding}</span>
          <span className="pd-paybar__value tabular-nums">{formatAmount(outstandingPaise)}</span>
        </div>
      )}

      <div className="pd-paybar__actions">
        <Button
          variant="primary"
          size="md"
          className="pd-paybar__cta"
          onClick={onReceivePayment}
          aria-label={t.receivePayment}
        >
          <PlusCircle size={18} aria-hidden="true" />
          <span>{t.receiveAmount}</span>
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="pd-paybar__cta"
          onClick={onNewInvoice}
          aria-label={t.newInvoice}
        >
          <FilePlus size={18} aria-hidden="true" />
          <span>{t.invoiceLabel}</span>
        </Button>
      </div>
    </BottomActionBar>
  )
}
