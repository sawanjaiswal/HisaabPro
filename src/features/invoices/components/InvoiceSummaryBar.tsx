/** Invoice list — Hero card pair (Received / Due)
 *
 * Uses shared summary-hero CSS pattern.
 * Teal card (received) + coral card (due) — lime card when all paid.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, Clock } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { DocumentListResponse } from '../invoice.types'

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
  const { t } = useLanguage()
  const { totalAmount, totalPaid, totalDue } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.invoiceSummaryAriaLabel}>
      <p className="summary-hero-count">
        {t.totalColon} <strong>{formatInvoiceAmount(totalAmount)}</strong>
      </p>

      <div className="summary-hero-cards">
        {/* Received — teal gradient */}
        <button
          className="summary-hero-card summary-hero-card--teal"
          role="listitem"
          onClick={onReceivedClick}
          aria-label={`${t.receivedLabel}: ${formatInvoiceAmount(totalPaid)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{formatInvoiceAmount(totalPaid)}</span>
            <span className="summary-hero-label">
              {t.receivedLabel}
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </button>

        {/* Due — coral gradient, or lime when all paid */}
        <button
          className={`summary-hero-card ${totalDue === 0 ? 'summary-hero-card--lime' : 'summary-hero-card--coral'}`}
          role="listitem"
          onClick={onDueClick}
          aria-label={totalDue > 0 ? `${t.dueLabel}: ${formatInvoiceAmount(totalDue)}` : t.noAmountDue}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{formatInvoiceAmount(totalDue)}</span>
            <span className="summary-hero-label">
              {totalDue > 0 ? t.dueLabel : t.allPaidLabel}
              <Clock size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
