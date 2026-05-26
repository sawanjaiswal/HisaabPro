/**
 * Phase 7 Slice 7.1D — Resume-from-invoices banner (payments side).
 *
 * Surfaced on the invoice-import summary page (`ImportJobPage` for
 * `entity='invoice'`) when the URL carries `?resumePaymentJobId=<id>`,
 * i.e. the user reached this invoice import via the CommitBlockedBanner
 * deep-link from a still-staged payment import. Lets them return to the
 * original payment flow after committing the missing invoices.
 *
 * Mirror of `ResumeInvoiceImportBanner` — different copy, same shape.
 */

import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes.config'

interface ResumeFromInvoicesBannerProps {
  resumePaymentJobId: string
  t: Record<string, string>
}

export function ResumeFromInvoicesBanner({
  resumePaymentJobId,
  t,
}: ResumeFromInvoicesBannerProps) {
  const tpl = (ROUTES as Record<string, string | undefined>).IMPORT_JOB_DETAIL
  const href = tpl
    ? tpl.replace(':jobId', encodeURIComponent(resumePaymentJobId))
    : `/imports/${encodeURIComponent(resumePaymentJobId)}`

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
        {t.backToPaymentImport ?? 'Back to payment import'}
      </Link>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {t.backToPaymentImportDesc ??
          'Return to the payment import you started — your staged rows are still waiting.'}
      </p>
    </Card>
  )
}
