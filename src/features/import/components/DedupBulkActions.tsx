/**
 * Phase 7 Slice 7.1A FE.4 — Bulk-apply buttons.
 *
 * Three buttons at the top of the dedup view: Skip all / Overwrite all /
 * Create new for all. Each one calls `setAll(decision)` on the parent
 * dedup state hook. Disabled while the dup set is empty.
 */

import { Button } from '@/components/ui/Button'
import type { DedupDecision } from '../types/dedup.types'

interface DedupBulkActionsProps {
  total: number
  onSetAll: (decision: DedupDecision) => void
  t: Record<string, string>
}

export function DedupBulkActions({
  total,
  onSetAll,
  t,
}: DedupBulkActionsProps) {
  const disabled = total === 0
  return (
    <div
      role="group"
      aria-label={t.importDedupBulkAriaLabel ?? 'Apply to all duplicates'}
      className="flex flex-wrap gap-2"
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onSetAll('SKIP')}
        disabled={disabled}
        className="min-h-[44px]"
      >
        {t.importDedupBulkSkipAll ?? 'Skip all'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onSetAll('OVERWRITE')}
        disabled={disabled}
        className="min-h-[44px]"
      >
        {t.importDedupBulkOverwriteAll ?? 'Overwrite all'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onSetAll('CREATE_NEW')}
        disabled={disabled}
        className="min-h-[44px]"
      >
        {t.importDedupBulkCreateAll ?? 'Create new for all'}
      </Button>
    </div>
  )
}
