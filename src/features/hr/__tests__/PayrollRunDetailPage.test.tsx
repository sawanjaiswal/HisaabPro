/** PayrollRunDetailPage tests — Phase 6 PR6 FE
 *
 * Coverage:
 *   - Status branches: FINALIZED renders the Reverse CTA, REVERSED hides it
 *   - hasSummary toggle: with router state → full <dl> grid; without →
 *     "Summary unavailable" fallback message
 *   - The page renders the run id from URL params
 *
 * Note: the page reads its summary from React Router `location.state` (no
 * GET /payroll/run/:id endpoint exists in PR6). We seed the router state
 * via `MemoryRouter` `initialEntries`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/config/routes.config', () => ({
  ROUTES: {
    DASHBOARD: '/dashboard',
    HR_PAYROLL: '/hr/payroll',
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
      cancel: 'Cancel',
      retry: 'Try Again',
      payrollRunDetailTitle: 'Payroll run',
      payrollRunSummaryLabel: 'Run summary',
      payrollRunSummaryUnavailable:
        'Summary not available. Open this run from the finalize toast or the audit log.',
      payrollRunActionsLabel: 'Actions',
      payrollRunNotFoundTitle: 'Run not found',
      payrollRunNotFoundDescription: 'We could not locate that payroll run.',
      payrollBackToHub: 'Back to payroll',
      payrollFromDateLabel: 'From',
      payrollToDateLabel: 'To',
      payrollEmployeesCountLabel: 'Employees',
      payrollColNet: 'Net total',
      payrollStatusDraft: 'Draft',
      payrollStatusFinalized: 'Finalized',
      payrollStatusReversed: 'Reversed',
      payrollReverseCta: 'Reverse',
      payrollReverseConfirmTitle: 'Reverse this payroll?',
      payrollReverseConfirmDescription:
        'This refunds {from}-{to}. Cannot be undone.',
    },
  }),
}))

// api.ts is touched by the reverse mutation hook — stub it inert here.
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

// ─── Helpers ────────────────────────────────────────────────────────────────

async function renderPage(routerState?: {
  fromDate?: string
  toDate?: string
  count?: number
  totalNetPaise?: number
  status?: 'FINALIZED' | 'REVERSED' | 'DRAFT'
}): Promise<void> {
  const { default: PayrollRunDetailPage } = await import('../PayrollRunDetailPage')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/hr/payroll/run_99',
              state: routerState ?? null,
            },
          ]}
        >
          <Routes>
            <Route path="/hr/payroll/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  render(<PayrollRunDetailPage />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Status branches ────────────────────────────────────────────────────────

describe('<PayrollRunDetailPage /> — status branches', () => {
  it('FINALIZED with summary renders the Reverse CTA', async () => {
    await renderPage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      count: 3,
      totalNetPaise: 9000000,
      status: 'FINALIZED',
    })
    expect(screen.getByRole('button', { name: /Reverse/i })).toBeInTheDocument()
    // Status badge
    expect(screen.getByText('Finalized')).toBeInTheDocument()
  })

  it('REVERSED hides the Reverse CTA', async () => {
    await renderPage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      count: 3,
      totalNetPaise: 9000000,
      status: 'REVERSED',
    })
    expect(screen.queryByRole('button', { name: /Reverse/i })).not.toBeInTheDocument()
    expect(screen.getByText('Reversed')).toBeInTheDocument()
  })

  it('defaults to FINALIZED status when router state omits status', async () => {
    await renderPage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      count: 1,
      totalNetPaise: 100000,
      // status omitted
    })
    expect(screen.getByText('Finalized')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reverse/i })).toBeInTheDocument()
  })
})

// ─── hasSummary toggle (router state vs. bookmark landing) ──────────────────

describe('<PayrollRunDetailPage /> — summary availability', () => {
  it('renders the period + count + total when router state present', async () => {
    await renderPage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      count: 5,
      totalNetPaise: 12500000,
      status: 'FINALIZED',
    })
    // The labels appear
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('Net total')).toBeInTheDocument()
    // Count value
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders the "summary unavailable" fallback when no router state', async () => {
    await renderPage()
    expect(
      screen.getByText(
        /Summary not available\. Open this run from the finalize toast or the audit log\./i,
      ),
    ).toBeInTheDocument()
    // Without summary, the Reverse CTA is hidden even on FINALIZED status
    expect(screen.queryByRole('button', { name: /Reverse/i })).not.toBeInTheDocument()
  })

  it('renders the run id from the URL params', async () => {
    await renderPage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      status: 'FINALIZED',
    })
    expect(screen.getByText('run_99')).toBeInTheDocument()
  })
})
