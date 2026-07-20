/** Invoice Report — "Breakup" donut + legend (mockup #15).
 *
 * The mockup splits by payment mode; invoices don't carry one, so the donut
 * shows the split that IS real on a document: collected vs outstanding vs
 * discount given. Slices with a zero value are dropped from the legend.
 */

import { DonutChart, type DonutSlice } from '@/components/charts/DonutChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatAmount } from '../report.utils'
import { sharePercent } from '../invoice-report.utils'
import type { InvoiceReportSummary } from '../report.types'

interface InvoiceReportBreakupProps {
  summary: InvoiceReportSummary
}

export function InvoiceReportBreakup({ summary }: InvoiceReportBreakupProps) {
  const { t } = useLanguage()

  const slices: DonutSlice[] = [
    {
      id: 'paid',
      label: t.paid,
      value: summary.totalPaid,
      color: 'var(--color-success-500)',
    },
    {
      id: 'outstanding',
      label: t.outstanding,
      value: summary.totalOutstanding,
      color: 'var(--color-error-500)',
    },
    {
      id: 'discount',
      label: t.discountGiven,
      value: summary.totalDiscount,
      color: 'var(--color-warning-500)',
    },
  ].filter((slice) => slice.value > 0)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  if (total <= 0) return null

  return (
    <section className="invoice-report-section py-0" aria-label={t.breakup}>
      <h2 className="invoice-report-section-title">{t.breakup}</h2>

      <div className="invoice-report-breakup">
        <DonutChart
          slices={slices}
          ariaLabel={t.breakup}
          centerLabel={String(summary.totalInvoices)}
          centerSub={t.invoices}
        />

        <ul className="invoice-report-legend">
          {slices.map((slice) => (
            <li key={slice.id} className="invoice-report-legend-row">
              <span
                className="invoice-report-legend-dot"
                style={{ background: slice.color }}
                aria-hidden="true"
              />
              <span className="invoice-report-legend-label">{slice.label}</span>
              <span className="invoice-report-legend-value">
                {formatAmount(slice.value)}
              </span>
              <span className="invoice-report-legend-share">
                {sharePercent(slice.value, total)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
