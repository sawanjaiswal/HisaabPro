/**
 * Collections Service — API calls for collections feature.
 * All calls go through api() from @/lib/api per offline rules.
 */

import { api } from '@/lib/api'
import type {
  AgingBucketResult,
  AgingPartiesResult,
  AgingBucketParam,
} from './collections.types'

/**
 * Fetch full aging bucket summary for the current business.
 * Scoped server-side via req.user.businessId.
 */
export async function getAging(): Promise<AgingBucketResult> {
  return api<AgingBucketResult>('/api/collections/aging', {
    cacheReads: true,
  })
}

/**
 * Fetch cursor-paginated parties in a specific aging bucket.
 */
export async function getAgingParties(
  bucket: AgingBucketParam,
  cursor?: string,
  limit = 20
): Promise<AgingPartiesResult> {
  const params = new URLSearchParams({ bucket, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)

  return api<AgingPartiesResult>(
    `/api/collections/aging/parties?${params.toString()}`,
    { cacheReads: false }
  )
}
