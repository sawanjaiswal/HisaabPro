/** Smart inventory (#148) — read-only API call.
 *
 * Network-only: stock levels + costs are per-tenant and change fast, so they
 * must not land in the offline read cache (OFFLINE_RULES Rule 3). */

import { api } from '@/lib/api'
import type { ReorderForecast } from './reorder.types'

export async function getReorderSuggestions(
  onlyNeeded: boolean,
  leadTimeDays: number,
  coverageDays: number,
  signal?: AbortSignal,
): Promise<ReorderForecast> {
  const params = new URLSearchParams({
    onlyNeeded: String(onlyNeeded),
    leadTimeDays: String(leadTimeDays),
    coverageDays: String(coverageDays),
  })
  return api<ReorderForecast>(`/inventory/reorder-suggestions?${params}`, {
    cacheReads: false,
    signal,
  })
}
