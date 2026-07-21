/**
 * Party Detail — sticky outstanding bar.
 *
 * Keeps the balance and the one action that clears it on screen while the user
 * scrolls the ledger. Positioning belongs to the `BottomActionBar` primitive
 * (PLATFORM_SHELL C6/C9) — this component only fills it.
 *
 * Renders nothing when there is nothing owing: a bar reading "₹0 outstanding"
 * occupies a permanent strip of a small screen to say nothing.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { Button } from '@/components/ui/Button'
import { formatAmount } from '../party.utils'
import './party-pay-bar.css'

interface PartyDetailPayBarProps {
  /** Outstanding balance in PAISE. `<= 0` hides the bar entirely. */
  outstandingPaise: number
  onReceivePayment: () => void
}

export function PartyDetailPayBar({
  outstandingPaise,
  onReceivePayment,
}: PartyDetailPayBarProps) {
  const { t } = useLanguage()

  if (outstandingPaise <= 0) return null

  return (
    <BottomActionBar className="pd-paybar" role="group" aria-label={t.outstanding}>
      <div className="pd-paybar__amount">
        <span className="pd-paybar__value tabular-nums">{formatAmount(outstandingPaise)}</span>
        <span className="pd-paybar__label">{t.outstandingSuffix}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        className="pd-paybar__cta"
        onClick={onReceivePayment}
        aria-label={t.receiveFullPaymentHint}
      >
        {t.receivePayment}
      </Button>
    </BottomActionBar>
  )
}
