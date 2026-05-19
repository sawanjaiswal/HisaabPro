/**
 * Phase 7 Slice 7.1A FE.2-FE.5 — Import job orchestrator page.
 * Route: /imports/:jobId  (ROUTES.IMPORT_JOB_DETAIL). Branches by
 * job.status from the polling query. COMMITTING shows the spinner
 * immediately (mutation in-flight) and persists across refresh —
 * server status is SSOT, mutation state is the optimistic mirror.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/Spinner'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ParseProgress } from '../components/ParseProgress'
import { ParseFailed } from '../components/ParseFailed'
import { PreviewTable } from '../components/PreviewTable'
import { DedupResolution } from '../components/DedupResolution'
import { CommitConfirm } from '../components/CommitConfirm'
import { CommitResult } from '../components/CommitResult'
import { useImportJobPolling } from '../hooks/useImportJobPolling'
import { useImportCommit, MissingCommitTokenError } from '../hooks/useImportCommit'
import type { ImportPreviewRow } from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'

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

function CommittingPanel({ title, body }: { title: string; body: string }) {
  return (
    <Card variant="default" className="p-6 flex flex-col items-center text-center gap-3">
      <Spinner size="lg" />
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
  const toast = useToast()

  const query = useImportJobPolling(jobId)

  const [subView, setSubView] = useState<PreviewSubView>('preview')
  const [dedupRows, setDedupRows] = useState<ImportPreviewRow[]>([])
  const [resolutions, setResolutions] = useState<DedupResolutionMap>({})

  const commit = useImportCommit({
    jobId: jobId ?? '',
    onSuccess: () => {
      // Mutation response shape may be `{}` on the api-wrapper edge cases;
      // we do NOT deref response fields here — the polling query owns the
      // status flip and CommitResult reads from job.counts. See OFFLINE_RULES Rule 5.
      toast.success(tx.importCommitSuccessToast ?? 'Import committed — refreshing…')
    },
    onError: (err) => {
      if (err instanceof MissingCommitTokenError) {
        toast.error(tx.importCommitMissingToken ??
          'This import session expired. Please upload the file again.')
        return
      }
      const msg = err instanceof Error
        ? err.message
        : (tx.importCommitFailed ?? 'Commit failed. Please try again.')
      toast.error(msg)
    },
  })

  const headerTitle = tx.importJobHeader ?? tx.importPageTitle ?? 'Import data'

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
              // While the commit mutation is in-flight (server hasn't yet
              // flipped status to COMMITTING) show the same spinner panel
              // so the user sees instant feedback on tapping "Commit".
              if (commit.isCommitting) {
                return (
                  <CommittingPanel
                    title={tx.importCommittingTitle ?? 'Committing your data…'}
                    body={tx.importCommittingBody ?? 'Saving rows to your business.'}
                  />
                )
              }
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
                return (
                  <CommitConfirm
                    rows={query.data.rows}
                    resolutions={resolutions}
                    isCommitting={commit.isCommitting}
                    onCommit={() => commit.commit(resolutions)}
                    onBack={() => setSubView(
                      Object.keys(resolutions).length > 0 ? 'dedup' : 'preview',
                    )}
                    t={tx}
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
                <CommittingPanel
                  title={tx.importCommittingTitle ?? 'Committing your data…'}
                  body={tx.importCommittingBody ?? 'Saving rows to your business.'}
                />
              )
            case 'COMMITTED':
            case 'PARTIALLY_COMMITTED':
              return <CommitResult job={job} t={tx} />
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
