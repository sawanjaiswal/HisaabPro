/** TDS/TCS Entry Card
 *
 * Renders a single invoice entry: document number, date, party name,
 * invoice total, and TDS/TCS amounts with rate labels.
 * Only shows TDS or TCS rows when the respective amount is > 0.
 */

import React from 'react'
import { formatAmount, formatReportDate } from '../report.utils'
import type { TdsTcsEntry } from '../report-tax.types'

interface TdsTcsEntryCardProps {
  entry: TdsTcsEntry
}

/** Convert basis points to a percentage string: 200 → "2.00%" */
function formatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`
}

export const TdsTcsEntryCard: React.FC<TdsTcsEntryCardProps> = ({ entry }) => {
  return (
    <div className="tds-tcs-entry-card">
      <div className="tds-tcs-entry-card__header">
        <span className="tds-tcs-entry-card__doc-number">{entry.documentNumber}</span>
        <span className="tds-tcs-entry-card__date">{formatReportDate(entry.documentDate)}</span>
      </div>

      <div className="tds-tcs-entry-card__party">{entry.party.name}</div>

      <div className="tds-tcs-entry-card__amounts">
        <div className="tds-tcs-entry-card__amount-row">
          <span className="tds-tcs-entry-card__amount-label">Invoice Total</span>
          <span className="tds-tcs-entry-card__amount-value">{formatAmount(entry.grandTotal)}</span>
        </div>

        {entry.tdsAmount > 0 && (
          <div className="tds-tcs-entry-card__amount-row">
            <span className="tds-tcs-entry-card__amount-label tds-tcs-entry-card__amount-label--tds">
              TDS ({formatRate(entry.tdsRate)})
            </span>
            <span className="tds-tcs-entry-card__amount-value tds-tcs-entry-card__amount-value--tds">
              {formatAmount(entry.tdsAmount)}
            </span>
          </div>
        )}

        {entry.tcsAmount > 0 && (
          <div className="tds-tcs-entry-card__amount-row">
            <span className="tds-tcs-entry-card__amount-label tds-tcs-entry-card__amount-label--tcs">
              TCS ({formatRate(entry.tcsRate)})
            </span>
            <span className="tds-tcs-entry-card__amount-value tds-tcs-entry-card__amount-value--tcs">
              {formatAmount(entry.tcsAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
