/**
 * A cached "you have no businesses" must not be treated as fact.
 *
 * AuthContext seeds state from sessionStorage so an offline user renders
 * immediately. When that cache holds an EMPTY business list the hint is
 * indistinguishable from a genuinely new account — and the business gate acts
 * on it: `ProtectedRoute` redirects to /onboarding, which is exempt from the
 * gate, so the correction that arrives a moment later from /auth/me never
 * navigates back. The user is stranded on "Welcome to HisaabPro" with a shop
 * they already own. See .claude/fix-trace-empty-business-cache.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import * as authLib from '@/lib/auth'

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, warmupServer: vi.fn(), getMe: vi.fn(), clearAuth: vi.fn() }
})

function Probe() {
  const { isLoading, businesses } = useAuth()
  return <div>{isLoading ? 'loading' : `businesses:${businesses.length}`}</div>
}

const CACHED_USER = { id: 'u1', phone: '9000000001', name: 'Raju', email: null, businessId: null }
const BUSINESS = {
  id: 'b1',
  name: 'Raju Traders',
  businessType: 'general',
  role: 'owner',
  roleId: null,
  roleName: 'Owner',
  permissions: [],
  status: 'ACTIVE',
  lastActiveAt: null,
}

describe('AuthContext — empty cached business list', () => {
  beforeEach(() => {
    sessionStorage.setItem('cachedUser', JSON.stringify(CACHED_USER))
    sessionStorage.setItem('cachedBusinesses', JSON.stringify([]))
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('stays loading until the server answers, rather than reporting zero businesses', async () => {
    type MeResponse = Awaited<ReturnType<typeof authLib.getMe>>
    let resolveMe: (v: MeResponse) => void = () => {}
    vi.mocked(authLib.getMe).mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve
      }) as ReturnType<typeof authLib.getMe>,
    )

    render(<AuthProvider><Probe /></AuthProvider>)

    // The window in which the gate would fire. Nothing may claim the user has
    // no business while the only evidence is a cache that may predate one.
    expect(screen.getByText('loading')).toBeInTheDocument()

    resolveMe({
      user: { ...CACHED_USER, businessId: BUSINESS.id },
      businesses: [BUSINESS],
      activeBusiness: BUSINESS,
    })

    await waitFor(() => expect(screen.getByText('businesses:1')).toBeInTheDocument())
  })

  it('still renders instantly when the cache holds a business', async () => {
    sessionStorage.setItem('cachedBusinesses', JSON.stringify([BUSINESS]))
    vi.mocked(authLib.getMe).mockReturnValue(new Promise(() => {}) as ReturnType<typeof authLib.getMe>)

    render(<AuthProvider><Probe /></AuthProvider>)

    // The offline-first case the cache exists for: a known shop renders without
    // waiting on the network.
    await waitFor(() => expect(screen.getByText('businesses:1')).toBeInTheDocument())
  })
})
