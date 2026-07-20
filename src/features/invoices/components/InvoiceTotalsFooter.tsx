/** Invoice list — totals + sparkline footer (mockup #1).
 *
 * A feature-level composition, not a new primitive: it arranges the existing
 * `<AreaChart>` and the shared money formatter inside a card.
 *
 * Honesty note: the mockup shows a "vs last month" delta. The list API returns
 * only the current-window totals, so no delta is rendered — the sparkline is
 * built from the REAL per-day sums of the loaded documents.
 */

import React from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { DocumentListResponse } from '../invoice.types'

interface InvoiceTotalsFooterProps {
  summary: DocumentListResponse['summary']
  /** Per-day totals in PAISE, oldest → newest. */
  series: number[]
}

export const InvoiceTotalsFooter: React.FC<InvoiceTotalsFooterProps> = ({ summary, series }) => {
  const { t } = useLanguage()

  return (
    <section className="invoice-totals-footer py-0" aria-label={t.totalSales}>
      <div className="invoice-totals-card">
        <div className="invoice-totals-head">
          <span className="invoice-totals-label">{t.totalSales}</span>
          <span className="invoice-totals-value tabular-nums">
            {formatInvoiceAmount(summary.totalAmount)}
          </span>
        </div>

        {series.length >= 2 && (
          <AreaChart
            data={series}
            color="var(--color-primary-500)"
            height={64}
            className="invoice-totals-spark"
          />
        )}

        <div className="invoice-totals-split">
          <div className="invoice-totals-split-item">
            <span className="invoice-totals-split-label">{t.receivedLabel}</span>
            <span className="invoice-totals-split-value invoice-totals-split-value--paid tabular-nums">
              {formatInvoiceAmount(summary.totalPaid)}
            </span>
          </div>
          <div className="invoice-totals-split-item">
            <span className="invoice-totals-split-label">{t.dueLabel}</span>
            <span className="invoice-totals-split-value invoice-totals-split-value--due tabular-nums">
              {formatInvoiceAmount(summary.totalDue)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
