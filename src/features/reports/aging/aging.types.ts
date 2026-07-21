/** Aging report (#66 Customer Balance Summary) — view-model types. */

import type { BadgeVariant } from '@/components/ui/Badge'
import type { AgingRow } from '../finance.types'

/**
 * The bucket chip row. `ALL` is the unfiltered view; the rest map 1:1 onto the
 * numeric columns the API already returns, so no derived bucket exists that the
 * server does not.
 */
export type AgingBucket = 'ALL' | 'CURRENT' | 'D31_60' | 'D61_90' | 'OVER_90'

/** The four real buckets, oldest last — the order the table columns follow. */
export const AGING_BUCKETS = ['CURRENT', 'D31_60', 'D61_90', 'OVER_90'] as const

export type RealAgingBucket = (typeof AGING_BUCKETS)[number]

/** Which numeric field on an `AgingRow` each bucket reads. */
export const BUCKET_FIELD: Record<RealAgingBucket, keyof Pick<
  AgingRow,
  'current' | 'days31to60' | 'days61to90' | 'over90'
>> = {
  CURRENT: 'current',
  D31_60: 'days31to60',
  D61_90: 'days61to90',
  OVER_90: 'over90',
}

/**
 * How each bucket reads as a status pill. Ages up in severity: money inside
 * terms is neutral, 31-60 is a warning, anything past 60 days is overdue.
 */
export const BUCKET_BADGE: Record<RealAgingBucket, BadgeVariant> = {
  CURRENT: 'draft',
  D31_60: 'pending',
  D61_90: 'overdue',
  OVER_90: 'overdue',
}
