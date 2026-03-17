/** Invoice Detail — hero header card with document identity + totals */

import React from 'react'
import type { DocumentDetail, DocumentType, PaymentStatus } from '../invoice.types'
import { formatInvoiceAmount, formatInvoiceDate } from '../invoice-format.utils'
import { getPaymentStatus } from '../invoice-document.utils'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
  PAYMENT_STATUS_BADGE,
  DOCUMENT_TYPE_CODES,
} from '../invoice.constants'
import '../invoice-detail-header.css'

interface InvoiceDetailHeaderProps {
  document: DocumentDetail
}

const DOC_TYPE_ICON_CLASS: Record<DocumentType, string> = {
  SALE_INVOICE:     'doc-type-icon doc-type-icon--sale-invoice invoice-detail-type-icon',
  PURCHASE_INVOICE: 'doc-type-icon doc-type-icon--purchase-invoice invoice-detail-type-icon',
  ESTIMATE:         'doc-type-icon doc-type-icon--estimate invoice-detail-type-icon',
  PROFORMA:         'doc-type-icon doc-type-icon--proforma invoice-detail-type-icon',
  SALE_ORDER:       'doc-type-icon doc-type-icon--sale-order invoice-detail-type-icon',
  PURCHASE_ORDER:   'doc-type-icon doc-type-icon--purchase-order invoice-detail-type-icon',
  DELIVERY_CHALLAN: 'doc-type-icon doc-type-icon--delivery-challan invoice-detail-type-icon',
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID:    'Paid',
  PARTIAL: 'Partial',
  UNPAID:  'Unpaid',
}

export const InvoiceDetailHeader: React.FC<InvoiceDetailHeaderProps> = ({ document }) => {
  const paymentStatus = getPaymentStatus(document.grandTotal, document.paidAmount)
  const typeCode = DOCUMENT_TYPE_CODES[document.type]
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type]
  const statusLabel = DOCUMENT_STATUS_LABELS[document.status]
  const iconClass = DOC_TYPE_ICON_CLASS[document.type]

  return (
    <div
      className="card-primary invoice-detail-header"
      role="region"
      aria-label={`${typeLabel} ${document.documentNumber} overview`}
    >
      <div className={iconClass} aria-hidden="true">
        {typeCode}
      </div>

      <div className="invoice-detail-info">
        <h2 className="invoice-detail-number">{document.documentNumber}</h2>
        <p className="invoice-detail-party">{document.party.name}</p>
        <div className="invoice-detail-meta">
          <span style={{ fontSize: '0.8125rem', opacity: 0.75, color: 'var(--color-gray-0)' }}>
            {formatInvoiceDate(document.documentDate)}
          </span>
          <span
            className={`badge ${STATUS_BADGE_VARIANTS[document.status]}`}
            aria-label={`Document status: ${statusLabel}`}
          >
            {statusLabel}
          </span>
          <span
            className={`badge ${PAYMENT_STATUS_BADGE[paymentStatus]}`}
            aria-label={`Payment status: ${PAYMENT_STATUS_LABELS[paymentStatus]}`}
          >
            {PAYMENT_STATUS_LABELS[paymentStatus]}
          </span>
        </div>
      </div>

      <div className="invoice-detail-total-block" aria-label={`Grand total: ${formatInvoiceAmount(document.grandTotal)}`}>
        <span className="invoice-detail-total-label">Grand Total</span>
        <span className="invoice-detail-total-amount">
          {formatInvoiceAmount(document.grandTotal)}
        </span>
        {document.balanceDue > 0 && (
          <span className="invoice-detail-balance invoice-detail-balance--overdue">
            Due: {formatInvoiceAmount(document.balanceDue)}
          </span>
        )}
        {document.balanceDue === 0 && document.paidAmount > 0 && (
          <span className="invoice-detail-balance">
            Fully Paid
          </span>
        )}
      </div>
    </div>
  )
}
