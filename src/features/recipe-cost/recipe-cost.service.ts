/** Recipe Cost Dashboard — read-only API call.
 *
 * Network-only: recipe costs are derived from per-tenant cost data, so they
 * must not land in the offline read cache (OFFLINE_RULES Rule 3). */

import { api } from '@/lib/api'
import type { RecipeCostSummary } from './recipe-cost.types'

export async function getRecipeCostSummary(signal?: AbortSignal): Promise<RecipeCostSummary> {
  return api<RecipeCostSummary>('/recipe-cost', { cacheReads: false, signal })
}
