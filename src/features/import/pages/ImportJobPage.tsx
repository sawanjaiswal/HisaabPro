/**
 * Phase 7 Slice 7.1A FE.2-FE.5 — Import job orchestrator page.
 * Route: /imports/:jobId  (ROUTES.IMPORT_JOB_DETAIL). Branches by
 * job.status from the polling query. COMMITTING shows the spinner
 * immediately (mutation in-flight) and persists across refresh —
 * server status is SSOT, mutation state is the optimistic mirror.
 */

import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ParseProgress } from '../components/ParseProgress'
import { ImportJobBody, type PreviewSubView } from '../components/ImportJobBody'
import { useImportJobPolling } from '../hooks/useImportJobPolling'
import {
  useImportCommit,
  MissingCommitTokenError,
  readCommitBlockedDetail,
  isClientVersionUpgrade,
} from '../hooks/useImportCommit'
import { CommitBlockedBanner } from '../components/CommitBlockedBanner'
import { ResumeInvoiceImportBanner } from '../components/ResumeInvoiceImportBanner'
import type {
  CommitBlockedProductDetail,
  ImportPreviewRow,
} from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'


export default function ImportJobPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>
  const toast = useToast()

  const query = useImportJobPolling(jobId)

  const [subView, setSubView] = useState<PreviewSubView>('preview')
  const [dedupRows, setDedupRows] = useState<ImportPreviewRow[]>([])
  const [resolutions, setResolutions] = useState<DedupResolutionMap>({})
  // 7.1C — 409 COMMIT_BLOCKED_PRODUCT_NOT_FOUND surface state. The banner
  // is the single source-of-truth for disabling the commit CTA.
  const [commitBlocked, setCommitBlocked] =
    useState<CommitBlockedProductDetail | null>(null)

  // 7.1C ARCH S3 — when this page is rendered as the product-import summary
  // after the user deep-linked from an invoice CommitBlockedBanner, the URL
  // carries `?resumeImportJobId=<invoiceJobId>`. We surface a top-of-page
  // CTA letting the user finish products and return.
  const [searchParams] = useSearchParams()
  const resumeImportJobId = searchParams.get('resumeImportJobId')

  const commit = useImportCommit({
    jobId: jobId ?? '',
    onSuccess: () => {
      // Mutation response shape may be `{}` on the api-wrapper edge cases;
      // we do NOT deref response fields here — the polling query owns the
      // status flip and CommitResult reads from job.counts. See OFFLINE_RULES Rule 5.
      setCommitBlocked(null)
      toast.success(tx.importCommitSuccessToast ?? 'Import committed — refreshing…')
    },
    onError: (err) => {
      if (err instanceof MissingCommitTokenError) {
        toast.error(tx.importCommitMissingToken ??
          'This import session expired. Please upload the file again.')
        return
      }
      // 7.1C: 409 sentinel — surface the banner with missing-SKU sample.
      const blocked = readCommitBlockedDetail(err)
      if (blocked) {
        setCommitBlocked(blocked)
        setSubView('preview')
        return
      }
      // 7.1C: 426 — server requires a newer client (per-entity floor 7.1.2).
      if (isClientVersionUpgrade(err)) {
        toast.error(
          tx.importClientVersionUpgradeRequired ??
            'Please update the app to import invoices.',
        )
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

  const isProductJob = query.data?.job.entity === 'product'
  const showResumeCta =
    isProductJob &&
    !!resumeImportJobId &&
    (query.data?.job.status === 'COMMITTED' ||
      query.data?.job.status === 'PARTIALLY_COMMITTED')

  return (
    <AppShell>
      <Header title={headerTitle} backTo={ROUTES.IMPORTS} />
      <PageContainer variant="form" className="space-y-4">
        {showResumeCta && resumeImportJobId && (
          <ResumeInvoiceImportBanner
            resumeImportJobId={resumeImportJobId}
            t={tx}
          />
        )}
        {commitBlocked && (
          <CommitBlockedBanner
            jobId={jobId}
            detail={commitBlocked}
            onCancel={() => setCommitBlocked(null)}
            t={tx}
          />
        )}
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

        {query.data && (
          <ImportJobBody
            query={{ data: query.data }}
            subView={subView}
            dedupRows={dedupRows}
            resolutions={resolutions}
            isCommitting={commit.isCommitting}
            onSetSubView={setSubView}
            onSetResolutions={setResolutions}
            onSetDedupRows={setDedupRows}
            onCommit={() => commit.commit(resolutions)}
            t={tx}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
