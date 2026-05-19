/**
 * Phase 7 Slice 7.1A FE.2 — Import job orchestrator page.
 *
 * Route: /imports/:jobId  (ROUTES.IMPORT_JOB_DETAIL)
 *
 * Branches by `job.status` from the 2s polling query:
 *   UPLOADED | PARSING                 → <ParseProgress />
 *   FAILED                             → <ParseFailed />
 *   PREVIEWED                          → stub (FE.3 will render the dedup
 *                                        review screen here)
 *   COMMITTING                         → stub (FE.4)
 *   COMMITTED | PARTIALLY_COMMITTED    → stub (FE.5 will render the success
 *                                        + error-CSV download screen here)
 *   CANCELLED                          → stub
 *
 * Polling stops automatically once the status leaves the active set
 * (UPLOADED/PARSING) — see useImportJobPolling.
 */

import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { ParseProgress } from '../components/ParseProgress'
import { ParseFailed } from '../components/ParseFailed'
import { PreviewTable } from '../components/PreviewTable'
import { useImportJobPolling } from '../hooks/useImportJobPolling'

function StubPanel({ title, body }: { title: string; body: string }) {
  return (
    <Card variant="default" className="p-4 space-y-2">
      <h2
        className="font-semibold"
        style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {body}
      </p>
    </Card>
  )
}

export default function ImportJobPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>

  const query = useImportJobPolling(jobId)

  const headerTitle = tx.importJobHeader ?? tx.importPageTitle ?? 'Import data'

  // Missing :jobId — guard before the query renders error UI.
  if (!jobId) {
    return (
      <AppShell>
        <Header title={headerTitle} backTo={ROUTES.IMPORTS} />
        <PageContainer variant="form" className="space-y-4">
          <ErrorState
            title={tx.importJobMissingIdTitle ?? 'Import not found'}
            message={tx.importJobMissingIdBody ?? 'No job id in the URL.'}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={headerTitle} backTo={ROUTES.IMPORTS} />
      <PageContainer variant="form" className="space-y-4">
        {query.isPending && (
          <ParseProgress
            fileName={null}
            format="generic_csv"
            startedAt={new Date().toISOString()}
            t={tx}
          />
        )}

        {query.isError && (
          <ErrorState
            title={tx.importJobLoadErrorTitle ?? 'Could not load this import'}
            message={
              query.error instanceof Error
                ? query.error.message
                : (tx.importJobLoadErrorBody ?? 'Please try again.')
            }
            onRetry={() => query.refetch()}
            retryLabel={tx.importJobRetry ?? 'Try again'}
          />
        )}

        {query.data && (() => {
          const job = query.data.job
          switch (job.status) {
            case 'UPLOADED':
            case 'PARSING':
              return (
                <ParseProgress
                  fileName={job.fileName}
                  format={job.format}
                  startedAt={job.createdAt}
                  t={tx}
                />
              )
            case 'FAILED':
              return (
                <ParseFailed jobId={job.id} errorCount={job.errorCount} t={tx} />
              )
            case 'PREVIEWED':
              return (
                <PreviewTable
                  job={job}
                  initialRows={query.data.rows}
                  initialNextCursor={query.data.nextCursor}
                  t={tx}
                />
              )
            case 'COMMITTING':
              return (
                <StubPanel
                  title={tx.importJobCommittingStubTitle ?? 'Committing import…'}
                  body={tx.importJobCommittingStubBody ?? 'Saving rows to your business.'}
                />
              )
            case 'COMMITTED':
            case 'PARTIALLY_COMMITTED':
              return (
                <StubPanel
                  title={tx.importJobCommittedStubTitle ?? 'Import committed'}
                  body={tx.importJobCommittedStubBody ?? 'A detailed result screen is on the way.'}
                />
              )
            case 'CANCELLED':
              return (
                <StubPanel
                  title={tx.importJobCancelledStubTitle ?? 'Import cancelled'}
                  body={tx.importJobCancelledStubBody ?? 'No rows were saved.'}
                />
              )
            default:
              return (
                <StubPanel
                  title={tx.importJobUnknownTitle ?? 'Unknown import state'}
                  body={String(job.status)}
                />
              )
          }
        })()}
      </PageContainer>
    </AppShell>
  )
}
