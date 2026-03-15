/** Invoice list row item — txn-row pattern with doc-type icon */

import React from 'react'
import type { DocumentSummary, PaymentStatus, DocumentType } from '../invoice.types'
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  getPaymentStatus,
} from '../invoice.utils'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
  DOCUMENT_TYPE_CODES,
} from '../invoice.constants'

interface InvoiceCardProps {
  document: DocumentSummary
  onClick: (id: string) => void
}

const DOC_TYPE_ICON_CLASS: Record<DocumentType, string> = {
  SALE_INVOICE:     'doc-type-icon doc-type-icon--sale-invoice',
  PURCHASE_INVOICE: 'doc-type-icon doc-type-icon--purchase-invoice',
  ESTIMATE:         'doc-type-icon doc-type-icon--estimate',
  PROFORMA:         'doc-type-icon doc-type-icon--proforma',
  SALE_ORDER:       'doc-type-icon doc-type-icon--sale-order',
  PURCHASE_ORDER:   'doc-type-icon doc-type-icon--purchase-order',
  DELIVERY_CHALLAN: 'doc-type-icon doc-type-icon--delivery-challan',
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID:    'Paid',
  PARTIAL: 'Partial',
  UNPAID:  'Unpaid',
}

const PAYMENT_STATUS_INDICATOR_CLASS: Record<PaymentStatus, string> = {
  PAID:    'payment-status-indicator payment-status-indicator--paid',
  PARTIAL: 'payment-status-indicator payment-status-indicator--partial',
  UNPAID:  'payment-status-indicator payment-status-indicator--unpaid',
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ document, onClick }) => {
  const paymentStatus = getPaymentStatus(document.grandTotal, document.paidAmount)
  const paymentBadgeClass = PAYMENT_STATUS_INDICATOR_CLASS[paymentStatus]
  const statusBadgeClass = `badge ${STATUS_BADGE_VARIANTS[document.status]}`
  const iconClass = DOC_TYPE_ICON_CLASS[document.type]
  const typeCode = DOCUMENT_TYPE_CODES[document.type]
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type]
  const statusLabel = DOCUMENT_STATUS_LABELS[document.status]

  return (
    <div
      className="txn-row invoice-list-item"
      role="button"
      tabIndex={0}
      aria-label={`${typeLabel} ${document.documentNumber} for ${document.party.name}, ${formatInvoiceAmount(document.grandTotal)}`}
      onClick={() => onClick(document.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(document.id)
      }}
      style={{ minHeight: '44px', cursor: 'pointer' }}
    >
      <div className={iconClass} aria-hidden="true">
        {typeCode}
      </div>

      <div className="txn-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span className="txn-name">{document.party.name}</span>
          <span
            className={statusBadgeClass}
            aria-label={`Document status: ${statusLabel}`}
          >
            {statusLabel}
          </span>
        </div>
        <span className="txn-date">{document.documentNumber} · {formatInvoiceDate(document.documentDate)}</span>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
        <div className="txn-amount">{formatInvoiceAmount(document.grandTotal)}</div>
        <span
          className={paymentBadgeClass}
          aria-label={`Payment status: ${PAYMENT_STATUS_LABELS[paymentStatus]}`}
        >
          {PAYMENT_STATUS_LABELS[paymentStatus]}
        </span>
      </div>
    </div>
  )
}
