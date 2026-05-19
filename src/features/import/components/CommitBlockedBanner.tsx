/**
 * Phase 7 Slice 7.1C — Commit-blocked banner (PRODUCT_NOT_FOUND sentinel).
 *
 * Renders above the invoice preview list when the chunk pre-flight returns
 * `409 COMMIT_BLOCKED_PRODUCT_NOT_FOUND`. The banner is the *only* place
 * that disables the Commit CTA — keeping the rule mechanical (ARCH §9).
 *
 * Primary CTA deep-links to the product-import flow with
 * `resumeImportJobId=<currentJobId>` so the product-summary screen can
 * surface a "← Back to invoice import" return link (ARCH S3 round-trip).
 *
 * ≤200L · token-only colours · no tailwind palette · no dark:.
 */

import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'
import type { CommitBlockedProductDetail } from '../types/import.types'

interface CommitBlockedBannerProps {
  jobId: string
  detail: CommitBlockedProductDetail
  onCancel?: () => void
  t: Record<string, string>
}

const TOP_N_SKUS = 5

export function CommitBlockedBanner({
  jobId,
  detail,
  onCancel,
  t,
}: CommitBlockedBannerProps) {
  const navigate = useNavigate()

  const onResolve = () => {
    // Deep-link to the upload page in product mode with the resume token.
    // Architecture §9 specifies `/import?entity=product&resumeImportJobId=`;
    // ROUTES.IMPORTS is the canonical FE path (`/imports`).
    const params = new URLSearchParams()
    params.set('entity', 'product')
    params.set('resumeImportJobId', jobId)
    navigate(`${ROUTES.IMPORTS}?${params.toString()}`)
  }

  const sample = Array.isArray(detail.missingSkuSample)
    ? detail.missingSkuSample.slice(0, TOP_N_SKUS)
    : []

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
            {t.importInvoiceBlockedTitle ??
              'Product catalogue is missing some items'}
          </h2>
          <p
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger-800)' }}
          >
            {t.importInvoiceBlockedDesc ??
              'These invoices reference SKUs that are not in your products list.'}
          </p>
        </div>
      </div>

      {sample.length > 0 && (
        <div className="space-y-1">
          <span
            className="font-medium"
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger-800)' }}
          >
            {t.importInvoiceBlockedMissingSkusLabel ?? 'Missing SKUs'}
          </span>
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={t.importInvoiceBlockedMissingSkusLabel ?? 'Missing SKUs'}
          >
            {sample.map((sku) => (
              <li key={sku}>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-full)] tabular-nums"
                  style={{
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--color-danger-800)',
                    backgroundColor: 'var(--color-danger-100)',
                  }}
                >
                  {sku}
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
          {t.importInvoiceBlockedCta ?? 'Import products first'}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onCancel}
            className="min-h-[44px] flex-1"
          >
            {t.importInvoiceBlockedCancel ?? 'Cancel import'}
          </Button>
        )}
      </div>
    </Card>
  )
}
