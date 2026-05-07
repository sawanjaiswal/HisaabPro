/** Expenses — Trend service (frontend) */

import { api } from '@/lib/api'
import type { TrendPoint } from '../expense.types'

/**
 * Fetches last N months of expense totals.
 * The server endpoint is GET /expenses/trend?months=6
 * Returns TrendPoint[] sorted oldest → newest.
 */
export async function getExpenseTrend(
  months = 6,
  signal?: AbortSignal
): Promise<TrendPoint[]> {
  const params = new URLSearchParams({ months: String(months) })
  return api<TrendPoint[]>(`/expenses/trend?${params}`, { signal })
}
