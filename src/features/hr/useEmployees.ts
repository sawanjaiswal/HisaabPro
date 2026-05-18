/** useEmployees — Phase 6 PR5 FE
 *
 * Loads the employee list from GET /hr/employees. PR6 ships the endpoint —
 * for PR5 FE we tolerate the 404 (returns []) so the Attendance page can
 * render its "Add your first employee" empty state without crashing.
 *
 * When PR6 backend lands the same code starts populating the grid without a
 * single change here. (A 200 response wins; a 404 yields the empty state;
 * any other error surfaces via React Query's `error`.)
 *
 * Note: we do NOT pass `cacheReads: true`. The employee list contains PII
 * (names, roles) and changes when the user adds/removes staff — caching it
 * would risk a stale roster, which is worse than a brief skeleton.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { EmployeeLite, EmployeeListResponse } from './hr.types'

// ─── Query key ───────────────────────────────────────────────────────────────

export const employeeKeys = {
  all:  () => ['hr', 'employees'] as const,
  list: () => ['hr', 'employees', 'list'] as const,
}

// ─── Service helper (kept inline — single endpoint, no separate service file) ─

export async function listEmployees(signal?: AbortSignal): Promise<EmployeeLite[]> {
  try {
    const response = await api<EmployeeListResponse>('/hr/employees', { signal })
    return response.employees ?? []
  } catch (err) {
    // PR6 ships the endpoint — until then 404 is the expected "no list yet"
    // state and we surface it as an empty array, not an error.
    if (err instanceof ApiError && err.status === 404) return []
    throw err
  }
}

// ─── useEmployees ────────────────────────────────────────────────────────────

export function useEmployees() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: employeeKeys.list(),
    queryFn: ({ signal }) => listEmployees(signal),
    staleTime: 60_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: employeeKeys.all() })
  }, [queryClient])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    employees: query.data ?? [],
    status,
    error: query.error,
    refresh,
  }
}
