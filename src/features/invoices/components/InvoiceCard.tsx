/** Invoice list row item — txn-row pattern with doc-type icon */

import React, { useRef, useCallback } from 'react'
import { Check } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentSummary, PaymentStatus, DocumentType } from '../invoice.types'
import { formatInvoiceAmount, formatInvoiceDate } from '../invoice-format.utils'
import { getPaymentStatus } from '../invoice-document.utils'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
  DOCUMENT_TYPE_CODES,
} from '../invoice.constants'

interface InvoiceCardProps {
  document: DocumentSummary
  onClick: (id: string) => void
  /** Fires on long-press (500ms hold) to enter bulk select mode */
  onLongPress?: (id: string) => void
  /** Whether this card is currently selected in bulk mode */
  isSelected?: boolean
  /** Whether bulk select mode is active */
  isBulkMode?: boolean
}

const LONG_PRESS_MS = 500

const DOC_TYPE_ICON_CLASS: Record<DocumentType, string> = {
  SALE_INVOICE:     'doc-type-icon doc-type-icon--sale-invoice',
  PURCHASE_INVOICE: 'doc-type-icon doc-type-icon--purchase-invoice',
  ESTIMATE:         'doc-type-icon doc-type-icon--estimate',
  PROFORMA:         'doc-type-icon doc-type-icon--proforma',
  SALE_ORDER:       'doc-type-icon doc-type-icon--sale-order',
  PURCHASE_ORDER:   'doc-type-icon doc-type-icon--purchase-order',
  DELIVERY_CHALLAN: 'doc-type-icon doc-type-icon--delivery-challan',
}

// Payment status labels are now derived from translations inside the component

const PAYMENT_STATUS_INDICATOR_CLASS: Record<PaymentStatus, string> = {
  PAID:    'payment-status-indicator payment-status-indicator--paid',
  PARTIAL: 'payment-status-indicator payment-status-indicator--partial',
  UNPAID:  'payment-status-indicator payment-status-indicator--unpaid',
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  document,
  onClick,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
}) => {
  const { t } = useLanguage()
  const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    PAID:    t.paidStatus,
    PARTIAL: t.partialStatus,
    UNPAID:  t.unpaidStatus,
  }
  const paymentStatus = getPaymentStatus(document.grandTotal, document.paidAmount)
  const paymentBadgeClass = PAYMENT_STATUS_INDICATOR_CLASS[paymentStatus]
  const statusBadgeClass = `badge ${STATUS_BADGE_VARIANTS[document.status]}`
  const iconClass = DOC_TYPE_ICON_CLASS[document.type]
  const typeCode = DOCUMENT_TYPE_CODES[document.type]
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type]
  const statusLabel = DOCUMENT_STATUS_LABELS[document.status]

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(document.id)
    }, LONG_PRESS_MS)
  }, [onLongPress, document.id])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onClick(document.id)
  }, [onClick, document.id])

  return (
    <div
      className={`txn-row invoice-list-item${isSelected ? ' txn-row--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${isBulkMode ? (isSelected ? t.deselectLabel : t.selectLabel) : t.viewDetailsFor} ${typeLabel} ${document.documentNumber} for ${document.party.name}, ${formatInvoiceAmount(document.grandTotal)}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: 'pointer' }}
    >
      {isBulkMode ? (
        <div
          className={`bulk-check${isSelected ? ' bulk-check--active' : ''}`}
          aria-hidden="true"
        >
          {isSelected && <Check size={16} />}
        </div>
      ) : (
        <div className={iconClass} aria-hidden="true">
          {typeCode}
        </div>
      )}

      <div className="txn-info">
        <div className="invoice-card-header">
          <span className="txn-name">{document.party.name}</span>
          <span
            className={statusBadgeClass}
            aria-label={`${t.documentStatusPrefix} ${statusLabel}`}
          >
            {statusLabel}
          </span>
        </div>
        <span className="txn-date">{document.documentNumber} · {formatInvoiceDate(document.documentDate)}</span>
      </div>

      <div className="invoice-card-right">
        <div className="txn-amount">{formatInvoiceAmount(document.grandTotal)}</div>
        <span
          className={paymentBadgeClass}
          aria-label={`${t.paymentStatusPrefix} ${PAYMENT_STATUS_LABELS[paymentStatus]}`}
        >
          {PAYMENT_STATUS_LABELS[paymentStatus]}
        </span>
      </div>
    </div>
  )
}
