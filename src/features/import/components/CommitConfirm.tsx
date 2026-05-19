/**
 * Phase 7 Slice 7.1A FE.5 — Commit confirmation view.
 *
 * Final pre-commit screen. Reads the lifted state (preview rows +
 * dedup resolutions) and shows a plain-English summary of what will
 * happen on commit:
 *   - X parties to create  (STAGED rows + CREATE_NEW resolutions)
 *   - Y parties to overwrite (OVERWRITE resolutions)
 *   - Z duplicates to skip (SKIP resolutions, including duplicates the
 *                          user didn't touch — they default to SKIP
 *                          server-side per the BE legacy behaviour).
 *
 * Primary action triggers `onCommit()` (parent owns the mutation so
 * the result/error views can react). Secondary "back" goes to dedup
 * or preview depending on whether there are duplicates.
 *
 * Mutation handler tolerates `{}` return — see OFFLINE_RULES Rule 5.
 * The commit endpoint runs `offlineQueue: false`, but the empty-shape
 * code path is still exercised by the api wrapper on timeout retries.
 */

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ImportPreviewRow } from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'

interface CommitConfirmProps {
  rows: ImportPreviewRow[]
  resolutions: DedupResolutionMap
  isCommitting: boolean
  onCommit: () => void
  onBack: () => void
  t: Record<string, string>
}

interface CommitCounts {
  create: number
  overwrite: number
  skip: number
}

function tallyCounts(
  rows: ImportPreviewRow[],
  resolutions: DedupResolutionMap,
): CommitCounts {
  let create = 0
  let overwrite = 0
  let skip = 0

  for (const row of rows) {
    if (row.status === 'STAGED') {
      create += 1
      continue
    }
    if (row.status === 'DUPLICATE_EXACT' || row.status === 'DUPLICATE_NEAR') {
      const decision = resolutions[row.id] ?? 'SKIP'
      if (decision === 'CREATE_NEW') create += 1
      else if (decision === 'OVERWRITE') overwrite += 1
      else skip += 1
      continue
    }
    // ERROR / WARNING / already-COMMITTED / SKIPPED are not counted —
    // BE skips them server-side regardless of resolution.
  }

  return { create, overwrite, skip }
}

export function CommitConfirm({
  rows,
  resolutions,
  isCommitting,
  onCommit,
  onBack,
  t,
}: CommitConfirmProps) {
  const counts = useMemo(() => tallyCounts(rows, resolutions), [rows, resolutions])

  return (
    <div className="space-y-4">
      <Card variant="default" className="p-4 space-y-3">
        <h2
          className="font-semibold"
          style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
        >
          {t.importCommitTitle ?? 'Ready to commit'}
        </h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
          {t.importCommitBody ?? 'Review the summary before we save these rows to your business.'}
        </p>
        <dl className="space-y-2 pt-2">
          <CommitCountRow
            label={t.importCommitCountCreate ?? 'Parties to create'}
            value={counts.create}
          />
          <CommitCountRow
            label={t.importCommitCountOverwrite ?? 'Parties to overwrite'}
            value={counts.overwrite}
          />
          <CommitCountRow
            label={t.importCommitCountSkip ?? 'Duplicates to skip'}
            value={counts.skip}
          />
        </dl>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={onBack}
          disabled={isCommitting}
          className="min-h-[44px]"
        >
          {t.importCommitBack ?? 'Back'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onCommit}
          disabled={isCommitting || counts.create + counts.overwrite === 0}
          loading={isCommitting}
          className="min-h-[44px] w-full sm:w-auto"
        >
          {isCommitting
            ? (t.importCommitting ?? 'Committing your data…')
            : (t.importCommitAction ?? 'Commit import')}
        </Button>
      </div>
    </div>
  )
}

function CommitCountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {label}
      </dt>
      <dd
        className="font-semibold tabular-nums"
        style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  )
}
