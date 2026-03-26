/** POS Sale Receipt — Success view with summary + actions */

import { CheckCircle, Plus, Share2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPaise, formatDate } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { cartSubtotal, cartItemCount } from '../pos.utils'

import type { PosCartItem, QuickSaleResult } from '../pos.types'

interface SaleReceiptProps {
  receipt: QuickSaleResult
  items: PosCartItem[]
  onNewSale: () => void
}

export function SaleReceipt({ receipt, items, onNewSale }: SaleReceiptProps) {
  const { t } = useLanguage()
  const total = cartSubtotal(items)
  const count = cartItemCount(items)

  return (
    <div className="pos-receipt" role="region" aria-label={t.posShareReceipt}>
      <div className="pos-receipt-header">
        <div className="pos-receipt-icon">
          <CheckCircle size={32} aria-hidden="true" />
        </div>
        <h2 className="pos-receipt-title">{t.posSaleComplete}</h2>
        <p className="pos-receipt-number">#{receipt.document.number}</p>
      </div>

      <div className="pos-receipt-summary">
        <div className="pos-receipt-row">
          <span>{t.items}</span>
          <span>{count}</span>
        </div>
        <div className="pos-receipt-row">
          <span>{t.payments}</span>
          <span className="pos-receipt-mode">{receipt.payment.mode.toUpperCase()}</span>
        </div>
        <div className="pos-receipt-row">
          <span>{t.date}</span>
          <span>{formatDate(receipt.document.date)}</span>
        </div>
        <div className="pos-receipt-row pos-receipt-row--total">
          <span>{t.total}</span>
          <span>{formatPaise(total)}</span>
        </div>
      </div>

      <div className="pos-receipt-actions">
        <Button
          variant="secondary"
          size="md"
          className="pos-receipt-action-btn"
          aria-label={t.posShareReceipt}
          disabled
          title={t.comingSoon}
        >
          <Share2 size={16} aria-hidden="true" />
          {t.share}
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="pos-receipt-action-btn"
          aria-label={t.posPrintReceipt}
          disabled
          title={t.comingSoon}
        >
          <Printer size={16} aria-hidden="true" />
          {t.print}
        </Button>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="pos-new-sale-btn"
        onClick={onNewSale}
        aria-label={t.posStartNewSale}
      >
        <Plus size={18} aria-hidden="true" />
        {t.posNewSale}
      </Button>
    </div>
  )
}
