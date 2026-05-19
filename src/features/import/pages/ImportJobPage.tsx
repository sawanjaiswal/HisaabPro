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

import { useState } from 'react'
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
import { DedupResolution } from '../components/DedupResolution'
import { useImportJobPolling } from '../hooks/useImportJobPolling'
import type { ImportPreviewRow } from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'

/**
 * Client-side sub-state while the server job is at status=PREVIEWED.
 * The user moves preview → dedup → commit without the server status
 * changing (commit only flips once the user actually triggers FE.5).
 */
type PreviewSubView = 'preview' | 'dedup' | 'commit'

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

  // Lifted client-side state for the preview → dedup → commit flow.
  // Rows are owned by PreviewTable.usePreviewRows, but we mirror the
  // user-visible page (incl. resolutions) here so back-nav from a future
  // commit view restores the choices instead of resetting them.
  const [subView, setSubView] = useState<PreviewSubView>('preview')
  const [dedupRows, setDedupRows] = useState<ImportPreviewRow[]>([])
  const [resolutions, setResolutions] = useState<DedupResolutionMap>({})

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
              if (subView === 'dedup') {
                return (
                  <DedupResolution
                    rows={dedupRows}
                    initialResolutions={resolutions}
                    onBack={() => setSubView('preview')}
                    onContinue={(next) => {
                      setResolutions(next)
                      setSubView('commit')
                    }}
                    t={tx}
                  />
                )
              }
              if (subView === 'commit') {
                // FE.5 will mount here. It reads `resolutions` and POSTs
                // them to /api/imports/:id/commit. Until then, a stub
                // confirms the lift-state plumbing works end-to-end.
                return (
                  <StubPanel
                    title={tx.importJobCommitReadyStubTitle ?? 'Ready to commit'}
                    body={
                      (tx.importJobCommitReadyStubBody ??
                        'FE.5 will send these {n} duplicate resolutions to the server.').replace(
                        '{n}',
                        String(Object.keys(resolutions).length),
                      )
                    }
                  />
                )
              }
              return (
                <PreviewTable
                  job={job}
                  initialRows={query.data.rows}
                  initialNextCursor={query.data.nextCursor}
                  t={tx}
                  onContinue={(nextView, rows) => {
                    setDedupRows(rows)
                    setSubView(nextView)
                  }}
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
