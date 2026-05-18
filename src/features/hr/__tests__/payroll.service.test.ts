/** payroll.service tests — Phase 6 PR6 FE
 *
 * Coverage:
 *   - previewPayroll() POSTs to /payroll/run/preview with body verbatim
 *   - finalizePayroll() POSTs to /payroll/run/finalize + X-Idempotency-Key
 *     + entityType=payroll-run + period-encoded entityLabel
 *   - reversePayroll() POSTs to /payroll/run/:id/reverse + idem key + empty body
 *   - getPayslipSnapshot() GETs /payroll/:id/snapshot
 *   - 429 from preview surfaces as ApiError (rate-limit detection in hook depends on this)
 *   - 409 from finalize (PAYROLL_PERIOD_OVERLAP) propagates as ApiError
 *   - 409 from reverse (both BE codes) propagates as ApiError
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
  previewPayroll,
  finalizePayroll,
  reversePayroll,
  getPayslipSnapshot,
} from '../payroll.service'
import { ApiError } from '@/lib/api'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── previewPayroll ─────────────────────────────────────────────────────────

describe('previewPayroll', () => {
  const BODY = {
    fromDate: '2026-04-01',
    toDate: '2026-04-30',
    employeeIds: ['emp_a', 'emp_b'],
  }

  it('POSTs to /payroll/run/preview with the request body', async () => {
    mockApi.mockResolvedValue({ lines: [], totals: { grossPaise: 0, netPaise: 0, count: 0 } })
    await previewPayroll(BODY)
    expect(mockApi).toHaveBeenCalledTimes(1)
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/payroll/run/preview')
    expect((opts as { method: string }).method).toBe('POST')
    expect(JSON.parse((opts as { body: string }).body)).toEqual(BODY)
  })

  it('does NOT send an idempotency key — preview is a read', async () => {
    mockApi.mockResolvedValue({ lines: [], totals: { grossPaise: 0, netPaise: 0, count: 0 } })
    await previewPayroll(BODY)
    const [, opts] = mockApi.mock.calls[0]
    const headers = (opts as { headers?: Record<string, string> }).headers ?? {}
    expect(headers['X-Idempotency-Key']).toBeUndefined()
  })

  it('forwards the AbortSignal so React Query can cancel', async () => {
    mockApi.mockResolvedValue({ lines: [], totals: { grossPaise: 0, netPaise: 0, count: 0 } })
    const c = new AbortController()
    await previewPayroll(BODY, c.signal)
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { signal?: AbortSignal })?.signal).toBe(c.signal)
  })

  it('propagates 429 as ApiError so the hook can detect rate limiting', async () => {
    mockApi.mockRejectedValue(new ApiError('Too many', 'RATE_LIMITED', 429))
    await expect(previewPayroll(BODY)).rejects.toMatchObject({ status: 429 })
  })
})

// ─── finalizePayroll ────────────────────────────────────────────────────────

describe('finalizePayroll', () => {
  const BODY = {
    fromDate: '2026-04-01',
    toDate: '2026-04-30',
    mode: 'CASH' as const,
  }

  it('POSTs to /payroll/run/finalize with body + idempotency header', async () => {
    mockApi.mockResolvedValue({ payrollRunId: 'run_1', status: 'FINALIZED', totalNetPaise: 0, count: 0 })
    await finalizePayroll(BODY, 'idem-finalize-1')
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/payroll/run/finalize')
    expect((opts as { method: string }).method).toBe('POST')
    const headers = (opts as { headers: Record<string, string> }).headers
    expect(headers['X-Idempotency-Key']).toBe('idem-finalize-1')
  })

  it('tags the offline queue with entityType=payroll-run + period in label', async () => {
    mockApi.mockResolvedValue({ payrollRunId: 'run_1', status: 'FINALIZED', totalNetPaise: 0, count: 0 })
    await finalizePayroll(BODY, 'idem')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('payroll-run')
    expect((opts as { entityLabel: string }).entityLabel).toContain('2026-04-01')
    expect((opts as { entityLabel: string }).entityLabel).toContain('2026-04-30')
  })

  it('propagates 409 PAYROLL_PERIOD_OVERLAP as ApiError', async () => {
    mockApi.mockRejectedValue(new ApiError('Period overlaps', 'PAYROLL_PERIOD_OVERLAP', 409))
    await expect(finalizePayroll(BODY, 'idem')).rejects.toMatchObject({
      status: 409,
      code: 'PAYROLL_PERIOD_OVERLAP',
    })
  })
})

// ─── reversePayroll ─────────────────────────────────────────────────────────

describe('reversePayroll', () => {
  it('POSTs to /payroll/run/:id/reverse with empty body + idem key', async () => {
    mockApi.mockResolvedValue({
      payrollRunId: 'run_99',
      status: 'REVERSED',
      reversedCount: 3,
      totalReversedPaise: 150000,
    })
    await reversePayroll('run_99', 'idem-rev-1')
    const [path, opts] = mockApi.mock.calls[0]
    expect(path).toBe('/payroll/run/run_99/reverse')
    expect((opts as { method: string }).method).toBe('POST')
    expect((opts as { body: string }).body).toBe('{}')
    const headers = (opts as { headers: Record<string, string> }).headers
    expect(headers['X-Idempotency-Key']).toBe('idem-rev-1')
  })

  it('tags entityType=payroll-run + label naming the run id', async () => {
    mockApi.mockResolvedValue({
      payrollRunId: 'run_99', status: 'REVERSED', reversedCount: 0, totalReversedPaise: 0,
    })
    await reversePayroll('run_99', 'idem')
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { entityType: string }).entityType).toBe('payroll-run')
    expect((opts as { entityLabel: string }).entityLabel).toContain('run_99')
  })

  it('propagates 409 PAYROLL_ALREADY_REVERSED as ApiError', async () => {
    mockApi.mockRejectedValue(new ApiError('Already reversed', 'PAYROLL_ALREADY_REVERSED', 409))
    await expect(reversePayroll('run_99', 'idem')).rejects.toMatchObject({ status: 409 })
  })

  it('propagates 409 PAYMENT_ALREADY_REVERSED as ApiError', async () => {
    mockApi.mockRejectedValue(new ApiError('Already reversed', 'PAYMENT_ALREADY_REVERSED', 409))
    await expect(reversePayroll('run_99', 'idem')).rejects.toMatchObject({ status: 409 })
  })
})

// ─── getPayslipSnapshot ─────────────────────────────────────────────────────

describe('getPayslipSnapshot', () => {
  it('GETs /payroll/:id/snapshot', async () => {
    mockApi.mockResolvedValue({
      payroll: { id: 'p1', payrollRunId: 'r1', employeeId: 'e1', netPaise: 0, status: 'FINALIZED' },
      snapshot: {} as never,
    })
    await getPayslipSnapshot('payroll_42')
    const [path] = mockApi.mock.calls[0]
    expect(path).toBe('/payroll/payroll_42/snapshot')
  })

  it('forwards AbortSignal', async () => {
    mockApi.mockResolvedValue({
      payroll: { id: 'p1', payrollRunId: 'r1', employeeId: 'e1', netPaise: 0, status: 'FINALIZED' },
      snapshot: {} as never,
    })
    const c = new AbortController()
    await getPayslipSnapshot('payroll_42', c.signal)
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { signal?: AbortSignal })?.signal).toBe(c.signal)
  })

  it('propagates 404 PAYROLL_NOT_FOUND so the page can surface notFound', async () => {
    mockApi.mockRejectedValue(new ApiError('Not found', 'PAYROLL_NOT_FOUND', 404))
    await expect(getPayslipSnapshot('missing')).rejects.toMatchObject({ status: 404 })
  })
})
