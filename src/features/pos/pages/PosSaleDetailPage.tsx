/** POS — Single sale detail with void/restore + receipt preview */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePosSaleDetail } from '../hooks/usePosSaleDetail'
import { usePosBusinessInfo } from '../hooks/usePosBusinessInfo'
import '../pos-billing.css'
import { VoidModal } from '../components/void/VoidModal'
import { ReceiptPreview } from '../components/receipt/ReceiptPreview'
import { paiseToInr, formatDisplayDate, formatDisplayTime } from '../utils/pos.format'
import { Button } from '@/components/ui/Button'

export default function PosSaleDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const { t }     = useLanguage()
  const detail    = usePosSaleDetail(id)
  const businessInfo = usePosBusinessInfo()
  const [showVoid, setShowVoid] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

  // Loading
  if (detail.isLoading) {
    return (
      <AppShell>
        <div className="pos-page">
          <Header title={t.posSaleDetail ?? 'Sale Detail'} backTo />
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
          <Header title={t.posSaleDetail ?? 'Sale Detail'} backTo />
          <ErrorState
            title={t.posSaleNotFound ?? 'Sale not found'}
            onRetry={() => { void detail.refetch() }}
          />
        </div>
      </AppShell>
    )
  }

  // Success
  const { sale } = detail

  return (
    <AppShell>
      <div className="pos-page">
        <Header
          title={sale.receiptNumber}
          backTo={ROUTES.POS_HISTORY}
          actions={sale.status === 'VOIDED'
            ? <span className="pos-detail__voided-badge">{t.posVoided ?? 'Voided'}</span>
            : undefined}
        />

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
          <Button variant="none"
            type="button"
            className="pos-detail__receipt-btn"
            onClick={() => setShowReceipt((p) => !p)}
          >
            {showReceipt ? (t.posHideReceipt ?? 'Hide receipt') : (t.posViewReceipt ?? 'View receipt')}
          </Button>

          {showReceipt && (
            <ReceiptPreview sale={sale} businessInfo={businessInfo} />
          )}

          {/* Actions */}
          <div className="pos-detail__actions">
            {detail.canVoid && (
              <Button variant="none"
                type="button"
                className="pos-detail__void-btn"
                onClick={() => setShowVoid(true)}
                disabled={detail.isVoiding || detail.isRestoring}
                aria-busy={detail.isVoiding}
              >
                {detail.isVoiding ? (t.posVoiding ?? 'Voiding…') : (t.posVoidSale ?? 'Void sale')}
              </Button>
            )}

            {detail.canRestore && (
              <Button variant="none"
                type="button"
                className="pos-detail__restore-btn"
                onClick={detail.doRestore}
                disabled={detail.isVoiding || detail.isRestoring}
                aria-busy={detail.isRestoring}
              >
                {detail.isRestoring ? (t.posRestoring ?? 'Restoring…') : (t.posRestoreSale ?? 'Restore sale')}
              </Button>
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
