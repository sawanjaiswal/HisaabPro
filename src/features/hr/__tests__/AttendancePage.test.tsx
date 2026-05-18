/** AttendancePage tests — Phase 6 PR5 FE
 *
 * Covers the four mandatory UI states (loading, error, empty, success) plus
 * the load-bearing behaviours of the daily grid: pill-click cycles the status,
 * the save bar appears only when there are pending edits, Save POSTs through
 * the service, and Discard clears the dirty state.
 *
 * Strategy: mock `@/lib/api` so the page never hits the network — each test
 * primes `mockApi` with the right response for the next call. The page wires
 * GET /hr/employees (useEmployees) and GET /hr/attendance (useAttendanceRange)
 * through the same `api()` so we route by path inside `mockApi`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AttendanceRow, EmployeeLite } from '../hr.types'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/config/routes.config', () => ({
  ROUTES: {
    DASHBOARD: '/dashboard',
    HR_EMPLOYEES: '/hr/employees',
    HR_ATTENDANCE: '/hr/attendance',
  },
}))

vi.mock('@/config/app.config', () => ({
  APP_NAME: 'HisaabPro',
  API_URL: 'http://test.local/api',
  TIMEOUTS: { fetchMs: 30000, debounceMs: 10 },
}))

vi.mock('@/config/events.config', () => ({ OPEN_SIDE_NAV_EVENT: 'open-side-nav' }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { businessId: 'biz-1' } }),
}))

vi.mock('@/features/business/components/SuspendBanner', () => ({
  SuspendBanner: () => null,
}))

vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/feedback/SyncStatusIcon', () => ({
  SyncStatusIcon: () => null,
}))

// Minimal translation surface — the strings the page reads back.
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      loading: 'Loading...',
      attendanceTitle: 'Attendance',
      attendanceWeekView: 'Week',
      attendanceMonthView: 'Month',
      attendanceTodayCta: 'Today',
      attendanceNoEmployees: 'Add your first employee to start tracking attendance.',
      attendanceAddFirstEmployee: 'Add employee',
      attendanceSavePending: 'Save',
      attendanceDiscardPending: 'Discard',
      attendancePendingCount: '{count} change(s) pending',
      attendanceSavedToast: 'Attendance saved.',
      attendanceQueuedToast: 'Attendance saved — will sync when online.',
      attendanceSaveErrorToast: 'Could not save attendance. Please try again.',
      attendanceStatusPresent: 'Present',
      attendanceStatusAbsent: 'Absent',
      attendanceStatusHalfDay: 'Half day',
      attendanceStatusLeavePaid: 'Paid leave',
      attendanceStatusLeaveUnpaid: 'Unpaid leave',
      attendanceLoadError: 'Could not load attendance. Please try again.',
      attendanceCellAriaLabel:
        '{employee} on {date}, marked {status}. Tap to change.',
    },
  }),
}))

// Stub api.ts — every test primes mockApi.mockImplementation() with a path router
const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class extends Error {
    code: string
    status: number
    constructor(m: string, c: string, s: number) {
      super(m); this.code = c; this.status = s
    }
  },
}))

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<EmployeeLite> = {}): EmployeeLite {
  return {
    id: 'emp_1',
    name: 'Raju',
    role: 'Driver',
    active: true,
    ...overrides,
  }
}

function makeRow(overrides: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    id: 'att_1',
    businessId: 'biz_1',
    employeeId: 'emp_1',
    date: '2026-05-18',
    status: 'PRESENT',
    overtimeMin: 0,
    note: null,
    createdAt: '2026-05-18T08:00:00.000Z',
    ...overrides,
  }
}

/** Route mockApi by path so we can prime employees + attendance + batch
 *  independently for each test. */
function primeApi(handlers: {
  employees?: () => Promise<unknown> | unknown
  attendance?: () => Promise<unknown> | unknown
  batch?: () => Promise<unknown> | unknown
}) {
  mockApi.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/hr/employees') {
      return Promise.resolve(handlers.employees ? handlers.employees() : { employees: [] })
    }
    if (path.startsWith('/hr/attendance?')) {
      return Promise.resolve(handlers.attendance ? handlers.attendance() : { rows: [] })
    }
    if (path === '/hr/attendance/batch' && opts?.method === 'POST') {
      return Promise.resolve(handlers.batch ? handlers.batch() : { written: 0, byStatus: {} })
    }
    return Promise.reject(new Error(`Unmocked path: ${path}`))
  })
}

async function renderPage(): Promise<{ unmount: () => void }> {
  return import('../AttendancePage').then(({ default: AttendancePage }) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      )
    }
    return render(<AttendancePage />, { wrapper: Wrapper })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 4 UI states ────────────────────────────────────────────────────────────

describe('<AttendancePage /> — 4 UI states', () => {
  it('loading state renders the busy skeleton region', async () => {
    // Neither query ever resolves — page stays in the loading branch
    mockApi.mockReturnValue(new Promise(() => {}))
    await renderPage()
    await waitFor(() =>
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument(),
    )
  })

  it('error state renders the ErrorState with a retry CTA', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApi.mockImplementation((path: string) => {
      if (path === '/hr/employees') return Promise.resolve({ employees: [makeEmployee()] })
      if (path.startsWith('/hr/attendance?'))
        return Promise.reject(new ApiError('Server error', 'INTERNAL', 500))
      return Promise.reject(new Error(`Unmocked: ${path}`))
    })
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('Could not load attendance. Please try again.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('empty state renders when employees endpoint returns no rows', async () => {
    // GET /hr/employees → { employees: [] } means showEmpty=true
    primeApi({ employees: () => ({ employees: [] }) })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Add your first employee/i)).toBeInTheDocument()
    })
    // Empty-state CTA links to the (future) employees page
    expect(screen.getByRole('link', { name: 'Add employee' })).toBeInTheDocument()
  })

  it('empty state also fires when /hr/employees 404s (PR6 not shipped)', async () => {
    const { ApiError } = await import('@/lib/api')
    primeApi({
      employees: () => {
        throw new ApiError('Not yet available', 'NOT_FOUND', 404)
      },
    })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Add your first employee/i)).toBeInTheDocument()
    })
  })

  it('success state renders an employee row and at least one attendance pill', async () => {
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [makeRow()] }),
    })
    await renderPage()
    await waitFor(() => {
      // The employee header appears in BOTH the desktop table and mobile list.
      // We only need to confirm at least one is in the DOM.
      const rajuMatches = screen.getAllByText('Raju')
      expect(rajuMatches.length).toBeGreaterThan(0)
    })
    // At least one pill should carry our aria-label template
    const pills = screen.getAllByLabelText(/Raju on .*marked/)
    expect(pills.length).toBeGreaterThan(0)
  })
})

// ─── Pending state + cycling ───────────────────────────────────────────────

describe('<AttendancePage /> — pending state + cycling', () => {
  it('clicking a pill marks the cell dirty and shows the save bar', async () => {
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [] }), // no persisted row → empty pill
    })
    await renderPage()
    const user = userEvent.setup()

    // Initially: zero pending → no save bar
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    // Click the first pill — empty cells start with `—` so the aria-label
    // contains "marked —"
    const pill = await waitFor(() => screen.getAllByLabelText(/Raju on /)[0])
    await user.click(pill)

    // Save bar now visible with the count message
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByText(/1 change\(s\) pending/)).toBeInTheDocument()
    })
  })

  it('clicking the same cell twice stays at one pending change (dedup by cell)', async () => {
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [] }),
    })
    await renderPage()
    const user = userEvent.setup()

    const pill = await waitFor(() => screen.getAllByLabelText(/Raju on /)[0])
    await user.click(pill)
    await user.click(pill)

    await waitFor(() => {
      // Still just 1 pending — the second click ADVANCED the status of the same
      // (employeeId, date) cell rather than queueing a second edit.
      expect(screen.getByText(/1 change\(s\) pending/)).toBeInTheDocument()
    })
  })

  it('Discard clears pending edits and hides the save bar', async () => {
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [] }),
    })
    await renderPage()
    const user = userEvent.setup()

    const pill = await waitFor(() => screen.getAllByLabelText(/Raju on /)[0])
    await user.click(pill)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })
})

// ─── Save → POST /hr/attendance/batch ───────────────────────────────────────

describe('<AttendancePage /> — Save flow', () => {
  it('Save posts the pending edits to /hr/attendance/batch and clears pending', async () => {
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [] }),
      batch: () => ({ written: 1, byStatus: { PRESENT: 1 } }),
    })
    await renderPage()
    const user = userEvent.setup()

    const pill = await waitFor(() => screen.getAllByLabelText(/Raju on /)[0])
    await user.click(pill)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Save' }))

    // The batch endpoint received the POST with the right shape
    await waitFor(() => {
      const batchCall = mockApi.mock.calls.find(
        ([path, opts]) =>
          path === '/hr/attendance/batch' &&
          (opts as { method?: string } | undefined)?.method === 'POST',
      )
      expect(batchCall, 'no batch POST was issued').toBeTruthy()
      const [, opts] = batchCall as [string, Record<string, unknown>]
      // X-Idempotency-Key header is present (UUID minted by the hook)
      const headers = (opts as { headers: Record<string, string> }).headers
      expect(typeof headers['X-Idempotency-Key']).toBe('string')
      expect(headers['X-Idempotency-Key'].length).toBeGreaterThan(0)
      // entityType/entityLabel power the offline-queue UI
      expect((opts as { entityType: string }).entityType).toBe('attendance')
      expect((opts as { entityLabel: string }).entityLabel).toContain('Attendance batch')
      // Body has the one pending entry
      const body = JSON.parse((opts as { body: string }).body)
      expect(Array.isArray(body.entries)).toBe(true)
      expect(body.entries.length).toBe(1)
      expect(body.entries[0].employeeId).toBe('emp_1')
      expect(typeof body.entries[0].date).toBe('string')
      expect(body.entries[0].status).toBe('PRESENT')
    })

    // After success: pending cleared → save bar gone
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    // Success toast surfaced
    expect(mockToast.success).toHaveBeenCalled()
  })

  it('Save surfaces the BE ApiError message via toast.error on 400 INVALID_EMPLOYEE_ID', async () => {
    const { ApiError } = await import('@/lib/api')
    primeApi({
      employees: () => ({ employees: [makeEmployee()] }),
      attendance: () => ({ rows: [] }),
      batch: () => {
        throw new ApiError('Employee not in business', 'INVALID_EMPLOYEE_ID', 400)
      },
    })
    await renderPage()
    const user = userEvent.setup()

    const pill = await waitFor(() => screen.getAllByLabelText(/Raju on /)[0])
    await user.click(pill)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Employee not in business')
    })

    // Pending state is preserved so the user can retry — save bar still shown
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
