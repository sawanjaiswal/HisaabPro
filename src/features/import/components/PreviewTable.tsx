/**
 * Phase 7 Slice 7.1A FE.3 — Preview table orchestrator.
 * Composition: PreviewSummary + PreviewFilters + ResponsiveTable +
 * load-more + Cancel/Continue. State: rows owned by usePreviewRows,
 * filter is local. FE.4 callback `onContinue` lifts (view, rows) to
 * ImportJobPage so the dedup view can mount without a refetch.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveTable, type TableColumn } from '@/components/layout/ResponsiveTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useToast } from '@/hooks/useToast'
import { cancelImportJob } from '../services/import.service'
import { usePreviewRows } from '../hooks/usePreviewRows'
import {
  filterRows,
  isDuplicateRow,
  isErrorRow,
  isValidRow,
  type PreviewFilterKey,
} from '../utils/preview-filters'
import type { ImportJobView, ImportPreviewRow } from '../types/import.types'
import { PreviewSummary } from './PreviewSummary'
import { PreviewFilters } from './PreviewFilters'
import { buildProductColumns } from './PreviewProductColumns'
import { buildPartyColumns } from './PreviewPartyColumns'
import { InvoiceRowCard } from './InvoiceRowCard'
import { PaymentRowCard } from './PaymentRowCard'

interface PreviewTableProps {
  job: ImportJobView['job']
  initialRows: ImportPreviewRow[]
  initialNextCursor: string | null
  t: Record<string, string>
  /**
   * Called when the user clicks Continue. `nextView` reflects whether
   * the job has any duplicates to review — pages with zero duplicates
   * skip the dedup step. `rows` is the full set loaded so far, lifted
   * so the parent can pass them through to <DedupResolution> without a
   * refetch.
   */
  onContinue?: (nextView: 'dedup' | 'commit', rows: ImportPreviewRow[]) => void
}

export function PreviewTable({ job, initialRows, initialNextCursor, t, onContinue }: PreviewTableProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [filter, setFilter] = useState<PreviewFilterKey>('all')
  const [cancelling, setCancelling] = useState(false)

  const pagination = usePreviewRows({
    jobId: job.id,
    initialRows,
    initialNextCursor,
  })

  const visibleRows = useMemo(
    () => filterRows(pagination.rows, filter),
    [pagination.rows, filter],
  )

  // Chip counts are derived from already-loaded rows so they grow as the
  // user paginates. The summary card above shows the *full-job* counts.
  const localCounts = useMemo(() => {
    let valid = 0
    let errors = 0
    let dupes = 0
    for (const r of pagination.rows) {
      if (isValidRow(r)) valid++
      else if (isErrorRow(r)) errors++
      else if (isDuplicateRow(r)) dupes++
    }
    return { total: pagination.rows.length, valid, errors, dupes }
  }, [pagination.rows])

  const hasAnyDuplicate = (job.counts?.duplicatesExact ?? 0) + (job.counts?.duplicatesNear ?? 0) > 0

  const continueDisabled = job.counts ? (job.counts.staged ?? 0) === 0 : true
  const continueLabel = hasAnyDuplicate
    ? (t.importPreviewContinueDedup ?? 'Continue to dedup')
    : (t.importPreviewContinueCommit ?? 'Continue to commit')

  const handleCancel = async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await cancelImportJob(job.id)
      toast.success(t.importPreviewCancelled ?? 'Import cancelled. Nothing was saved.')
      navigate(ROUTES.IMPORTS)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (t.importPreviewCancelError ?? 'Could not cancel — please retry.')
      toast.error(msg)
      setCancelling(false)
    }
  }

  const handleContinue = () => {
    if (!onContinue) {
      toast.success(t.importPreviewContinueComingSoon ?? 'Next step lands in FE.4 — coming soon.')
      return
    }
    // Zero-dup short-circuit: jump straight to the commit view per
    // SCOPE §FE.4. Otherwise, hand control to the dedup view.
    onContinue(hasAnyDuplicate ? 'dedup' : 'commit', pagination.rows)
  }

  const isProduct = job.entity === 'product'
  const isInvoice = job.entity === 'invoice'
  const isPayment = job.entity === 'payments'
  const useCardList = isInvoice || isPayment
  const columns: TableColumn<ImportPreviewRow>[] = isProduct
    ? buildProductColumns(t)
    : buildPartyColumns(t)

  return (
    <div className="space-y-4">
      <PreviewSummary counts={job.counts} t={t} />

      <PreviewFilters
        active={filter}
        onChange={setFilter}
        countTotal={localCounts.total}
        countValid={localCounts.valid}
        countErrors={localCounts.errors}
        countDuplicates={localCounts.dupes}
        t={t}
      />

      <Card variant="default" className="p-4 space-y-3">
        {useCardList ? (
          visibleRows.length === 0 ? (
            <EmptyState
              title={t.importPreviewEmptyTitle ?? 'No rows in this filter'}
              description={
                t.importPreviewEmptyBody ??
                'Try a different filter, or load more rows from the server.'
              }
            />
          ) : (
            <ul className="space-y-3 list-none p-0">
              {visibleRows.map((r) => (
                <li key={r.id}>
                  {isPayment ? <PaymentRowCard row={r} t={t} /> : <InvoiceRowCard row={r} t={t} />}
                </li>
              ))}
            </ul>
          )
        ) : (
          <ResponsiveTable
            columns={columns}
            rows={visibleRows}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                title={t.importPreviewEmptyTitle ?? 'No rows in this filter'}
                description={
                  t.importPreviewEmptyBody ??
                  'Try a different filter, or load more rows from the server.'
                }
              />
            }
          />
        )}

        {pagination.error && (
          <p
            role="alert"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger, var(--color-text-primary))' }}
          >
            {pagination.error}
          </p>
        )}

        {pagination.hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => { void pagination.loadMore() }}
              loading={pagination.loading}
              disabled={pagination.loading}
              className="min-h-[44px]"
            >
              {t.importPreviewLoadMore ?? 'Load more rows'}
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3 pt-2">
        <Button
          variant="ghost"
          size="lg"
          onClick={handleCancel}
          loading={cancelling}
          disabled={cancelling}
          className="min-h-[44px]"
        >
          {t.importPreviewCancel ?? 'Cancel import'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleContinue}
          disabled={continueDisabled || cancelling}
          className="min-h-[44px]"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  )
}

