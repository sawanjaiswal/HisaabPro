/**
 * DesktopQrCheckout — desktop-web surface.
 *
 * On desktop there is no UPI app to launch, so we render the Razorpay hosted
 * checkout URL as a QR code. The user scans it with their phone's UPI/Razorpay
 * app, pays there, and the webhook→FSM writer flips the subscription state —
 * which the page's status poll picks up. We start polling on mount so the
 * desktop screen advances to success the moment the phone payment lands.
 */

import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import { Spinner } from '@/components/feedback/Spinner'
import type { CheckoutSurfaceProps } from '../subscription-checkout.types'

export function DesktopQrCheckout({ session, onEvent, phase }: CheckoutSurfaceProps) {
  const { t } = useLanguage()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    // No client SDK on desktop — go straight to polling for webhook activation.
    onEvent({ kind: 'razorpay_opened', subscriptionId: session.razorpaySubscriptionId })
    onEvent({ kind: 'handler_fired', subscriptionId: session.razorpaySubscriptionId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="checkout-qr">
      <p className="checkout-qr__hint text-[var(--fs-sm)] text-[var(--color-text-secondary)]">
        {t.checkoutScanToPay}
      </p>
      <div className="checkout-qr__frame">
        <QRCodeSVG value={session.checkoutUrl} size={208} level="M" />
      </div>
      <p className="checkout-qr__amount tabular-nums text-[var(--fs-lg)] font-semibold">
        {formatPaise(session.amountPaise)}
      </p>
      <a
        href={session.checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="checkout-qr__link text-[var(--fs-sm)] text-[var(--color-primary-600)]"
      >
        {t.checkoutOpenLinkInstead}
      </a>
      {phase.kind === 'polling' && (
        <div className="checkout-qr__waiting" role="status" aria-live="polite">
          <Spinner size="sm" />
          <span className="text-[var(--fs-sm)] text-[var(--color-text-secondary)]">
            {t.checkoutWaitingForPayment}
          </span>
        </div>
      )}
    </div>
  )
}
