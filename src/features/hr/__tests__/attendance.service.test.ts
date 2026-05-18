/** attendance.service tests — Phase 6 PR5 FE
 *
 * Coverage:
 *   - buildAttendanceListQuery() emits from/to always; employeeIds only when non-empty
 *   - listAttendance() forwards the AbortSignal verbatim and hits the right path
 *   - saveAttendanceBatch() passes X-Idempotency-Key + entityType + entityLabel
 *     (the three pieces that drive: BE de-dupe, offline queue, sync UI)
 *   - The 400 INVALID_EMPLOYEE_ID error from the BE surfaces as an ApiError
 *     (caller relies on `err instanceof ApiError && err.code`)
 *
 * We mock `@/lib/api` so this test never hits the network; the contract under
 * test is the shape of the call we make, not what the wrapper does with it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────

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
  buildAttendanceListQuery,
  listAttendance,
  saveAttendanceBatch,
} from '../attendance.service'
import { ApiError } from '@/lib/api'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildAttendanceListQuery ───────────────────────────────────────────────

describe('buildAttendanceListQuery', () => {
  it('emits from + to and nothing else when employeeIds is absent', () => {
    const qs = buildAttendanceListQuery({ from: '2026-05-11', to: '2026-05-17' })
    const params = new URLSearchParams(qs)
    expect(params.get('from')).toBe('2026-05-11')
    expect(params.get('to')).toBe('2026-05-17')
    expect(params.get('employeeIds')).toBeNull()
  })

  it('emits from + to and nothing else when employeeIds is empty array', () => {
    const qs = buildAttendanceListQuery({
      from: '2026-05-11',
      to: '2026-05-17',
      employeeIds: [],
    })
    const params = new URLSearchParams(qs)
    expect(params.get('employeeIds')).toBeNull()
  })

  it('joins employeeIds with a comma when supplied', () => {
    const qs = buildAttendanceListQuery({
      from: '2026-05-11',
      to: '2026-05-17',
      employeeIds: ['emp_a', 'emp_b', 'emp_c'],
    })
    const params = new URLSearchParams(qs)
    expect(params.get('employeeIds')).toBe('emp_a,emp_b,emp_c')
  })

  it('does not mangle ISO yyyy-mm-dd date format', () => {
    const qs = buildAttendanceListQuery({ from: '2026-01-01', to: '2026-12-31' })
    expect(qs).toContain('from=2026-01-01')
    expect(qs).toContain('to=2026-12-31')
  })
})

// ─── listAttendance ─────────────────────────────────────────────────────────

describe('listAttendance', () => {
  it('hits /hr/attendance with the right query string', async () => {
    mockApi.mockResolvedValue({ rows: [] })
    await listAttendance('2026-05-11', '2026-05-17', undefined)
    expect(mockApi).toHaveBeenCalledTimes(1)
    const [path] = mockApi.mock.calls[0]
    expect(String(path).startsWith('/hr/attendance?')).toBe(true)
    expect(String(path)).toContain('from=2026-05-11')
    expect(String(path)).toContain('to=2026-05-17')
    // No filter means no employeeIds key on the wire
    expect(String(path)).not.toContain('employeeIds=')
  })

  it('forwards the employeeIds filter when present', async () => {
    mockApi.mockResolvedValue({ rows: [] })
    await listAttendance('2026-05-11', '2026-05-17', ['emp_1', 'emp_2'])
    const [path] = mockApi.mock.calls[0]
    expect(String(path)).toContain('employeeIds=emp_1%2Cemp_2')
  })

  it('forwards the AbortSignal so React Query can cancel in-flight requests', async () => {
    mockApi.mockResolvedValue({ rows: [] })
    const controller = new AbortController()
    await listAttendance('2026-05-11', '2026-05-17', undefined, controller.signal)
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { signal?: AbortSignal })?.signal).toBe(controller.signal)
  })

  it('returns the BE response shape verbatim ({ rows: [...] })', async () => {
    const rows = [
      {
        id: 'a1',
        businessId: 'biz_1',
        employeeId: 'emp_1',
        date: '2026-05-11',
        status: 'PRESENT' as const,
        overtimeMin: 0,
        note: null,
        createdAt: '2026-05-11T08:00:00.000Z',
      },
    ]
    mockApi.mockResolvedValue({ rows })
    const result = await listAttendance('2026-05-11', '2026-05-17', undefined)
    expect(result.rows).toEqual(rows)
  })
})

// ─── saveAttendanceBatch ────────────────────────────────────────────────────

describe('saveAttendanceBatch', () => {
  const SAMPLE_PAYLOAD = {
    entries: [
      { employeeId: 'emp_1', date: '2026-05-11', status: 'PRESENT' as const },
      { employeeId: 'emp_1', date: '2026-05-12', status: 'HALF_DAY' as const },
    ],
  }

  it('POSTs to /hr/attendance/batch with the right verb and body', async () => {
    mockApi.mockResolvedValue({ written: 2, byStatus: { PRESENT: 1, HALF_DAY: 1 } })
    await saveAttendanceBatch(SAMPLE_PAYLOAD, 'idem-key-001')
    expect(mockApi).toHaveBeenCalledTimes(1)
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/hr/attendance/batch')
    expect((opts as { method: string }).method).toBe('POST')
    expect(JSON.parse((opts as { body: string }).body)).toEqual(SAMPLE_PAYLOAD)
  })

  it('passes X-Idempotency-Key header so retries de-dupe at the BE', async () => {
    mockApi.mockResolvedValue({ written: 0, byStatus: {} })
    await saveAttendanceBatch(SAMPLE_PAYLOAD, '5f1c-deadbeef-abc-123')
    const [, opts] = mockApi.mock.calls[0]
    const headers = (opts as { headers: Record<string, string> }).headers
    expect(headers['X-Idempotency-Key']).toBe('5f1c-deadbeef-abc-123')
  })

  it('passes entityType=attendance for the offline-queue UI', async () => {
    mockApi.mockResolvedValue({ written: 0, byStatus: {} })
    await saveAttendanceBatch(SAMPLE_PAYLOAD, 'idem')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('attendance')
  })

  it('passes a human-readable entityLabel with the entry count', async () => {
    mockApi.mockResolvedValue({ written: 0, byStatus: {} })
    await saveAttendanceBatch(SAMPLE_PAYLOAD, 'idem')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityLabel: string }).entityLabel).toBe('Attendance batch (2 entries)')
  })

  it('propagates a 400 INVALID_EMPLOYEE_ID as an ApiError to the caller', async () => {
    mockApi.mockRejectedValue(
      new ApiError('Employee not in business', 'INVALID_EMPLOYEE_ID', 400),
    )
    await expect(saveAttendanceBatch(SAMPLE_PAYLOAD, 'idem')).rejects.toMatchObject({
      code: 'INVALID_EMPLOYEE_ID',
      status: 400,
    })
  })

  it('returns the BE success shape verbatim ({ written, byStatus })', async () => {
    mockApi.mockResolvedValue({ written: 5, byStatus: { PRESENT: 3, ABSENT: 2 } })
    const result = await saveAttendanceBatch(SAMPLE_PAYLOAD, 'idem')
    expect(result.written).toBe(5)
    expect(result.byStatus).toEqual({ PRESENT: 3, ABSENT: 2 })
  })
})
