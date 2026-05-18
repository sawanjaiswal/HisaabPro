/** useEmployees — Phase 6 PR6 FE
 *
 * Rewrite of the PR5 placeholder. PR5 tolerated a 404 from the (not-yet-shipped)
 * /hr/employees endpoint; PR6 BE ships the real endpoint so the 404 tolerance
 * is gone — a 404 here now means real misconfiguration and we surface it.
 *
 * Three hooks:
 *   - useEmployees()           — list (paginated; first page) returning the
 *                                trimmed EmployeeLite shape PR5's AttendanceGrid
 *                                consumes (`{ id, name, role, active }`).
 *   - useEmployee(id)          — single Employee (full wire shape).
 *   - useEmployeeMutations()   — create / update / delete with idempotency,
 *                                React-Query invalidation, toasts.
 *
 * Pagination strategy: the attendance grid + the employee list page both only
 * need page 1 (default 20 rows). When we add infinite scroll on the list page
 * (post-MVP), we'll add `useEmployeesInfinite()` alongside — no need to ship
 * it now and re-flow the simple `employees` shape consumers depend on.
 *
 * NOT cached (no `cacheReads: true`) — employee list contains PII (names,
 * phones) and changes when the user adds/removes staff. Stale roster is
 * worse than a brief skeleton.
 */

import { useCallback } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from './employee.service'
import { idempotencyKey } from './hr.constants'
import type {
  Employee,
  EmployeeCreateResponse,
  EmployeeInput,
  EmployeeLite,
  EmployeePatchInput,
  EmployeeUpdateResponse,
} from './hr.types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const employeeKeys = {
  all:  () => ['hr', 'employees'] as const,
  list: () => ['hr', 'employees', 'list'] as const,
  byId: (id: string) => ['hr', 'employees', 'byId', id] as const,
}

// ─── Adapter — Employee → EmployeeLite ───────────────────────────────────────

/**
 * AttendanceGrid (PR5) reads `emp.role` + `emp.active`. PR6 backs those with
 * `designation` and `!isDeleted` from the full wire row. Keep the mapping
 * here so consumers don't have to re-derive it.
 */
export function toEmployeeLite(row: Employee): EmployeeLite {
  return {
    id: row.id,
    name: row.name,
    role: row.designation ?? null,
    active: !row.isDeleted && row.leftAt === null,
  }
}

// ─── useEmployees (list — first page) ────────────────────────────────────────

/**
 * Loads the first page of employees. Returns BOTH the EmployeeLite array
 * (for the attendance grid that's been consuming this surface since PR5)
 * AND the full Employee[] (for the new PR6 list page that needs designation,
 * dailyRate, etc.). Same query, two views.
 */
export function useEmployees() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: employeeKeys.list(),
    queryFn: ({ signal }) => listEmployees({ limit: 100 }, signal),
    staleTime: 60_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: employeeKeys.all() })
  }, [queryClient])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const rows = query.data?.rows ?? []

  return {
    /** PR5-compat surface — EmployeeLite consumed by AttendanceGrid. */
    employees: rows.map(toEmployeeLite),
    /** Full wire rows for PR6 list page. */
    rows,
    nextCursor: query.data?.nextCursor ?? null,
    status,
    error: query.error,
    refresh,
  }
}

// ─── useEmployee (single) ────────────────────────────────────────────────────

export function useEmployee(id: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: employeeKeys.byId(id ?? '_missing'),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('employee id is required')
      return getEmployee(id, signal)
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  })

  const refresh = useCallback(() => {
    if (id) void queryClient.invalidateQueries({ queryKey: employeeKeys.byId(id) })
  }, [queryClient, id])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    employee: query.data ?? null,
    status,
    error: query.error,
    refresh,
    /** 404 from the BE = treat as "not found" rather than a generic error. */
    notFound: query.error instanceof ApiError && query.error.status === 404,
  }
}

// ─── useEmployeeMutations ────────────────────────────────────────────────────

/**
 * Single hook exposing create / update / delete. Each tolerates the offline
 * queue's optimistic `{}` return — never deref response fields blindly.
 *
 * Toasts:
 *   - success (online):  "Employee saved" / "Employee deleted"
 *   - success (offline): "Employee saved — will sync when online"
 *   - error:             ApiError.message verbatim (BE crafts user-readable
 *                        messages; we never invent "Something went wrong" here)
 */
export function useEmployeeMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLanguage()

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: employeeKeys.all() })
  }

  const create = useMutation({
    mutationFn: (input: EmployeeInput): Promise<EmployeeCreateResponse> =>
      createEmployee(input, idempotencyKey()),
    onSuccess: (_result, input) => {
      invalidateAll()
      const msg = navigator.onLine
        ? `${t.employeeSavedToast}`
        : `${t.employeeSavedToast} — ${t.willSyncWhenOnlineSuffix}`
      toast.success(`${input.name} — ${msg}`)
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (t.employeeSaveErrorToast as string)
      toast.error(msg)
    },
  })

  const update = useMutation({
    mutationFn: (args: { id: string; patch: EmployeePatchInput; name: string })
      : Promise<EmployeeUpdateResponse> =>
      updateEmployee(args.id, args.patch, idempotencyKey(), args.name),
    onSuccess: (_result, args) => {
      invalidateAll()
      const msg = navigator.onLine
        ? (t.employeeSavedToast as string)
        : `${t.employeeSavedToast} — ${t.willSyncWhenOnlineSuffix}`
      toast.success(`${args.name} — ${msg}`)
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (t.employeeSaveErrorToast as string)
      toast.error(msg)
    },
  })

  const remove = useMutation({
    mutationFn: (args: { id: string; name: string }) =>
      deleteEmployee(args.id, idempotencyKey(), args.name),
    onSuccess: (_result, args) => {
      invalidateAll()
      toast.success(`${args.name} — ${t.employeeDeletedToast as string}`)
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (t.employeeDeleteErrorToast as string)
      toast.error(msg)
    },
  })

  return { create, update, remove }
}
