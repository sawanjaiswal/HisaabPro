/** Invoice list — Hero card pair (Received / Due)
 *
 * Matches dashboard hero pattern: teal card (received) + coral card (due).
 * Total amount shown as subtitle above the cards.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, Clock } from 'lucide-react'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { DocumentListResponse } from '../invoice.types'
import './InvoiceSummaryBar.css'

interface InvoiceSummaryBarProps {
  summary: DocumentListResponse['summary']
  onReceivedClick?: () => void
  onDueClick?: () => void
}

export const InvoiceSummaryBar: React.FC<InvoiceSummaryBarProps> = ({
  summary,
  onReceivedClick,
  onDueClick,
}) => {
  const { totalAmount, totalPaid, totalDue } = summary

  return (
    <div className="invoice-hero" role="list" aria-label="Invoice summary">
      <p className="invoice-hero-total">
        Total: <strong>{formatInvoiceAmount(totalAmount)}</strong>
      </p>

      <div className="invoice-hero-cards">
        {/* Received — teal gradient */}
        <button
          className="invoice-hero-card invoice-hero-card--received"
          role="listitem"
          onClick={onReceivedClick}
          aria-label={`Received: ${formatInvoiceAmount(totalPaid)}`}
        >
          <div className="invoice-hero-card-content">
            <span className="invoice-hero-amount">{formatInvoiceAmount(totalPaid)}</span>
            <span className="invoice-hero-label">
              Received
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="invoice-hero-chevron" />
        </button>

        {/* Due — coral/red gradient */}
        <button
          className={`invoice-hero-card invoice-hero-card--due${totalDue === 0 ? ' invoice-hero-card--clear' : ''}`}
          role="listitem"
          onClick={onDueClick}
          aria-label={totalDue > 0 ? `Due: ${formatInvoiceAmount(totalDue)}` : 'No amount due'}
        >
          <div className="invoice-hero-card-content">
            <span className="invoice-hero-amount">{formatInvoiceAmount(totalDue)}</span>
            <span className="invoice-hero-label">
              {totalDue > 0 ? 'Due' : 'All Paid'}
              <Clock size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="invoice-hero-chevron invoice-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
