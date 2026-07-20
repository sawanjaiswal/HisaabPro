/** Payment Details — identity card (mockup #42).
 *
 * Avatar + party on the left, the signed amount and its direction on the
 * right. The mockup shows the party's city under the name; PaymentDetail
 * carries no address, so the payment mode goes there instead of a blank line.
 */

import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import { formatPaymentMode } from '../payment.utils'
import type { PaymentType, PaymentMode } from '../payment.types'

interface PaymentDetailHeroProps {
  type: PaymentType
  partyName: string
  /** Amount in PAISE */
  amount: number
  mode: PaymentMode
}

export function PaymentDetailHero({ type, partyName, amount, mode }: PaymentDetailHeroProps) {
  const { t } = useLanguage()
  const isIn = type === 'PAYMENT_IN'

  return (
    <div className="payment-identity">
      <PartyAvatar name={partyName} size="md" />

      <div className="payment-identity-main">
        <div className="payment-identity-party">{partyName}</div>
        <div className="payment-identity-meta">{formatPaymentMode(mode)}</div>
      </div>

      <div className="payment-identity-right">
        <span
          className={`payment-identity-amount tabular-nums payment-identity-amount--${isIn ? 'in' : 'out'}`}
        >
          {isIn ? '+' : '−'} {formatPaise(amount)}
        </span>
        <span className="payment-identity-direction">{isIn ? t.receivedLabel : t.paid}</span>
      </div>
    </div>
  )
}
