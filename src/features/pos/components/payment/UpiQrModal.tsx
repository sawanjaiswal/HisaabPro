/** POS — UPI QR code modal (placeholder — qrcode.react not installed) */

import { X, Smartphone } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToInr } from '../../utils/pos.format'
import { Button } from '@/components/ui/Button'

interface UpiQrModalProps {
  amountPaise: number
  upiId?:      string
  onClose:     () => void
}

export function UpiQrModal({ amountPaise, upiId, onClose }: UpiQrModalProps) {
  const { t } = useLanguage()

  // UPI deep-link string
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&am=${(amountPaise / 100).toFixed(2)}&cu=INR`
    : null

  return (
    <div
      className="pos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.posUpiQrTitle ?? 'UPI Payment'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="pos-modal pos-qr-modal">
        <div className="pos-modal__header">
          <h2 className="pos-modal__title">
            <Smartphone size={16} aria-hidden="true" />
            {t.posUpiQrTitle ?? 'Pay via UPI'}
          </h2>
          <Button variant="none"
            type="button"
            className="pos-modal__close"
            onClick={onClose}
            aria-label={t.close ?? 'Close'}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <div className="pos-qr-modal__body">
          <p className="pos-qr-modal__amount">{paiseToInr(amountPaise)}</p>

          {/* QR placeholder — install qrcode.react to enable */}
          <div className="pos-qr-modal__qr-placeholder" aria-label="QR code area">
            <Smartphone size={48} aria-hidden="true" strokeWidth={1} />
            <p className="pos-qr-modal__qr-hint">
              {t.posUpiQrHint ?? 'Scan with any UPI app'}
            </p>
          </div>

          {upiId && (
            <p className="pos-qr-modal__upi-id">
              <strong>{t.posUpiId ?? 'UPI ID'}:</strong> {upiId}
            </p>
          )}

          {upiLink && (
            <a
              href={upiLink}
              className="pos-qr-modal__deeplink"
              aria-label={t.posOpenUpiApp ?? 'Open UPI app'}
            >
              {t.posOpenUpiApp ?? 'Open UPI app'}
            </a>
          )}
        </div>

        <Button variant="none"
          type="button"
          className="pos-modal__primary-btn"
          onClick={onClose}
        >
          {t.posPaymentReceived ?? 'Payment received'}
        </Button>
      </div>
    </div>
  )
}
