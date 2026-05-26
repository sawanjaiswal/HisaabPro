/**
 * Phase 7 Slice 7.1C / 7.1D — Commit-blocked banner.
 *
 * Two variants share a single banner because the layout, accessibility
 * and CTA shape are identical — only the missing-thing list and the
 * deep-link target differ:
 *
 *   1. `kind='product'` — 7.1C — `COMMIT_BLOCKED_PRODUCT_NOT_FOUND`.
 *      Surfaced from invoice imports; CTA deep-links to product import
 *      with `?entity=product&resumeImportJobId=<invoiceJobId>`.
 *
 *   2. `kind='invoice'` — 7.1D — `COMMIT_BLOCKED_INVOICE_NOT_FOUND`.
 *      Surfaced from payment imports; CTA deep-links to invoice import
 *      with `?entity=invoice&resumePaymentJobId=<paymentJobId>`.
 *
 * Banner is the only place that disables the Commit CTA (ARCH §9 —
 * keeping the rule mechanical).
 *
 * ≤250L · token-only colours · no tailwind palette · no dark:.
 */

import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import type { CommitBlockedProductDetail } from '../types/import.types'
import type { CommitBlockedInvoiceDetail } from '../types/payment.types'

type CommitBlockedDetail = CommitBlockedProductDetail | CommitBlockedInvoiceDetail

interface CommitBlockedBannerProps {
  jobId: string
  /**
   * `'product'` (default) keeps 7.1C behaviour intact. `'invoice'` switches
   * the deep-link target and copy for 7.1D payment-import commits.
   */
  kind?: 'product' | 'invoice'
  detail: CommitBlockedDetail
  onCancel?: () => void
  t: Record<string, string>
}

const TOP_N_SAMPLE = 5

export function CommitBlockedBanner({
  jobId,
  kind = 'product',
  detail,
  onCancel,
  t,
}: CommitBlockedBannerProps) {
  const navigate = useNavigate()
  const isInvoice = kind === 'invoice'

  const onResolve = () => {
    const params = new URLSearchParams()
    if (isInvoice) {
      params.set('entity', 'invoice')
      params.set('resumePaymentJobId', jobId)
    } else {
      params.set('entity', 'product')
      params.set('resumeImportJobId', jobId)
    }
    navigate(`${ROUTES.IMPORTS}?${params.toString()}`)
  }

  const sample = readSample(detail, isInvoice).slice(0, TOP_N_SAMPLE)

  const title = isInvoice
    ? (t.importPaymentBlockedTitle ?? 'Invoices are missing for some payments')
    : (t.importInvoiceBlockedTitle ?? 'Product catalogue is missing some items')
  const desc = isInvoice
    ? (t.importPaymentBlockedDesc ??
      'These payments reference invoice numbers that are not in your invoice list.')
    : (t.importInvoiceBlockedDesc ??
      'These invoices reference SKUs that are not in your products list.')
  const sampleLabel = isInvoice
    ? (t.importPaymentBlockedMissingInvoicesLabel ?? 'Missing invoices')
    : (t.importInvoiceBlockedMissingSkusLabel ?? 'Missing SKUs')
  const cta = isInvoice
    ? (t.importPaymentBlockedCta ?? 'Import invoices first')
    : (t.importInvoiceBlockedCta ?? 'Import products first')
  const cancelLabel = isInvoice
    ? (t.importPaymentBlockedCancel ?? 'Cancel import')
    : (t.importInvoiceBlockedCancel ?? 'Cancel import')

  return (
    <Card
      variant="default"
      className="p-4 space-y-3"
      role="alert"
      aria-live="polite"
      style={{
        borderColor: 'var(--color-danger-200)',
        borderWidth: '1px',
        backgroundColor: 'var(--color-danger-50)',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="w-5 h-5 shrink-0 mt-0.5"
          style={{ color: 'var(--color-danger-700)' }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0 space-y-1">
          <h2
            className="font-semibold"
            style={{ fontSize: 'var(--fs-md)', color: 'var(--color-danger-900)' }}
          >
            {title}
          </h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger-800)' }}>
            {desc}
          </p>
        </div>
      </div>

      {sample.length > 0 && (
        <div className="space-y-1">
          <span
            className="font-medium"
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger-800)' }}
          >
            {sampleLabel}
          </span>
          <ul className="flex flex-wrap gap-1.5" aria-label={sampleLabel}>
            {sample.map((item) => (
              <li key={item}>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-full)] tabular-nums"
                  style={{
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--color-danger-800)',
                    backgroundColor: 'var(--color-danger-100)',
                  }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button
          variant="primary"
          size="lg"
          onClick={onResolve}
          className="min-h-[44px] flex-1"
        >
          {cta}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onCancel}
            className="min-h-[44px] flex-1"
          >
            {cancelLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}

function readSample(detail: CommitBlockedDetail, isInvoice: boolean): string[] {
  if (isInvoice) {
    const d = detail as CommitBlockedInvoiceDetail
    return Array.isArray(d.missingInvoiceSample) ? d.missingInvoiceSample : []
  }
  const d = detail as CommitBlockedProductDetail
  return Array.isArray(d.missingSkuSample) ? d.missingSkuSample : []
}
