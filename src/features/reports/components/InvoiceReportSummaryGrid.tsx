/** Invoice Report — "Summary" 2×2 metric grid (mockup #15). */

import { useLanguage } from '@/hooks/useLanguage'
import { formatAmount } from '../report.utils'
import { averageInvoiceValue } from '../invoice-report.utils'
import type { InvoiceReportSummary } from '../report.types'

interface InvoiceReportSummaryGridProps {
  summary: InvoiceReportSummary
}

export function InvoiceReportSummaryGrid({ summary }: InvoiceReportSummaryGridProps) {
  const { t } = useLanguage()

  const tiles = [
    { id: 'total', label: t.totalInvoices, value: String(summary.totalInvoices) },
    { id: 'paid', label: t.paidInvoices, value: String(summary.paidInvoices) },
    { id: 'pending', label: t.pendingInvoices, value: String(summary.pendingInvoices) },
    {
      id: 'avg',
      label: t.avgInvoiceValue,
      value: formatAmount(averageInvoiceValue(summary)),
    },
  ]

  return (
    <section className="invoice-report-section py-0" aria-label={t.summaryLabel}>
      <h2 className="invoice-report-section-title">{t.summaryLabel}</h2>

      <div className="invoice-report-metrics">
        {tiles.map((tile) => (
          <div key={tile.id} className="invoice-report-metric">
            <span className="invoice-report-metric-value">{tile.value}</span>
            <span className="invoice-report-metric-label">{tile.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
