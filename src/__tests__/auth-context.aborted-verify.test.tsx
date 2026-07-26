/**
 * An aborted `/auth/me` is not an answer.
 *
 * AuthContext aborts its verification on effect cleanup — which React runs on
 * every remount, including StrictMode's deliberate double-invoke in dev. The
 * rejected request landed in the same catch as a real failure and then ended
 * the loading state, publishing "signed in, zero businesses" from a cache that
 * had never been confirmed. The business gate acts on that and redirects to
 * /onboarding, a route it exempts, so the real answer arriving milliseconds
 * later never navigates back: the owner is stuck on the welcome screen.
 * See .claude/fix-trace-aborted-auth-verify.md.
 */

import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import * as authLib from '@/lib/auth'

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, warmupServer: vi.fn(), getMe: vi.fn(), clearAuth: vi.fn() }
})

function Probe() {
  const { isLoading, businesses } = useAuth()
  return <div data-testid="state">{isLoading ? 'loading' : `businesses:${businesses.length}`}</div>
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

describe('AuthContext — aborted boot verification', () => {
  beforeEach(() => {
    sessionStorage.setItem('cachedUser', JSON.stringify(CACHED_USER))
    // Written when the account genuinely had none — the shop was created after.
    sessionStorage.setItem('cachedBusinesses', JSON.stringify([]))
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('does not publish "no businesses" when the request was aborted mid-flight', async () => {
    // Every call honours its signal; the first one is aborted by the remount.
    vi.mocked(authLib.getMe).mockImplementation(
      (signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
          setTimeout(
            () => resolve({ user: { ...CACHED_USER, businessId: BUSINESS.id }, businesses: [BUSINESS], activeBusiness: BUSINESS }),
            20,
          )
        }) as ReturnType<typeof authLib.getMe>,
    )

    render(
      <StrictMode>
        <AuthProvider><Probe /></AuthProvider>
      </StrictMode>,
    )

    // Let the aborted rejection settle. The gate must still be held off — this
    // is the exact instant the redirect used to fire.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByTestId('state')).toHaveTextContent('loading')

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('businesses:1'))
  })
})
