/** Invoice Detail — Overview tab panel
 *
 * Displays document metadata rows: type, dates, payment terms,
 * subtotal, discount, charges, round-off, grand total, and notes.
 */

import { formatInvoiceAmount, formatInvoiceDate } from '../invoice-format.utils'
import { DOCUMENT_TYPE_LABELS, PAYMENT_TERMS_LABELS } from '../invoice.constants'
import type { DocumentDetail } from '../invoice.types'

interface InvoiceOverviewPanelProps {
  document: DocumentDetail
}

export function InvoiceOverviewPanel({ document }: InvoiceOverviewPanelProps) {
  return (
    <div className="card invoice-overview-card">
      <div className="invoice-info-row">
        <span className="invoice-info-label">Document Type</span>
        <span className="invoice-info-value">{DOCUMENT_TYPE_LABELS[document.type]}</span>
      </div>
      <div className="invoice-info-row">
        <span className="invoice-info-label">Date</span>
        <span className="invoice-info-value">{formatInvoiceDate(document.documentDate)}</span>
      </div>
      {document.dueDate && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">Due Date</span>
          <span className="invoice-info-value">{formatInvoiceDate(document.dueDate)}</span>
        </div>
      )}
      {document.paymentTerms && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">Payment Terms</span>
          <span className="invoice-info-value">{PAYMENT_TERMS_LABELS[document.paymentTerms]}</span>
        </div>
      )}
      <div className="invoice-info-row">
        <span className="invoice-info-label">Subtotal</span>
        <span className="invoice-info-value">{formatInvoiceAmount(document.subtotal)}</span>
      </div>
      {document.totalDiscount > 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">Discount</span>
          <span className="invoice-info-value" style={{ color: 'var(--color-error-600)' }}>
            -{formatInvoiceAmount(document.totalDiscount)}
          </span>
        </div>
      )}
      {document.totalAdditionalCharges > 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">Charges</span>
          <span className="invoice-info-value">+{formatInvoiceAmount(document.totalAdditionalCharges)}</span>
        </div>
      )}
      {document.roundOff !== 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">Round Off</span>
          <span className="invoice-info-value">{formatInvoiceAmount(document.roundOff)}</span>
        </div>
      )}
      <div className="invoice-info-row" style={{ borderTop: '1px solid var(--color-gray-100)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
        <span className="invoice-info-label" style={{ fontWeight: 700, fontSize: '1rem' }}>Grand Total</span>
        <span className="invoice-info-value" style={{ fontWeight: 700, fontSize: '1.125rem' }}>{formatInvoiceAmount(document.grandTotal)}</span>
      </div>
      {document.notes && (
        <div className="invoice-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
          <span className="invoice-info-label">Notes</span>
          <p style={{ lineHeight: 1.5, color: 'var(--color-gray-700)' }}>{document.notes}</p>
        </div>
      )}
    </div>
  )
}
