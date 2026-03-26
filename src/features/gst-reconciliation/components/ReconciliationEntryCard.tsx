/** ReconciliationEntryCard
 *
 * Single reconciliation entry: book values vs GSTR values side-by-side,
 * differences highlighted, match status badge.
 * Amounts are in paise — formatted via formatCurrency().
 */

import React from 'react'
import { formatCurrency, formatDate } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from '../reconciliation.constants'
import type { ReconciliationEntry } from '../reconciliation.types'

interface Props {
  entry: ReconciliationEntry
}

export const ReconciliationEntryCard: React.FC<Props> = ({ entry }) => {
  const { t } = useLanguage()
  const statusMod = MATCH_STATUS_COLORS[entry.matchStatus]
  const hasDiff   = entry.taxableValueDiff !== 0 || entry.taxAmountDiff !== 0

  return (
    <div className={`recon-entry-card recon-entry-card--${statusMod}`}>
      {/* Header: doc number + date + badge */}
      <div className="recon-entry-card__header">
        <div className="recon-entry-card__header-left">
          <span className="recon-entry-card__doc">{entry.documentNumber}</span>
          <span className="recon-entry-card__date">{formatDate(entry.documentDate)}</span>
        </div>
        <span className={`recon-badge recon-badge--${statusMod}`} role="status">
          {MATCH_STATUS_LABELS[entry.matchStatus]}
        </span>
      </div>

      {/* Party */}
      <div className="recon-entry-card__party">
        <span className="recon-entry-card__party-name">{entry.partyName}</span>
        <span className="recon-entry-card__party-gstin">{entry.partyGstin}</span>
      </div>

      {/* Side-by-side comparison */}
      <div className="recon-entry-card__comparison">
        <div className="recon-entry-card__col">
          <span className="recon-entry-card__col-head">{t.books}</span>
          <div className="recon-entry-card__row">
            <span className="recon-entry-card__row-label">{t.taxable}</span>
            <span className="recon-entry-card__row-value">{formatCurrency(entry.bookTaxableValue)}</span>
          </div>
          <div className="recon-entry-card__row">
            <span className="recon-entry-card__row-label">{t.tax}</span>
            <span className="recon-entry-card__row-value">{formatCurrency(entry.bookTaxAmount)}</span>
          </div>
        </div>

        <div className="recon-entry-card__divider" aria-hidden="true" />

        <div className="recon-entry-card__col">
          <span className="recon-entry-card__col-head">{t.gstrLabel}</span>
          <div className="recon-entry-card__row">
            <span className="recon-entry-card__row-label">{t.taxable}</span>
            <span className="recon-entry-card__row-value">
              {entry.gstrTaxableValue != null ? formatCurrency(entry.gstrTaxableValue) : '—'}
            </span>
          </div>
          <div className="recon-entry-card__row">
            <span className="recon-entry-card__row-label">{t.tax}</span>
            <span className="recon-entry-card__row-value">
              {entry.gstrTaxAmount != null ? formatCurrency(entry.gstrTaxAmount) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Difference row — shown only when non-zero */}
      {hasDiff && (
        <div className="recon-entry-card__diff-row">
          {entry.taxableValueDiff !== 0 && (
            <span className="recon-entry-card__diff">
              {t.taxableDiff}: {formatCurrency(Math.abs(entry.taxableValueDiff))}
            </span>
          )}
          {entry.taxAmountDiff !== 0 && (
            <span className="recon-entry-card__diff">
              {t.taxDiff}: {formatCurrency(Math.abs(entry.taxAmountDiff))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
