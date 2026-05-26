/**
 * Phase 7 Slice 7.1C — Resume-invoice-import banner.
 *
 * Surfaced on the product-import summary page (`ImportJobPage` for
 * `entity='product'`) when the URL carries `?resumeImportJobId=<id>`,
 * i.e. the user reached this product import via the CommitBlockedBanner
 * deep-link from a still-staged invoice import (ARCH §9 / ARCH S3
 * round-trip).
 *
 * Renders a tokenised banner linking back to `/imports/:resumeImportJobId`
 * so the user can finish the original invoice flow without losing
 * context.
 */

import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'

interface ResumeInvoiceImportBannerProps {
  resumeImportJobId: string
  t: Record<string, string>
}

export function ResumeInvoiceImportBanner({
  resumeImportJobId,
  t,
}: ResumeInvoiceImportBannerProps) {
  const tpl = (ROUTES as Record<string, string | undefined>).IMPORT_JOB_DETAIL
  const href = tpl
    ? tpl.replace(':jobId', encodeURIComponent(resumeImportJobId))
    : `/imports/${encodeURIComponent(resumeImportJobId)}`

  return (
    <Card
      variant="default"
      className="p-4 space-y-1"
      role="status"
      style={{
        borderColor: 'var(--color-primary-200)',
        borderWidth: '1px',
        backgroundColor: 'var(--color-primary-50)',
      }}
    >
      <Link
        to={href}
        className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] rounded-[var(--radius-sm)]"
        style={{ fontSize: 'var(--fs-md)', color: 'var(--color-primary-700)' }}
      >
        {'← '}
        {t.backToInvoiceImport ?? 'Back to invoice import'}
      </Link>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {t.backToInvoiceImportDesc ??
          'Return to the invoice import you started — your staged rows are still waiting.'}
      </p>
    </Card>
  )
}
