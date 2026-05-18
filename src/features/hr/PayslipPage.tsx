/** PayslipPage — Phase 6 PR6 FE
 *
 * /hr/payroll/:runId/payslip/:payrollId — single payslip viewer + share.
 *
 * Fetches the immutable snapshot via `usePayslipSnapshot(payrollId)`. The
 * snapshot is the legal record (frozen at finalize time); we don't allow
 * editing here.
 *
 * Renders the PDF using `<PDFViewer>` from `@react-pdf/renderer` on
 * desktop, OR a Blob-URL iframe on mobile (some Android WebViews refuse
 * to render React-PDF Viewer's worker iframe). Both render the same
 * `<PayslipPDF>` Document.
 *
 * Share: `<PayslipShareButton>` handles native share-sheet vs WhatsApp
 * deeplink fallback. Sticky action bar — Share button only.
 *
 * 4 UI states:
 *   loading — viewer skeleton
 *   error   — ErrorState with retry; 404 surfaces as "Payslip not found"
 *   empty   — N/A (snapshot is single-record)
 *   success — viewer + share bar
 */

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePayslipSnapshot } from './usePayroll'
import { PayslipPDF, type PayslipPDFLabels } from './components/PayslipPDF'
import { PayslipShareButton } from './components/PayslipShareButton'

export default function PayslipPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const params = useParams<{ runId: string; payrollId: string }>()
  const payrollId = params.payrollId
  const runId = params.runId

  const snapshotQuery = usePayslipSnapshot(payrollId)

  const pdfLabels: PayslipPDFLabels = useMemo(
    () => ({
      payslipTitle:      t.payslipPdfTitle as string,
      periodLabel:       t.payslipPdfPeriod as string,
      employeeLabel:     t.payslipPdfEmployee as string,
      designationLabel:  t.payslipPdfDesignation as string,
      phoneLabel:        t.payslipPdfPhone as string,
      presentLabel:      t.payslipPdfPresent as string,
      halfLabel:         t.payslipPdfHalf as string,
      overtimeMinLabel:  t.payslipPdfOvertimeMin as string,
      grossLabel:        t.payslipPdfGross as string,
      advanceLabel:      t.payslipPdfAdvance as string,
      deductionsLabel:   t.payslipPdfDeductions as string,
      netLabel:          t.payslipPdfNet as string,
      paymentLabel:      t.payslipPdfPayment as string,
      paymentModeLabel:  t.payslipPdfPaymentMode as string,
      paymentDateLabel:  t.payslipPdfPaymentDate as string,
      finalizedByLabel:  t.payslipPdfFinalizedBy as string,
      footerNote:        t.payslipPdfFooterNote as string,
    }),
    [t],
  )

  const snapshot = snapshotQuery.data?.snapshot ?? null
  const backToRun = runId
    ? ROUTES.HR_PAYROLL_DETAIL.replace(':id', runId)
    : ROUTES.HR_PAYROLL

  return (
    <AppShell>
      <Header title={t.payslipPageTitle as string} backTo={backToRun} />

      <PageContainer variant="detail" className="space-y-4">
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
          {snapshotQuery.status === 'loading' && (
            <div aria-busy="true" aria-label={t.loading as string} className="space-y-2">
              <Skeleton height="400px" />
            </div>
          )}

          {snapshotQuery.status === 'error' && snapshotQuery.notFound && (
            <ErrorState
              title={t.payslipNotFoundTitle as string}
              message={t.payslipNotFoundDescription as string}
              onRetry={() => navigate(backToRun)}
              retryLabel={t.payrollBackToHub as string}
            />
          )}

          {snapshotQuery.status === 'error' && !snapshotQuery.notFound && (
            <ErrorState
              title={t.payslipLoadError as string}
              onRetry={snapshotQuery.refresh}
              retryLabel={t.retry as string}
            />
          )}

          {snapshotQuery.status === 'success' && snapshot && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
              <PDFViewer
                showToolbar={false}
                width="100%"
                height="600"
                style={{ border: 'none' }}
              >
                <PayslipPDF snapshot={snapshot} labels={pdfLabels} />
              </PDFViewer>
            </div>
          )}
        </div>
      </PageContainer>

      {/* Sticky share bar */}
      {snapshotQuery.status === 'success' && snapshot && (
        <div
          role="region"
          aria-label={t.payslipShareCta as string}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--bottom-nav-height)',
            zIndex: 2,
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <PayslipShareButton snapshot={snapshot} pdfLabels={pdfLabels} />
        </div>
      )}
    </AppShell>
  )
}
