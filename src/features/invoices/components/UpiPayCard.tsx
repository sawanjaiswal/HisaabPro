/**
 * UpiPayCard — Invoice UPI payment QR + deep-link
 *
 * 4 states:
 *   no-vpa   — VPA not configured; nudge to settings
 *   loading  — QRCode lazy-loading
 *   paid     — balanceDue === 0; shows "Invoice fully paid" badge
 *   success  — QR + amount line + tap-to-open CTA
 *
 * NOT included in image export (rendered outside previewRef in InvoiceDetailPage).
 * NOT included in React-PDF (never imported from PDF template).
 */

import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, CheckCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useUpiPayLink } from '../hooks/useUpiPayLink'
import './upi-pay-card.css'
import { Button } from '@/components/ui/Button'

// Lazy-loaded to keep auth-surface bundle lean
const QRCode = lazy(() =>
  import('qrcode.react').then((m) => ({ default: m.QRCodeSVG }))
)

interface UpiPayCardProps {
  /** Business UPI VPA — null/undefined renders the no-VPA nudge */
  vpa: string | null | undefined
  /** Business name shown in amount line */
  payeeName: string
  /** Balance due in PAISE — 0 renders the "fully paid" badge */
  amountPaise: number
  /** Invoice number used as transaction reference */
  txnRef: string
  /** Optional note shown in payer's UPI app */
  txnNote?: string
}

/** Format paise → rupees display string (e.g. "₹1,200.00") */
function formatAmount(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

export function UpiPayCard({ vpa, payeeName, amountPaise, txnRef, txnNote }: UpiPayCardProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const { upiLink, isValid } = useUpiPayLink({
    vpa,
    payeeName,
    amountPaise,
    transactionRef: txnRef,
    transactionNote: txnNote,
  })

  // State: no VPA configured
  if (!vpa || !isValid) {
    return (
      <div className="upi-pay-card upi-pay-card--no-vpa" role="region" aria-label={t.upiPayCardTitle}>
        <div className="upi-pay-card__header">
          <Smartphone size={18} className="upi-pay-card__icon" aria-hidden="true" />
          <p className="upi-pay-card__title">{t.upiPayCardTitle}</p>
        </div>
        <p className="upi-pay-card__no-vpa-text">{t.upiPayCardNoUpi}</p>
        <Button variant="none"
          type="button"
          className="upi-pay-card__no-vpa-link"
          onClick={() => navigate(ROUTES.SETTINGS)}
          aria-label={t.upiPayCardAddUpi}
        >
          {t.upiPayCardAddUpi}
        </Button>
      </div>
    )
  }

  // State: invoice fully paid
  if (amountPaise === 0) {
    return (
      <div className="upi-pay-card" role="region" aria-label={t.upiPayCardTitle}>
        <div className="upi-pay-card__header">
          <Smartphone size={18} className="upi-pay-card__icon" aria-hidden="true" />
          <p className="upi-pay-card__title">{t.upiPayCardTitle}</p>
        </div>
        <span className="upi-pay-card__paid-badge" role="status">
          <CheckCircle size={14} aria-hidden="true" />
          {t.upiPayCardPaidBadge}
        </span>
      </div>
    )
  }

  // State: loading (QR lazy import) + success (QR shown)
  const amountLine = (t.upiPayCardAmountLine ?? 'Pay {amount} to {name}')
    .replace('{amount}', formatAmount(amountPaise))
    .replace('{name}', payeeName)

  return (
    <div className="upi-pay-card" role="region" aria-label={t.upiPayCardTitle}>
      <div className="upi-pay-card__header">
        <Smartphone size={18} className="upi-pay-card__icon" aria-hidden="true" />
        <div>
          <p className="upi-pay-card__title">{t.upiPayCardTitle}</p>
          <p className="upi-pay-card__subtitle">{t.upiPayCardSubtitle}</p>
        </div>
      </div>

      <div className="upi-pay-card__qr">
        <Suspense fallback={<div className="upi-pay-card__skeleton" aria-label={t.loading ?? 'Loading'} />}>
          <div className="upi-pay-card__qr-canvas">
            <QRCode
              value={upiLink!}
              size={160}
              level="M"
              aria-label={`UPI QR code for ${payeeName}`}
            />
          </div>
        </Suspense>
        <p className="upi-pay-card__amount-line">{amountLine}</p>
      </div>

      <a
        href={upiLink!}
        className="upi-pay-card__cta"
        aria-label={t.upiPayCardCta}
      >
        <Smartphone size={16} aria-hidden="true" />
        {t.upiPayCardCta}
      </a>
    </div>
  )
}
