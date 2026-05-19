/**
 * Phase 7 Slice 7.1A FE.3 — Preview table orchestrator.
 *
 * Composition (top → bottom):
 *   <PreviewSummary>        counts card (always visible when PREVIEWED)
 *   <PreviewFilters>        All / Valid / Errors / Duplicates chips
 *   <ResponsiveTable>       cards <md, table ≥md
 *   load-more button        cursor pagination append
 *   action row              Cancel + Continue to dedup
 *
 * State:
 *   - rows + pagination owned by usePreviewRows
 *   - active filter is local component state
 *   - cancel mutation hits the existing service
 *
 * No fixed-bottom CSS — the action row lives in normal page flow so we
 * stay inside PLATFORM_SHELL C6. Page-level bottom-nav clearance is
 * already provided by PageContainer.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveTable, type TableColumn } from '@/components/layout/ResponsiveTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { useToast } from '@/hooks/useToast'
import { cancelImportJob } from '../services/import.service'
import { usePreviewRows } from '../hooks/usePreviewRows'
import {
  filterRows,
  firstIssueMessage,
  isDuplicateRow,
  isErrorRow,
  isValidRow,
  readNormalizedBalancePaise,
  readNormalizedName,
  readNormalizedPhone,
  type PreviewFilterKey,
} from '../utils/preview-filters'
import type { ImportJobView, ImportPreviewRow } from '../types/import.types'
import { PreviewSummary } from './PreviewSummary'
import { PreviewFilters } from './PreviewFilters'
import { PreviewStatusBadge } from './PreviewRowCard'

interface PreviewTableProps {
  job: ImportJobView['job']
  initialRows: ImportPreviewRow[]
  initialNextCursor: string | null
  t: Record<string, string>
}

export function PreviewTable({ job, initialRows, initialNextCursor, t }: PreviewTableProps) {
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
    // FE.4 (dedup) / FE.5 (commit) wire the actual next step. For now we
    // emit a toast so the action chain feels alive in QA.
    toast.success(t.importPreviewContinueComingSoon ?? 'Next step lands in FE.4 — coming soon.')
  }

  const columns: TableColumn<ImportPreviewRow>[] = [
    {
      key: 'sourceIndex',
      header: t.importPreviewColRow ?? 'Row',
      width: 'w-16',
      align: 'left',
      render: (r) => <span className="tabular-nums">{r.sourceIndex + 1}</span>,
    },
    {
      key: 'name',
      header: t.importPreviewColName ?? 'Name',
      render: (r) => (
        <span className="truncate inline-block max-w-[180px] align-bottom">
          {readNormalizedName(r) || (t.importPreviewMissingName ?? '—')}
        </span>
      ),
    },
    {
      key: 'phone',
      header: t.importPreviewColPhone ?? 'Phone',
      render: (r) => readNormalizedPhone(r) || (t.importPreviewMissingPhone ?? '—'),
    },
    {
      key: 'balance',
      header: t.importPreviewColBalance ?? 'Balance',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums">{formatPaise(readNormalizedBalancePaise(r))}</span>
      ),
    },
    {
      key: 'status',
      header: t.importPreviewColStatus ?? 'Status',
      render: (r) => <PreviewStatusBadge status={r.status} t={t} />,
    },
    {
      key: 'reason',
      header: t.importPreviewColReason ?? 'Reason',
      render: (r) => {
        const msg = firstIssueMessage(r.issues)
        if (!msg) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
        return (
          <span
            style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)' }}
            className="truncate inline-block max-w-[220px] align-bottom"
            title={msg}
          >
            {msg}
          </span>
        )
      },
    },
  ]

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
