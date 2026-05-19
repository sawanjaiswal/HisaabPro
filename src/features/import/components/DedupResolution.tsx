/**
 * Phase 7 Slice 7.1A FE.4 — Dedup resolution orchestrator.
 *
 * Lists every DUPLICATE_EXACT / DUPLICATE_NEAR row from the preview as
 * a <DedupRowCard>. Top: bulk-apply buttons + counts. Bottom: back +
 * continue-to-commit actions.
 *
 * State is OWNED by `useDedupState` here, but the parent
 * <ImportJobPage> passes initial seed + onContinue(resolutions) so the
 * resolution map survives back/forward navigation between views.
 *
 * Why no separate route: the dedup screen is a pre-commit FE-only step
 * — server status stays PREVIEWED — so a route change would be
 * misleading and would also lose the loaded rows. See SCOPE §FE.4.
 */

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useDedupState } from '../hooks/useDedupState'
import type { ImportEntity, ImportPreviewRow } from '../types/import.types'
import type { DedupResolutionMap } from '../types/dedup.types'
import { DedupBulkActions } from './DedupBulkActions'
import { DedupRowCard } from './DedupRowCard'

interface DedupResolutionProps {
  /** Full set of preview rows loaded so far (pagination-aware). */
  rows: ImportPreviewRow[]
  /** Optional seed (back-nav from commit view). */
  initialResolutions?: DedupResolutionMap
  /** 7.1B: which entity is being reviewed — drives copy. */
  entity?: ImportEntity
  onBack: () => void
  onContinue: (resolutions: DedupResolutionMap) => void
  t: Record<string, string>
}

export function DedupResolution({
  rows,
  initialResolutions,
  entity = 'parties',
  onBack,
  onContinue,
  t,
}: DedupResolutionProps) {
  const { dupRows, resolutions, counts, setOne, setAll } = useDedupState({
    rows,
    initial: initialResolutions,
  })

  const continueDisabled = useMemo(() => {
    // Every dup row must have a decision (defaults guarantee this, but
    // guard against a stale resolution map missing a key).
    return dupRows.some(({ row }) => resolutions[row.id] === undefined)
  }, [dupRows, resolutions])

  return (
    <div className="space-y-4">
      <Card variant="default" className="p-4 space-y-3">
        <header className="space-y-1">
          <h2
            className="font-semibold"
            style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-primary)' }}
          >
            {entity === 'product'
              ? (t.importDedupTitleProduct ?? t.importDedupTitle ?? 'Review duplicate products')
              : (t.importDedupTitle ?? 'Review duplicates')}
          </h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
            {entity === 'product'
              ? (t.importDedupIntroProduct ??
                'These rows look like products you already have. Pick what should happen for each one before committing.')
              : (t.importDedupIntro ??
                'These rows look like parties you already have. Pick what should happen for each one before committing.')}
          </p>
        </header>

        <DedupBulkActions total={counts.total} onSetAll={setAll} t={t} />

        <p
          aria-live="polite"
          className="tabular-nums"
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
        >
          {(t.importDedupCountsLine ?? '{skip} skip · {overwrite} overwrite · {createNew} create new')
            .replace('{skip}', String(counts.skip))
            .replace('{overwrite}', String(counts.overwrite))
            .replace('{createNew}', String(counts.createNew))}
        </p>
      </Card>

      {dupRows.length === 0 ? (
        <EmptyState
          title={t.importDedupEmptyTitle ?? 'No duplicates to review'}
          description={
            t.importDedupEmptyBody ??
            'You can continue straight to commit.'
          }
        />
      ) : (
        <ul className="space-y-3 list-none p-0">
          {dupRows.map((item) => (
            <li key={item.row.id}>
              <DedupRowCard
                item={item}
                decision={resolutions[item.row.id] ?? 'SKIP'}
                onChange={(d) => setOne(item.row.id, d)}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3 pt-2">
        <Button
          variant="ghost"
          size="lg"
          onClick={onBack}
          className="min-h-[44px]"
        >
          {t.importDedupBack ?? 'Back to preview'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onContinue(resolutions)}
          disabled={continueDisabled}
          className="min-h-[44px]"
        >
          {t.importPreviewContinueCommit ?? 'Continue to commit'}
        </Button>
      </div>
    </div>
  )
}
