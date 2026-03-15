/** Dashboard — API service layer
 *
 * All paths are relative to API_URL (the `api()` helper prefixes it).
 * Use /dashboard/... NOT /api/dashboard/...
 */

import { api } from '@/lib/api'
import type { DashboardStats, DashboardFilters } from './dashboard.types'

// ─── Query builder ────────────────────────────────────────────────────────────

/**
 * Convert filter state into a URL query string.
 * Custom range sends explicit from/to; presets send only range key.
 */
function buildQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams()

  params.set('range', filters.range)

  if (filters.range === 'custom') {
    if (filters.from) params.set('from', filters.from)
    if (filters.to)   params.set('to',   filters.to)
  }

  return params.toString()
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * Fetch dashboard summary stats for the given filter range.
 * Returns the inner data object directly (api() unwraps success/data).
 * Passes signal for AbortController cleanup in useEffect.
 */
export async function getDashboardStats(
  filters: DashboardFilters,
  signal?: AbortSignal
): Promise<DashboardStats> {
  const query = buildQuery(filters)
  return api<DashboardStats>(`/dashboard/stats?${query}`, { signal })
}
