/**
 * Phase 7 Slice 7.1A FE.2 / 7.1C — Status-driven body for ImportJobPage.
 *
 * Extracted from `ImportJobPage.tsx` so the orchestrator stays under the
 * 250L cap after the 7.1C invoice additions. Maps `job.status` to the
 * matching panel (ParseProgress / ParseFailed / PreviewTable /
 * DedupResolution / CommitConfirm / CommittingPanel / CommitResult /
 * StubPanel) and routes `subView` selection for PREVIEWED jobs.
 */

import { ParseProgress } from './ParseProgress'
import { ParseFailed } from './ParseFailed'
import { PreviewTable } from './PreviewTable'
import { DedupResolution } from './DedupResolution'
import { CommitConfirm } from './CommitConfirm'
import { CommitResult } from './CommitResult'
import { CommittingPanel, StubPanel } from './ImportJobPanels'
import type { ImportJobView, ImportPreviewRow } from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'

export type PreviewSubView = 'preview' | 'dedup' | 'commit'

interface ImportJobBodyProps {
  query: {
    data: ImportJobView
  }
  subView: PreviewSubView
  dedupRows: ImportPreviewRow[]
  resolutions: DedupResolutionMap
  isCommitting: boolean
  onSetSubView: (next: PreviewSubView) => void
  onSetResolutions: (next: DedupResolutionMap) => void
  onSetDedupRows: (rows: ImportPreviewRow[]) => void
  onCommit: () => void
  t: Record<string, string>
}

export function ImportJobBody({
  query,
  subView,
  dedupRows,
  resolutions,
  isCommitting,
  onSetSubView,
  onSetResolutions,
  onSetDedupRows,
  onCommit,
  t,
}: ImportJobBodyProps) {
  const job = query.data.job

  if (job.status === 'UPLOADED' || job.status === 'PARSING') {
    return (
      <ParseProgress
        fileName={job.fileName}
        format={job.format}
        startedAt={job.createdAt}
        t={t}
      />
    )
  }
  if (job.status === 'FAILED') {
    return <ParseFailed jobId={job.id} errorCount={job.errorCount} t={t} />
  }
  if (job.status === 'COMMITTING') {
    return (
      <CommittingPanel
        title={t.importCommittingTitle ?? 'Committing your data…'}
        body={t.importCommittingBody ?? 'Saving rows to your business.'}
      />
    )
  }
  if (job.status === 'COMMITTED' || job.status === 'PARTIALLY_COMMITTED') {
    return <CommitResult job={job} t={t} />
  }
  if (job.status === 'CANCELLED') {
    return (
      <StubPanel
        title={t.importJobCancelledStubTitle ?? 'Import cancelled'}
        body={t.importJobCancelledStubBody ?? 'No rows were saved.'}
      />
    )
  }
  if (job.status !== 'PREVIEWED') {
    return (
      <StubPanel
        title={t.importJobUnknownTitle ?? 'Unknown import state'}
        body={String(job.status)}
      />
    )
  }

  // PREVIEWED — branch on sub-view + in-flight mutation.
  if (isCommitting) {
    return (
      <CommittingPanel
        title={t.importCommittingTitle ?? 'Committing your data…'}
        body={t.importCommittingBody ?? 'Saving rows to your business.'}
      />
    )
  }
  if (subView === 'dedup') {
    return (
      <DedupResolution
        rows={dedupRows}
        initialResolutions={resolutions}
        entity={job.entity}
        onBack={() => onSetSubView('preview')}
        onContinue={(next) => {
          onSetResolutions(next)
          onSetSubView('commit')
        }}
        t={t}
      />
    )
  }
  if (subView === 'commit') {
    return (
      <CommitConfirm
        rows={query.data.rows}
        resolutions={resolutions}
        isCommitting={isCommitting}
        entity={job.entity}
        onCommit={onCommit}
        onBack={() =>
          onSetSubView(Object.keys(resolutions).length > 0 ? 'dedup' : 'preview')
        }
        t={t}
      />
    )
  }
  return (
    <PreviewTable
      job={job}
      initialRows={query.data.rows}
      initialNextCursor={query.data.nextCursor}
      t={t}
      onContinue={(nextView, rows) => {
        onSetDedupRows(rows)
        onSetSubView(nextView)
      }}
    />
  )
}
