/** Smart inventory (#148) — query defaults, cache key, urgency display map. */

import type { ReorderUrgency } from './reorder.types'

export const REORDER_WINDOW_DAYS = 30
export const REORDER_LEAD_TIME_DAYS = 7
export const REORDER_COVERAGE_DAYS = 30

export const reorderKeys = {
  list: (onlyNeeded: boolean, leadTimeDays: number, coverageDays: number) =>
    ['reorder', 'suggestions', onlyNeeded, leadTimeDays, coverageDays] as const,
}

type UrgencyLabelKey = 'urgencyOut' | 'urgencyCritical' | 'urgencyLow' | 'urgencyOk'

/** CSS modifier + translation-key suffix per urgency (own pill, not <Badge>). */
export const URGENCY_META: Record<
  ReorderUrgency,
  { modifier: string; labelKey: UrgencyLabelKey }
> = {
  out: { modifier: 'reorder-pill--out', labelKey: 'urgencyOut' },
  critical: { modifier: 'reorder-pill--critical', labelKey: 'urgencyCritical' },
  low: { modifier: 'reorder-pill--low', labelKey: 'urgencyLow' },
  ok: { modifier: 'reorder-pill--ok', labelKey: 'urgencyOk' },
}
