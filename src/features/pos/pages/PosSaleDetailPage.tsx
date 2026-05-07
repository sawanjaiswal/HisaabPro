/** POS — Single sale detail with void/restore + receipt preview */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePosSaleDetail } from '../hooks/usePosSaleDetail'
import '../pos-billing.css'
import { VoidModal } from '../components/void/VoidModal'
import { ReceiptPreview } from '../components/receipt/ReceiptPreview'
import { paiseToInr, formatDisplayDate, formatDisplayTime } from '../utils/pos.format'

const MOCK_BUSINESS = {
  name:    'My Business',
  gstEnabled: false,
}

export default function PosSaleDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { t }     = useLanguage()
  const detail    = usePosSaleDetail(id)
  const [showVoid, setShowVoid] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

  // Loading
  if (detail.isLoading) {
    return (
      <AppShell>
        <div className="pos-page">
          <header className="pos-header">
            <button type="button" className="pos-back-btn" onClick={() => navigate(-1)} aria-label={t.back ?? 'Back'}>
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="pos-header__title">{t.posSaleDetail ?? 'Sale Detail'}</h1>
          </header>
          <div className="pos-detail-skeleton" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-box skeleton-box--detail-row" />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  // Error
  if (detail.isError || !detail.sale) {
    return (
      <AppShell>
        <div className="pos-page">
          <header className="pos-header">
            <button type="button" className="pos-back-btn" onClick={() => navigate(-1)} aria-label={t.back ?? 'Back'}>
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="pos-grid-state pos-grid-state--center">
            <AlertTriangle size={40} className="pos-grid-state__icon--error" aria-hidden="true" />
            <p className="pos-grid-state__title">{t.posSaleNotFound ?? 'Sale not found'}</p>
            <button type="button" className="pos-grid-state__btn" onClick={detail.refetch}>
              <RefreshCw size={13} aria-hidden="true" />
              {t.tryAgain ?? 'Try again'}
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  // Success
  const { sale } = detail

  return (
    <AppShell>
      <div className="pos-page">
        <header className="pos-header">
          <button
            type="button"
            className="pos-back-btn"
            onClick={() => navigate(ROUTES.POS_HISTORY)}
            aria-label={t.back ?? 'Back'}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h1 className="pos-header__title">{sale.receiptNumber}</h1>
          {sale.status === 'VOIDED' && (
            <span className="pos-detail__voided-badge">{t.posVoided ?? 'Voided'}</span>
          )}
        </header>

        <div className="pos-detail-page">
          {/* Summary */}
          <section className="pos-detail-section">
            <div className="pos-detail-row">
              <span>{t.posDate ?? 'Date'}</span>
              <span>{formatDisplayDate(sale.createdAt)} {formatDisplayTime(sale.createdAt)}</span>
            </div>
            <div className="pos-detail-row">
              <span>{t.posCustomer ?? 'Customer'}</span>
              <span>{sale.walkInName ?? sale.partyName ?? (t.posWalkIn ?? 'Walk-in')}</span>
            </div>
            <div className="pos-detail-row pos-detail-row--total">
              <span>{t.posGrandTotal ?? 'Total'}</span>
              <span>{paiseToInr(sale.grandTotal)}</span>
            </div>
          </section>

          {/* Items */}
          <section className="pos-detail-section">
            <h2 className="pos-detail-section__title">{t.posItems ?? 'Items'}</h2>
            <ul className="pos-detail-items">
              {sale.items.map((item) => (
                <li key={item.id} className="pos-detail-item">
                  <span className="pos-detail-item__name">{item.productName}</span>
                  <span className="pos-detail-item__qty">×{item.quantity}</span>
                  <span className="pos-detail-item__total">{paiseToInr(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Payments */}
          <section className="pos-detail-section">
            <h2 className="pos-detail-section__title">{t.posPayments ?? 'Payments'}</h2>
            {sale.paymentBreakdown.map((p, i) => (
              <div key={i} className="pos-detail-row">
                <span>{p.mode}</span>
                <span>{paiseToInr(p.amountPaise)}</span>
              </div>
            ))}
          </section>

          {/* Void reason */}
          {sale.voidReason && (
            <section className="pos-detail-section pos-detail-section--voided">
              <p className="pos-detail-void-reason">
                <strong>{t.posVoidReason ?? 'Void reason'}:</strong> {sale.voidReason}
              </p>
            </section>
          )}

          {/* Receipt preview toggle */}
          <button
            type="button"
            className="pos-detail__receipt-btn"
            onClick={() => setShowReceipt((p) => !p)}
          >
            {showReceipt ? (t.posHideReceipt ?? 'Hide receipt') : (t.posViewReceipt ?? 'View receipt')}
          </button>

          {showReceipt && (
            <ReceiptPreview sale={sale} businessInfo={MOCK_BUSINESS} />
          )}

          {/* Actions */}
          <div className="pos-detail__actions">
            {detail.canVoid && (
              <button
                type="button"
                className="pos-detail__void-btn"
                onClick={() => setShowVoid(true)}
                disabled={detail.isVoiding || detail.isRestoring}
                aria-busy={detail.isVoiding}
              >
                {detail.isVoiding ? (t.posVoiding ?? 'Voiding…') : (t.posVoidSale ?? 'Void sale')}
              </button>
            )}

            {detail.canRestore && (
              <button
                type="button"
                className="pos-detail__restore-btn"
                onClick={detail.doRestore}
                disabled={detail.isVoiding || detail.isRestoring}
                aria-busy={detail.isRestoring}
              >
                {detail.isRestoring ? (t.posRestoring ?? 'Restoring…') : (t.posRestoreSale ?? 'Restore sale')}
              </button>
            )}
          </div>
        </div>

        {/* Void modal */}
        {showVoid && (
          <VoidModal
            receiptNumber={sale.receiptNumber}
            isVoiding={detail.isVoiding}
            onConfirm={(reason) => {
              detail.doVoid(reason)
              setShowVoid(false)
            }}
            onCancel={() => setShowVoid(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
