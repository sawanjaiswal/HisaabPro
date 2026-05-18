/** EmployeeListPage tests — Phase 6 PR6 FE
 *
 * Coverage of the 4 mandatory UI states + filter behaviour. We mock
 * `@/lib/api` so the page never hits the network; each test primes
 * `mockApi` for the GET /hr/employees call (the only call this page
 * makes on first render).
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
    HR_EMPLOYEE_DETAIL: '/hr/employees/:id',
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

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      loading: 'Loading...',
      cancel: 'Cancel',
      save: 'Save',
      retry: 'Try Again',
      employeesTitle: 'Employees',
      employeesSearchPlaceholder: 'Search employees',
      employeesEmptyTitle: 'No employees yet',
      employeesEmptyDescription: 'Add your first employee to get started.',
      employeesEmptyFilteredTitle: 'No matches',
      employeesEmptyFilteredDescription: 'Try a different search.',
      employeesAddCta: 'Add employee',
      employeesLoadError: 'Could not load employees. Please try again.',
      employeeFormLabelName: 'Name',
      employeeFormLabelPhone: 'Phone',
      employeeFormLabelDesignation: 'Designation',
      employeeFormLabelDailyRate: 'Daily rate (Rs)',
      employeeFormErrNameRequired: 'Name is required.',
      employeeFormErrDailyRateRequired: 'Daily rate is required.',
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

const SAMPLE_EMPLOYEES = [
  {
    id: 'emp_1', businessId: 'biz_1', partyId: 'p_1',
    name: 'Raju Mehta', phone: '+919876543210', designation: 'Driver',
    dailyRate: 150000, joinedAt: null, leftAt: null, isDeleted: false,
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'emp_2', businessId: 'biz_1', partyId: 'p_2',
    name: 'Priya Singh', phone: null, designation: 'Manager',
    dailyRate: 200000, joinedAt: null, leftAt: null, isDeleted: false,
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

async function renderPage(): Promise<void> {
  const { default: EmployeeListPage } = await import('../EmployeeListPage')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
  render(<EmployeeListPage />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 4 UI states ────────────────────────────────────────────────────────────

describe('<EmployeeListPage /> — 4 UI states', () => {
  it('loading state renders the busy region', async () => {
    mockApi.mockReturnValue(new Promise(() => {}))
    await renderPage()
    await waitFor(() =>
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument(),
    )
  })

  it('error state renders the ErrorState with a retry CTA', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApi.mockRejectedValue(new ApiError('Server error', 'INTERNAL', 500))
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('Could not load employees. Please try again.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('empty state renders an EmptyState with the Add CTA', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No employees yet/i)).toBeInTheDocument()
    })
    // CTA in the empty state
    expect(screen.getAllByRole('button', { name: 'Add employee' }).length).toBeGreaterThan(0)
  })

  it('success state renders one row per employee with the name visible', async () => {
    mockApi.mockResolvedValue({ rows: SAMPLE_EMPLOYEES, nextCursor: null })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText('Raju Mehta')).toBeInTheDocument()
      expect(screen.getByText('Priya Singh')).toBeInTheDocument()
    })
  })
})

// ─── Filter behaviour ───────────────────────────────────────────────────────

describe('<EmployeeListPage /> — search filter', () => {
  it('filters by name as the user types', async () => {
    mockApi.mockResolvedValue({ rows: SAMPLE_EMPLOYEES, nextCursor: null })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Raju Mehta')).toBeInTheDocument())

    const user = userEvent.setup()
    const search = screen.getByPlaceholderText('Search employees')
    await user.type(search, 'priya')

    await waitFor(() => {
      expect(screen.queryByText('Raju Mehta')).not.toBeInTheDocument()
      expect(screen.getByText('Priya Singh')).toBeInTheDocument()
    })
  })

  it('renders the filtered-empty state when no match', async () => {
    mockApi.mockResolvedValue({ rows: SAMPLE_EMPLOYEES, nextCursor: null })
    await renderPage()
    await waitFor(() => expect(screen.getByText('Raju Mehta')).toBeInTheDocument())

    const user = userEvent.setup()
    const search = screen.getByPlaceholderText('Search employees')
    await user.type(search, 'zzzzz-no-such-employee')

    await waitFor(() => {
      expect(screen.getByText('No matches')).toBeInTheDocument()
    })
  })
})
