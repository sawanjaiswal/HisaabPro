/** AuditLogPage tests — Phase 6 PR4 FE
 *
 * Covers the four mandatory UI states (loading, error, empty, success)
 * AND the search-query fuzz battery from PR4 BE. Cites: the 17 inputs
 * here are identical to the websearch_to_tsquery fuzz battery proved
 * safe in server/src/services/audit/__tests__/audit-search.service.test.ts
 * (PR4 BE). The FE test verifies we send the q value VERBATIM (no
 * client-side escape/mangle) so the BE hardening applies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuditSearchResponse, AuditSearchRow } from '../audit.types'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { businessId: 'biz-1' } }),
}))

vi.mock('@/config/routes.config', () => ({
  ROUTES: { SETTINGS: '/settings', SETTINGS_AUDIT_LOG: '/settings/audit-log' },
}))

vi.mock('@/config/app.config', () => ({
  APP_NAME: 'HisaabPro',
  API_URL: 'http://test.local/api',
  TIMEOUTS: { fetchMs: 30000, debounceMs: 10 },
}))

vi.mock('@/config/events.config', () => ({ OPEN_SIDE_NAV_EVENT: 'open-side-nav' }))

vi.mock('@/features/business/components/SuspendBanner', () => ({
  SuspendBanner: () => null,
}))

vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/feedback/SyncStatusIcon', () => ({
  SyncStatusIcon: () => null,
}))

// Provide a minimal English translation surface the page actually reads
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      auditLog:                  'Audit log',
      auditSearchPlaceholder:    'Search audit log',
      auditFiltersLabel:         'Filters',
      auditActionLabel:          'Action',
      auditEntityLabel:          'Entity type',
      auditActorLabel:           'Actor (user ID)',
      auditActorSystem:          'System',
      auditDateFromLabel:        'From date',
      auditDateToLabel:          'To date',
      auditApplyFilters:         'Apply',
      auditClearFilters:         'Clear',
      auditAllActions:           'All actions',
      auditAllEntities:          'All types',
      auditNoResults:            'No audit entries found',
      auditEmptyDesc:            'No audit entries here yet.',
      auditLoadError:            'Could not load audit log. Please try again.',
      auditExportCsv:            'Export CSV',
      auditExportSuccess:        'Audit log exported.',
      auditExportFailed:         'Could not export audit log.',
      auditDiffTitle:            'Change details',
      auditDiffBefore:           'Before',
      auditDiffAfter:            'After',
      auditDiffRedactedPlaceholder: '<redacted>',
      auditDiffNoChanges:        'No tracked changes for this entry.',
      auditRedactionsTitle:      'Redactions',
      auditRedactionsAddCta:     'Add redaction',
      auditRedactionsEntityType: 'Entity type',
      auditRedactionsFieldPath:  'Field path',
      auditRedactionsEnabledLabel: 'Enabled',
      auditRedactionsDisableCta: 'Disable',
      auditRedactionsConfirmDisable: 'Stop redacting?',
      auditRedactionsEmpty:      'No redactions configured yet.',
      couldNotLoadAuditLog:      'Could not load audit log',
      loadingAuditLog:           'Loading audit log',
      loadMoreBtn:               'Load more',
      auditReasonPrefix:         'Reason',
      cancel:                    'Cancel',
    },
  }),
}))

// Stub the api.ts module — return what each test sets via setNextResponse()
const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<AuditSearchRow> = {}): AuditSearchRow {
  return {
    id: 'a1',
    businessId: 'biz-1',
    action: 'UPDATE',
    entityType: 'INVOICE',
    entityId: 'inv-1',
    entityLabel: 'INV-001',
    userId: 'u1',
    systemActor: null,
    changes: { before: { foo: 'a' }, after: { foo: 'b' } },
    reason: null,
    ipAddress: null,
    deviceInfo: null,
    createdAt: new Date().toISOString(),
    userName: 'Raju',
    userEmail: 'raju@test.in',
    ...overrides,
  }
}

function makeResponse(rows: AuditSearchRow[], nextCursor: string | null = null): AuditSearchResponse {
  return { rows, nextCursor }
}

function renderPage(): Promise<{ unmount: () => void }> {
  // The dynamic import is intentional — the page imports its CSS, which
  // would mount during module load before our mocks are installed.
  return import('../AuditLogPage').then(({ default: AuditLogPage }) => {
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
    return render(<AuditLogPage />, { wrapper: Wrapper })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 4 UI states ────────────────────────────────────────────────────────────

describe('<AuditLogPage /> — UI states', () => {
  it('loading state renders skeleton bars', async () => {
    // Never resolve — page stays in loading
    mockApi.mockReturnValue(new Promise(() => {}))
    await renderPage()
    expect(screen.getByLabelText('Loading audit log')).toBeInTheDocument()
  })

  it('error state renders the ErrorState with a retry CTA', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApi.mockRejectedValue(new ApiError('Forbidden', 'FORBIDDEN', 403))
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('Could not load audit log')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('empty state renders when the BE returns 0 rows', async () => {
    mockApi.mockResolvedValue(makeResponse([]))
    await renderPage()
    await waitFor(() =>
      expect(screen.getByText('No audit entries found')).toBeInTheDocument(),
    )
  })

  it('success state renders one row per result', async () => {
    mockApi.mockResolvedValue(
      makeResponse([
        makeRow({ id: 'a1', userName: 'Raju', entityLabel: 'INV-001' }),
        makeRow({ id: 'a2', userName: 'Priya', entityLabel: 'INV-002' }),
      ]),
    )
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Raju/)).toBeInTheDocument()
      expect(screen.getByText(/Priya/)).toBeInTheDocument()
    })
  })

  it('falls back to systemActor when userName is null', async () => {
    mockApi.mockResolvedValue(
      makeResponse([makeRow({ userName: null, systemActor: 'cron' })]),
    )
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/cron/)).toBeInTheDocument()
    })
  })
})

// ─── Load more (cursor pagination) ─────────────────────────────────────────

describe('<AuditLogPage /> — cursor pagination', () => {
  it('shows the Load more CTA only when nextCursor is non-null', async () => {
    mockApi.mockResolvedValue(makeResponse([makeRow()], null))
    await renderPage()
    await waitFor(() => expect(screen.queryByText('Load more')).not.toBeInTheDocument())
  })

  it('renders the Load more CTA when nextCursor is present', async () => {
    mockApi.mockResolvedValue(makeResponse([makeRow()], 'cursor-2'))
    await renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument()
    })
  })
})

// ─── Diff drawer ────────────────────────────────────────────────────────────

describe('<AuditLogPage /> — diff drawer', () => {
  it('opens the diff drawer when a row is clicked', async () => {
    mockApi.mockResolvedValue(makeResponse([makeRow({ userName: 'Raju' })]))
    await renderPage()
    const user = userEvent.setup()

    const row = await waitFor(() =>
      screen.getByRole('button', { name: /Raju.*updated.*INV-001/i }),
    )
    await user.click(row)

    // The drawer title is the action+entity summary (e.g. "Updated · INVOICE: INV-001"),
    // not the generic t.auditDiffTitle. Assert on Before/After section headings instead.
    await waitFor(() => {
      expect(screen.getByText('Before')).toBeInTheDocument()
      expect(screen.getByText('After')).toBeInTheDocument()
    })
  })

  it('renders <redacted> in the diff when the BE marks a field redacted', async () => {
    mockApi.mockResolvedValue(
      makeResponse([
        makeRow({
          changes: {
            before: { phone: '999-1234' },
            after: { phone: { __redacted: true } },
          },
        }),
      ]),
    )
    await renderPage()
    const user = userEvent.setup()

    const row = await waitFor(() =>
      screen.getByRole('button', { name: /Raju.*updated/i }),
    )
    await user.click(row)

    await waitFor(() => {
      expect(screen.getByText('<redacted>', { exact: false })).toBeInTheDocument()
    })
  })
})

// ─── Search query fuzz battery ─────────────────────────────────────────────
//
// Per architecture rows 110-130 (v2.3 test addendum): these inputs are
// the same strings PR4 BE proved websearch_to_tsquery handles. The FE test
// confirms the page renders WITHOUT crashing AND submits each q value
// verbatim — no client-side escape/mangle — so the BE hardening applies.
//
// Note: `tab\there` and `newline\nhere` are exercised only in the service-
// level test (audit-log.service.test.ts) — `<input type="search">` is a
// single-line control and the browser strips \n and \t at the input layer
// before any FE code sees them. That's correct browser behaviour, not an
// FE-mangle. Excluded here so the page test reflects what a real user can
// type into the search box; the full 17-string battery still runs at the
// service layer.
const FUZZ_BATTERY = [
  'R&D', '(test)', "it's", 'a|b', '--', '&|!()', '"unclosed quote',
  '((unbalanced', 'AND', 'OR', '<script>', 'a/b/c', ' leading-space',
  'trailing-space ', 'utf-8 ✓ ©',
] as const

describe('search query fuzz battery — q reaches the BE verbatim', () => {
  for (const q of FUZZ_BATTERY) {
    it(`does not crash and submits q verbatim: ${JSON.stringify(q)}`, async () => {
      mockApi.mockResolvedValue(makeResponse([]))
      await renderPage()

      const user = userEvent.setup()
      const input = await waitFor(() =>
        screen.getByPlaceholderText('Search audit log'),
      )

      await user.clear(input)
      // userEvent.type interprets some characters as keyboard syntax
      // (e.g. '{' opens a key code). Use clipboard.paste-style write
      // via fireEvent equivalent to dodge that — react-testing-library's
      // `paste` doesn't exist, so we go through userEvent.paste.
      await user.click(input)
      await user.paste(q)

      // Debounce is 10ms in tests; flush microtasks + debounce timer
      await act(() => new Promise((r) => setTimeout(r, 30)))

      // Assert the page rendered and our search reached the api()
      await waitFor(() => {
        // The input shows our string verbatim
        expect((input as HTMLInputElement).value).toBe(q)
        // Some api() call was issued with our string in the query
        const calls = mockApi.mock.calls
        const hit = calls.find(([path]) => {
          if (typeof path !== 'string' || !path.startsWith('/audit?')) return false
          const params = new URLSearchParams(path.split('?')[1])
          return params.get('q') === q
        })
        expect(hit, `no api() call carried q=${JSON.stringify(q)}`).toBeTruthy()
      })
    })
  }
})
