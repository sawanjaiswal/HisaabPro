/**
 * Phase 7 Slice 7.1A FE.3 — Preview summary card.
 *
 * Shows total / valid / errors / duplicates derived from
 * `ImportJobCounts` (server JSON on the job row). Uses `<Card>` for the
 * shell and a 2-col grid (mobile) → 4-col (≥sm) for the stat tiles.
 */

import { Card } from '@/components/ui/Card'
import type { ImportJobCounts } from '../types/import.types'

interface PreviewSummaryProps {
  counts: ImportJobCounts | null
  t: Record<string, string>
}

interface Tile {
  labelKey: string
  fallback: string
  value: number
  toneVar: string
}

export function PreviewSummary({ counts, t }: PreviewSummaryProps) {
  const total = counts?.total ?? 0
  const valid = counts?.staged ?? 0
  const errors = counts?.errors ?? 0
  const dupes = (counts?.duplicatesExact ?? 0) + (counts?.duplicatesNear ?? 0)

  const tiles: Tile[] = [
    {
      labelKey: 'importPreviewSummaryTotal',
      fallback: 'Total rows',
      value: total,
      toneVar: 'var(--color-text-primary)',
    },
    {
      labelKey: 'importPreviewSummaryValid',
      fallback: 'Valid',
      value: valid,
      toneVar: 'var(--color-success, var(--color-text-primary))',
    },
    {
      labelKey: 'importPreviewSummaryErrors',
      fallback: 'Errors',
      value: errors,
      toneVar: 'var(--color-danger, var(--color-text-primary))',
    },
    {
      labelKey: 'importPreviewSummaryDuplicates',
      fallback: 'Duplicates',
      value: dupes,
      toneVar: 'var(--color-warning, var(--color-text-primary))',
    },
  ]

  return (
    <Card variant="default" className="p-4 space-y-3">
      <h2
        className="font-semibold"
        style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
      >
        {t.importPreviewSummaryTitle ?? 'Preview summary'}
      </h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {t.importPreviewSummaryBody ?? 'Nothing is saved yet. Review each row before committing.'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.labelKey}
            className="rounded-[var(--radius-md)] p-3 min-h-[64px]"
            style={{
              backgroundColor: 'var(--color-gray-50)',
              border: '1px solid var(--color-gray-100)',
            }}
          >
            <div
              className="font-semibold tabular-nums"
              style={{ fontSize: 'var(--fs-xl)', color: tile.toneVar }}
            >
              {tile.value}
            </div>
            <div
              className="mt-1"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
            >
              {t[tile.labelKey] ?? tile.fallback}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
