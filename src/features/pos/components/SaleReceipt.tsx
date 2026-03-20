/** POS Sale Receipt — Success view with summary + actions */

import { CheckCircle, Plus, Share2, Printer } from 'lucide-react'
import { formatPaise, formatDate } from '@/lib/format'
import { cartSubtotal, cartItemCount } from '../pos.utils'

import type { PosCartItem, QuickSaleResult } from '../pos.types'

interface SaleReceiptProps {
  receipt: QuickSaleResult
  items: PosCartItem[]
  onNewSale: () => void
}

export function SaleReceipt({ receipt, items, onNewSale }: SaleReceiptProps) {
  const total = cartSubtotal(items)
  const count = cartItemCount(items)

  return (
    <div className="pos-receipt" role="region" aria-label="Sale receipt">
      <div className="pos-receipt-header">
        <div className="pos-receipt-icon">
          <CheckCircle size={32} aria-hidden="true" />
        </div>
        <h2 className="pos-receipt-title">Sale Complete</h2>
        <p className="pos-receipt-number">#{receipt.document.number}</p>
      </div>

      <div className="pos-receipt-summary">
        <div className="pos-receipt-row">
          <span>Items</span>
          <span>{count}</span>
        </div>
        <div className="pos-receipt-row">
          <span>Payment</span>
          <span className="pos-receipt-mode">{receipt.payment.mode.toUpperCase()}</span>
        </div>
        <div className="pos-receipt-row">
          <span>Date</span>
          <span>{formatDate(receipt.document.date)}</span>
        </div>
        <div className="pos-receipt-row pos-receipt-row--total">
          <span>Total</span>
          <span>{formatPaise(total)}</span>
        </div>
      </div>

      <div className="pos-receipt-actions">
        <button type="button" className="btn btn-secondary pos-receipt-action-btn" aria-label="Share receipt" disabled title="Coming soon">
          <Share2 size={16} aria-hidden="true" />
          Share
        </button>
        <button type="button" className="btn btn-secondary pos-receipt-action-btn" aria-label="Print receipt" disabled title="Coming soon">
          <Printer size={16} aria-hidden="true" />
          Print
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary pos-new-sale-btn"
        onClick={onNewSale}
        aria-label="Start new sale"
      >
        <Plus size={18} aria-hidden="true" />
        New Sale
      </button>
    </div>
  )
}
