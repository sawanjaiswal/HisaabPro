/** employee.service tests — Phase 6 PR6 FE
 *
 * Coverage:
 *   - buildEmployeeListQuery() builds q + cursor + limit correctly
 *   - listEmployees / getEmployee / createEmployee / updateEmployee / deleteEmployee
 *     hit the right paths + verbs
 *   - All mutations pass entityType=employee + a human-readable entityLabel
 *   - Mutations forward X-Idempotency-Key when supplied
 *   - 404 surfaces as ApiError (caller's notFound detection depends on this)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.fn()

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status: number) {
      super(message); this.code = code; this.status = status
    }
  },
}))

import {
  buildEmployeeListQuery,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../employee.service'
import { ApiError } from '@/lib/api'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildEmployeeListQuery ─────────────────────────────────────────────────

describe('buildEmployeeListQuery', () => {
  it('builds an empty querystring when no options supplied', () => {
    expect(buildEmployeeListQuery({})).toBe('')
  })

  it('includes q when present and non-empty', () => {
    expect(buildEmployeeListQuery({ q: 'Raju' })).toBe('q=Raju')
  })

  it('skips q when empty string', () => {
    expect(buildEmployeeListQuery({ q: '' })).toBe('')
  })

  it('includes cursor for next-page pagination', () => {
    expect(buildEmployeeListQuery({ cursor: 'emp_42' })).toContain('cursor=emp_42')
  })

  it('includes limit when supplied', () => {
    expect(buildEmployeeListQuery({ limit: 50 })).toContain('limit=50')
  })

  it('encodes special characters in q', () => {
    const qs = buildEmployeeListQuery({ q: 'M&M Traders' })
    expect(qs).toContain('q=M%26M+Traders')
  })
})

// ─── listEmployees ──────────────────────────────────────────────────────────

describe('listEmployees', () => {
  it('hits /hr/employees with no query when called bare', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    await listEmployees()
    const [path] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/employees')
  })

  it('appends the querystring when filters present', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    await listEmployees({ q: 'Priya', limit: 10 })
    const [path] = mockApi.mock.calls[0]
    expect(String(path).startsWith('/hr/employees?')).toBe(true)
    expect(String(path)).toContain('q=Priya')
    expect(String(path)).toContain('limit=10')
  })

  it('forwards the AbortSignal', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    const c = new AbortController()
    await listEmployees({}, c.signal)
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { signal?: AbortSignal })?.signal).toBe(c.signal)
  })
})

// ─── getEmployee ────────────────────────────────────────────────────────────

describe('getEmployee', () => {
  it('hits /hr/employees/:id with the id in the path', async () => {
    mockApi.mockResolvedValue({
      employee: { id: 'emp_1', name: 'Raju', dailyRate: 100000, isDeleted: false },
    })
    await getEmployee('emp_1')
    const [path] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/employees/emp_1')
  })

  it('propagates a 404 as ApiError so the caller can detect notFound', async () => {
    mockApi.mockRejectedValue(new ApiError('Not found', 'EMPLOYEE_NOT_FOUND', 404))
    await expect(getEmployee('missing')).rejects.toMatchObject({ status: 404 })
  })
})

// ─── createEmployee ─────────────────────────────────────────────────────────

describe('createEmployee', () => {
  const INPUT = {
    name: 'Raju Mehta',
    phone: null,
    designation: 'Driver',
    dailyRatePaise: 150000,
  }

  it('POSTs to /hr/employees with the input as body', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_n' }, party: { id: 'p_n' } })
    await createEmployee(INPUT, 'idem-001')
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/employees')
    expect((opts as { method: string }).method).toBe('POST')
    expect(JSON.parse((opts as { body: string }).body)).toEqual(INPUT)
  })

  it('passes the idempotency key for replay-safe creates', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_n' }, party: { id: 'p_n' } })
    await createEmployee(INPUT, 'abc-123')
    const [, opts] = mockApi.mock.calls[0]
    const headers = (opts as { headers: Record<string, string> }).headers
    expect(headers['X-Idempotency-Key']).toBe('abc-123')
  })

  it('tags the offline queue with entityType=employee + name as label', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_n' }, party: { id: 'p_n' } })
    await createEmployee(INPUT, 'idem-002')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('employee')
    expect((opts as { entityLabel: string }).entityLabel).toBe('Raju Mehta')
  })
})

// ─── updateEmployee ─────────────────────────────────────────────────────────

describe('updateEmployee', () => {
  it('PATCHes to /hr/employees/:id with the partial body', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_1' } })
    // signature: (id, patch, idempotencyKey, entityLabel)
    await updateEmployee('emp_1', { name: 'Updated' }, 'idem-u-1', 'updated label')
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/employees/emp_1')
    expect((opts as { method: string }).method).toBe('PATCH')
    expect(JSON.parse((opts as { body: string }).body)).toEqual({ name: 'Updated' })
  })

  it('passes entityType + entityLabel for the offline queue UI', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_1' } })
    await updateEmployee('emp_1', { designation: 'Manager' }, 'idem-u-2', 'Updated Manager')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('employee')
    expect((opts as { entityLabel: string }).entityLabel).toBe('Updated Manager')
  })
})

// ─── deleteEmployee ─────────────────────────────────────────────────────────

describe('deleteEmployee', () => {
  it('DELETEs /hr/employees/:id', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_1', isDeleted: true } })
    // signature: (id, idempotencyKey, entityLabel)
    await deleteEmployee('emp_1', 'idem-d-1', 'Raju')
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/employees/emp_1')
    expect((opts as { method: string }).method).toBe('DELETE')
  })

  it('passes entityType=employee + the name as the offline-queue label', async () => {
    mockApi.mockResolvedValue({ employee: { id: 'emp_1', isDeleted: true } })
    await deleteEmployee('emp_1', 'idem-d-2', 'Raju Mehta')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('employee')
    expect((opts as { entityLabel: string }).entityLabel).toBe('Raju Mehta')
  })
})
