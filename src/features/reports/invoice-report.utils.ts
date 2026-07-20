/** Invoice Report — helpers specific to the invoice analytics block (mockup #15).
 *
 * The generic ones (delta, share, chart mapping, range label) moved to
 * `report-analytics.utils.ts` when #16 needed the same maths; they are
 * re-exported here so #15's call sites keep one import.
 */

import type { InvoiceReportSummary } from './report.types'

export {
  periodDelta,
  sharePercent,
  trendValues,
  trendLabels,
  formatRangeLabel,
} from './report-analytics.utils'
export type { PeriodDelta, TrendPoint } from './report-analytics.utils'

/** Average invoice value in paise; 0 when there are no invoices. */
export function averageInvoiceValue(summary: InvoiceReportSummary): number {
  if (summary.totalInvoices <= 0) return 0
  return Math.round(summary.totalAmount / summary.totalInvoices)
}
