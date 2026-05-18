/** Employee — Phase 6 PR6 FE service layer
 *
 * Endpoints (all under /api/hr — api() prepends API_URL):
 *
 *   GET    /hr/employees?q&limit&cursor&isDeleted   → EmployeeListResponse
 *   GET    /hr/employees/:id                        → { employee }
 *   POST   /hr/employees    (X-Idempotency-Key)     → EmployeeCreateResponse
 *   PATCH  /hr/employees/:id (X-Idempotency-Key)    → EmployeeUpdateResponse
 *   DELETE /hr/employees/:id (X-Idempotency-Key)    → { employee }
 *
 * Mutations pass `entityType: 'employee'` + `entityLabel: name` so the
 * SyncQueueDrawer can surface "Saving employee — Raju Mehta" instead of
 * "Offline change". Idempotency keys are minted by the caller (the mutation
 * hook in `useEmployees.ts`) so a network retry replays the same key.
 *
 * Reads are NOT cached (no `cacheReads: true`) — employee names + phones are
 * PII and the list changes when the user adds/removes staff. Stale roster
 * is worse than a brief skeleton.
 */

import { api } from '@/lib/api'
import type {
  Employee,
  EmployeeCreateResponse,
  EmployeeInput,
  EmployeeListResponse,
  EmployeePatchInput,
  EmployeeUpdateResponse,
} from './hr.types'

// ─── List query builder ──────────────────────────────────────────────────────

export interface ListEmployeesParams {
  q?: string
  limit?: number
  cursor?: string
  isDeleted?: boolean
}

export function buildEmployeeListQuery(params: ListEmployeesParams): string {
  const q = new URLSearchParams()
  if (params.q && params.q.trim().length > 0) q.set('q', params.q.trim())
  if (params.limit !== undefined) q.set('limit', String(params.limit))
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.isDeleted !== undefined) q.set('isDeleted', String(params.isDeleted))
  return q.toString()
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Single-page list — caller paginates by passing `cursor` from previous result. */
export async function listEmployees(
  params: ListEmployeesParams = {},
  signal?: AbortSignal,
): Promise<EmployeeListResponse> {
  const qs = buildEmployeeListQuery(params)
  const path = qs.length > 0 ? `/hr/employees?${qs}` : '/hr/employees'
  return api<EmployeeListResponse>(path, { signal })
}

/** Fetch one Employee by id. Throws ApiError(NOT_FOUND, 404) on missing/x-tenant. */
export async function getEmployee(id: string, signal?: AbortSignal): Promise<Employee> {
  const result = await api<{ employee: Employee }>(`/hr/employees/${id}`, { signal })
  return result.employee
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** POST /hr/employees — returns the new Employee + paired STAFF Party. */
export async function createEmployee(
  input: EmployeeInput,
  idempotencyKey: string,
): Promise<EmployeeCreateResponse> {
  return api<EmployeeCreateResponse>('/hr/employees', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'employee',
    entityLabel: input.name,
  })
}

/** PATCH /hr/employees/:id — partial update. `partyId` is server-side immutable. */
export async function updateEmployee(
  id: string,
  patch: EmployeePatchInput,
  idempotencyKey: string,
  entityLabel: string,
): Promise<EmployeeUpdateResponse> {
  return api<EmployeeUpdateResponse>(`/hr/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'employee',
    entityLabel,
  })
}

/** DELETE /hr/employees/:id — soft-delete Employee + paired STAFF Party. */
export async function deleteEmployee(
  id: string,
  idempotencyKey: string,
  entityLabel: string,
): Promise<{ employee: Employee }> {
  return api<{ employee: Employee }>(`/hr/employees/${id}`, {
    method: 'DELETE',
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'employee',
    entityLabel,
  })
}
