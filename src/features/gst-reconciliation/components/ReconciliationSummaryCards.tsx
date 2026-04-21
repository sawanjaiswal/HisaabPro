/** ReconciliationSummaryCards
 *
 * Four metric cards: matched / mismatched / missing / extra counts.
 * Color-coded to match status: green / orange / red / blue.
 * Bottom row: book value vs GSTR value vs difference.
 */

import React from 'react'
import { formatCurrency } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { ReconciliationSummary } from '../reconciliation.types'

interface Props {
  summary: ReconciliationSummary
}

interface CountCardProps {
  label: string
  count: number
  mod: string
}

const CountCard: React.FC<CountCardProps> = ({ label, count, mod }) => (
  <div className={`recon-count-card recon-count-card--${mod}`}>
    <span className="recon-count-card__value">{count}</span>
    <span className="recon-count-card__label">{label}</span>
  </div>
)

export const ReconciliationSummaryCards: React.FC<Props> = ({ summary }) => {
  const { t } = useLanguage()
  return (
    <div className="recon-summary-section py-0" role="region" aria-label={t.reconciliationSummary}>
      {/* Count cards */}
      <div className="recon-count-grid">
        <CountCard label={t.matchedLabel}      count={summary.matchedCount}        mod="success" />
        <CountCard label={t.mismatchedLabel}   count={summary.mismatchedCount}     mod="warning" />
        <CountCard label={t.missingInGstr}     count={summary.missingInGstrCount}  mod="error" />
        <CountCard label={t.extraInGstr}       count={summary.extraInGstrCount}    mod="info" />
      </div>

      {/* Value comparison */}
      <div className="recon-value-row">
        <div className="recon-value-item">
          <span className="recon-value-item__label">{t.books}</span>
          <span className="recon-value-item__amount">{formatCurrency(summary.totalBookValue)}</span>
        </div>
        <div className="recon-value-item">
          <span className="recon-value-item__label">{t.gstrLabel}</span>
          <span className="recon-value-item__amount">{formatCurrency(summary.totalGstrValue)}</span>
        </div>
        <div className="recon-value-item">
          <span className="recon-value-item__label">{t.difference}</span>
          <span className={`recon-value-item__amount${summary.differenceValue !== 0 ? ' recon-value-item__amount--diff' : ''}`}>
            {formatCurrency(Math.abs(summary.differenceValue))}
          </span>
        </div>
      </div>
    </div>
  )
}
