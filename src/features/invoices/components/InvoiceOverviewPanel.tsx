/** Invoice Detail — Overview tab panel
 *
 * Displays document metadata rows: type, dates, payment terms,
 * subtotal, discount, charges, round-off, grand total, and notes.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount, formatInvoiceDate } from '../invoice-format.utils'
import { DOCUMENT_TYPE_LABELS, PAYMENT_TERMS_LABELS } from '../invoice.constants'
import type { DocumentDetail } from '../invoice.types'
import '../invoice-overview.css'

interface InvoiceOverviewPanelProps {
  document: DocumentDetail
}

export function InvoiceOverviewPanel({ document }: InvoiceOverviewPanelProps) {
  const { t } = useLanguage()
  return (
    <div className="card invoice-overview-card">
      <div className="invoice-info-row">
        <span className="invoice-info-label">{t.documentType}</span>
        <span className="invoice-info-value">{DOCUMENT_TYPE_LABELS[document.type]}</span>
      </div>
      <div className="invoice-info-row">
        <span className="invoice-info-label">{t.dateLabel}</span>
        <span className="invoice-info-value">{formatInvoiceDate(document.documentDate)}</span>
      </div>
      {document.dueDate && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">{t.dueDate}</span>
          <span className="invoice-info-value">{formatInvoiceDate(document.dueDate)}</span>
        </div>
      )}
      {document.paymentTerms && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">{t.paymentTermsLabel}</span>
          <span className="invoice-info-value">{PAYMENT_TERMS_LABELS[document.paymentTerms]}</span>
        </div>
      )}
      <div className="invoice-info-row">
        <span className="invoice-info-label">{t.subtotal}</span>
        <span className="invoice-info-value">{formatInvoiceAmount(document.subtotal)}</span>
      </div>
      {document.totalDiscount > 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">{t.discount}</span>
          <span className="invoice-info-value invoice-info-value--negative">
            -{formatInvoiceAmount(document.totalDiscount)}
          </span>
        </div>
      )}
      {document.totalAdditionalCharges > 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">{t.chargesLabel}</span>
          <span className="invoice-info-value">+{formatInvoiceAmount(document.totalAdditionalCharges)}</span>
        </div>
      )}
      {document.roundOff !== 0 && (
        <div className="invoice-info-row">
          <span className="invoice-info-label">{t.roundOff}</span>
          <span className="invoice-info-value">{formatInvoiceAmount(document.roundOff)}</span>
        </div>
      )}
      <div className="invoice-info-row invoice-info-row--total">
        <span className="invoice-info-label">{t.grandTotal}</span>
        <span className="invoice-info-value">{formatInvoiceAmount(document.grandTotal)}</span>
      </div>
      {document.notes && (
        <div className="invoice-info-row invoice-info-row--stacked">
          <span className="invoice-info-label">{t.notesLabel}</span>
          <p className="invoice-info-notes">{document.notes}</p>
        </div>
      )}
    </div>
  )
}
