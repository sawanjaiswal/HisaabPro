/** PayrollWizardPage tests — Phase 6 PR6 FE
 *
 * Wizard has two steps: dates → preview. The preview is a manually-
 * triggered POST (only on "Preview" click), so we can map the 4 UI states
 * to the preview phase:
 *
 *   loading  → spinner skeleton (preview POST in flight)
 *   error    → ErrorState with retry CTA (500 / 429 from BE)
 *   empty    → "no employees to pay" — when totals.count === 0
 *   success  → preview table + Finalize button
 *
 * We also check the step transition: starting at "dates", a successful
 * date submission flips us to "preview" and triggers the preview POST.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/config/routes.config', () => ({
  ROUTES: {
    DASHBOARD: '/dashboard',
    HR_EMPLOYEES: '/hr/employees',
    HR_ATTENDANCE: '/hr/attendance',
    HR_PAYROLL: '/hr/payroll',
    HR_PAYROLL_NEW: '/hr/payroll/new',
    HR_PAYROLL_DETAIL: '/hr/payroll/:id',
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

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      loading: 'Loading...',
      retry: 'Try Again',
      cancel: 'Cancel',
      payrollWizardTitle: 'New payroll',
      payrollStepDatesPeriodHeading: 'Period',
      payrollStepDatesEmployeesHeading: 'Employees',
      payrollStepDatesModeHeading: 'Payment mode',
      payrollFromDateLabel: 'From',
      payrollToDateLabel: 'To',
      payrollAllEmployeesLabel: 'All active',
      payrollSelectedSuffix: 'selected',
      payrollPreviewCta: 'Preview',
      payrollPreviewHeading: 'Review',
      payrollPreviewEditDates: 'Edit dates',
      payrollPreviewError: 'Could not load preview. Try again.',
      payrollPreviewEmptyTitle: 'No employees to pay',
      payrollPreviewEmptyDescription: 'No payable lines for this period.',
      payrollFinalizeCta: 'Finalize',
      payrollErrFromRequired: 'From date is required.',
      payrollErrToRequired: 'To date is required.',
      payrollErrFromAfterTo: 'From must be on or before To.',
      payrollErrRangeTooLong: 'Range cannot exceed {max} days.',
      payrollErrInvalidDate: 'Invalid date.',
      payrollModeCash: 'Cash',
      payrollModeUpi: 'UPI',
      payrollModeBankTransfer: 'Bank transfer',
      payrollModeCheque: 'Cheque',
      payrollColEmployee: 'Employee',
      payrollColDays: 'Days',
      payrollColGross: 'Gross',
      payrollColAdvance: 'Advance',
      payrollColPriorDue: 'Prior due',
      payrollColNet: 'Net',
      payrollPreviewTotalsLabel: 'Totals',
      payrollFinalizeConfirmTitle: 'Finalize this payroll?',
      payrollFinalizeConfirmDescription:
        'Pays {count} employee(s) for {from}-{to}. Total {net}.',
    },
  }),
}))

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

const EMPLOYEES_WIRE = [
  {
    id: 'emp_1', businessId: 'biz_1', partyId: 'p_1',
    name: 'Raju Mehta', phone: null, designation: 'Driver',
    dailyRate: 150000, joinedAt: null, leftAt: null, isDeleted: false,
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

const SAMPLE_PREVIEW = {
  lines: [
    {
      employeeId: 'emp_1',
      employeeName: 'Raju Mehta',
      dailyRatePaise: 150000,
      payableDays: 22,
      grossPaise: 3300000,
      advancesAppliedPaise: 0,
      priorDuesPaise: 0,
      netPaise: 3300000,
    },
  ],
  totals: { grossPaise: 3300000, netPaise: 3300000, count: 1 },
}

const EMPTY_PREVIEW = {
  lines: [],
  totals: { grossPaise: 0, netPaise: 0, count: 0 },
}

/** Route mockApi by path so we can prime employees + preview independently. */
function primeApi(handlers: {
  employees?: () => unknown | Promise<unknown>
  preview?: () => unknown | Promise<unknown>
}) {
  mockApi.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/hr/employees' || path.startsWith('/hr/employees?')) {
      return Promise.resolve(handlers.employees ? handlers.employees() : { rows: [], nextCursor: null })
    }
    if (path === '/payroll/run/preview' && opts?.method === 'POST') {
      return Promise.resolve(handlers.preview ? handlers.preview() : SAMPLE_PREVIEW)
    }
    return Promise.reject(new Error(`Unmocked path: ${path}`))
  })
}

async function renderPage(): Promise<void> {
  const { default: PayrollWizardPage } = await import('../PayrollWizardPage')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/hr/payroll/new']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
  render(<PayrollWizardPage />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Step 1 → Step 2 transition ─────────────────────────────────────────────

describe('<PayrollWizardPage /> — step transitions', () => {
  it('starts on the dates step (Preview CTA visible)', async () => {
    primeApi({ employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }) })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    })
    // The "Edit dates" CTA from step 2 should NOT be present yet.
    expect(screen.queryByRole('button', { name: 'Edit dates' })).not.toBeInTheDocument()
  })

  it('clicking Preview advances to step 2 and triggers the preview POST', async () => {
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => SAMPLE_PREVIEW,
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit dates' })).toBeInTheDocument()
    })
    // Preview POST happened
    const previewCalls = mockApi.mock.calls.filter(
      ([path]) => path === '/payroll/run/preview',
    )
    expect(previewCalls.length).toBeGreaterThan(0)
  })

  it('clicking "Edit dates" returns to step 1', async () => {
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => SAMPLE_PREVIEW,
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit dates' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Edit dates' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit dates' })).not.toBeInTheDocument()
    })
  })
})

// ─── 4 UI states on the preview step ────────────────────────────────────────

describe('<PayrollWizardPage /> — preview step 4 UI states', () => {
  it('loading state renders the busy region after Preview click', async () => {
    let resolvePreview: (v: unknown) => void = () => {}
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => new Promise((res) => { resolvePreview = res }),
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument()
    })
    resolvePreview(SAMPLE_PREVIEW)
  })

  it('error state shows ErrorState with retry CTA on 500', async () => {
    const { ApiError } = await import('@/lib/api')
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => Promise.reject(new ApiError('Server error', 'INTERNAL', 500)),
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    // usePayrollPreview retries non-429 errors up to 2 times before bubbling
    // — give the error state a generous window so we don't flake on the
    // back-off delay.
    await waitFor(
      () => {
        expect(screen.getByText('Could not load preview. Try again.')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('empty state shows when totals.count === 0', async () => {
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => EMPTY_PREVIEW,
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => {
      expect(screen.getByText('No employees to pay')).toBeInTheDocument()
    })
    // No Finalize CTA when empty
    expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument()
  })

  it('success state shows the preview table + Finalize CTA when lines > 0', async () => {
    primeApi({
      employees: () => ({ rows: EMPLOYEES_WIRE, nextCursor: null }),
      preview: () => SAMPLE_PREVIEW,
    })
    await renderPage()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => {
      // Employee name from the preview line
      const matches = screen.getAllByText('Raju Mehta')
      expect(matches.length).toBeGreaterThan(0)
    })
    expect(screen.getByRole('button', { name: 'Finalize' })).toBeInTheDocument()
  })
})
