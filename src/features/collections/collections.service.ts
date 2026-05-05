/**
 * Collections Service — API calls for collections feature.
 * All calls go through api() from @/lib/api per offline rules.
 */

import { api } from '@/lib/api'
import type {
  AgingBucketResult,
  AgingPartiesResult,
  AgingBucketParam,
  Ptp,
  PtpListResult,
  CreatePtpInput,
  UpdatePtpInput,
  PtpStatus,
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
 * Create a Promise-to-Pay record.
 */
export async function createPtp(input: CreatePtpInput): Promise<Ptp> {
  return api<Ptp>('/api/collections/ptp', {
    method: 'POST',
    body: JSON.stringify(input),
    entityType: 'ptp',
    entityLabel: `PTP Rs ${(input.amountPaise / 100).toFixed(0)}`,
  })
}

/**
 * Fetch cursor-paginated PTP list for a party.
 */
export async function getPtpList(
  partyId: string,
  status?: PtpStatus,
  cursor?: string,
  limit = 20
): Promise<PtpListResult> {
  const params = new URLSearchParams({ partyId, limit: String(limit) })
  if (status) params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  return api<PtpListResult>(`/api/collections/ptp?${params.toString()}`, {
    cacheReads: false,
  })
}

/**
 * Update an OPEN PTP record.
 */
export async function updatePtp(id: string, input: UpdatePtpInput): Promise<Ptp> {
  return api<Ptp>(`/api/collections/ptp/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    entityType: 'ptp',
    entityLabel: `PTP ${id}`,
  })
}

/**
 * Delete an OPEN PTP record.
 */
export async function deletePtp(id: string): Promise<void> {
  return api<void>(`/api/collections/ptp/${id}`, {
    method: 'DELETE',
    entityType: 'ptp',
    entityLabel: `PTP ${id}`,
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
