/** Dashboard — API service layer
 *
 * All paths are relative to API_URL (the `api()` helper prefixes it).
 */

import { api } from '@/lib/api'
import type { HomeDashboardData, DashboardStats, DashboardFilters } from './dashboard.types'

// ─── Home dashboard (single call) ──────────────────────────────────────────

/**
 * Fetch the home dashboard data in one call.
 * No date filter — always returns current state + today's numbers.
 */
export async function getHomeDashboard(signal?: AbortSignal): Promise<HomeDashboardData> {
  return api<HomeDashboardData>('/dashboard/home', { signal })
}

// ─── Legacy stats endpoint (Reports page) ──────────────────────────────────

function buildQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams()
  params.set('range', filters.range)
  if (filters.range === 'custom') {
    if (filters.from) params.set('from', filters.from)
    if (filters.to)   params.set('to',   filters.to)
  }
  return params.toString()
}

export async function getDashboardStats(
  filters: DashboardFilters,
  signal?: AbortSignal
): Promise<DashboardStats> {
  const query = buildQuery(filters)
  return api<DashboardStats>(`/dashboard/stats?${query}`, { signal })
}
