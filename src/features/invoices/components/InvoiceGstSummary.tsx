/** InvoiceGstSummary — CGST/SGST/IGST split for the create screen.
 *
 * Pure presentation. The parent computes the breakdown via useInvoiceGstSummary
 * (which reuses the canonical calculateDocumentTax engine) and only mounts this
 * when there's a non-zero tax to show. Intra-state splits into CGST + SGST;
 * inter-state shows a single IGST line — driven by place-of-supply vs the
 * business's own state.
 */

import { Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/hooks/useLanguage'
import { formatRupees } from '@/lib/format'
import type { InvoiceGstSummary as GstSummaryData } from '../useInvoiceGstSummary'
import './invoice-gst-summary.css'

interface InvoiceGstSummaryProps {
  data: GstSummaryData
}

export function InvoiceGstSummary({ data }: InvoiceGstSummaryProps) {
  const { t } = useLanguage()
  const { summary, interState } = data

  return (
    <section className="gst-summary" aria-label={t.gstSummaryTitle}>
      <header className="gst-summary-head">
        <span className="gst-summary-icon" aria-hidden="true">
          <Receipt size={16} />
        </span>
        <h3 className="gst-summary-title">{t.gstSummaryTitle}</h3>
        <Badge variant={interState ? 'info' : 'draft'}>
          {interState ? t.interStateSupply : t.intraStateSupply}
        </Badge>
      </header>

      <dl className="gst-summary-rows">
        <Row label={t.taxableValueLabel} value={summary.totalTaxableValue} />
        {interState ? (
          <Row label={t.igst} value={summary.totalIgst} />
        ) : (
          <>
            <Row label={t.cgst} value={summary.totalCgst} />
            <Row label={t.sgst} value={summary.totalSgst} />
          </>
        )}
        {summary.totalCess > 0 && <Row label={t.cessLabel} value={summary.totalCess} />}
      </dl>

      <div className="gst-summary-total">
        <span>{t.totalTaxLabel}</span>
        <span className="gst-summary-total-value tabular-nums">{formatRupees(summary.totalTax)}</span>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="gst-summary-row">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatRupees(value)}</dd>
    </div>
  )
}
