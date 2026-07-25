/**
 * Boot-time session verification must tell a dead session apart from a dead
 * network.
 *
 * AuthContext seeds `user` from sessionStorage so an offline user stays signed
 * in. That cache used to survive ANY /auth/me failure — including a 401, which
 * means the session is genuinely gone. The result was a user stranded on
 * /dashboard behind a connectivity error with no way back to /login.
 * See .claude/fix-trace-dead-session-stranded.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api-error'
import * as authLib from '@/lib/auth'

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    warmupServer: vi.fn(),
    getMe: vi.fn(),
    clearAuth: vi.fn(() => {
      sessionStorage.removeItem('cachedUser')
      sessionStorage.removeItem('cachedBusinesses')
    }),
  }
})

function Probe() {
  const { isAuthenticated, isLoading } = useAuth()
  return <div>{isLoading ? 'loading' : isAuthenticated ? 'authed' : 'anon'}</div>
}

const CACHED_USER = { id: 'u1', phone: '9000000001', name: 'Raju', email: null, businessId: 'b1' }

describe('AuthContext boot verification', () => {
  beforeEach(() => {
    sessionStorage.setItem('cachedUser', JSON.stringify(CACHED_USER))
    sessionStorage.setItem('cachedBusinesses', JSON.stringify([{ id: 'b1', name: 'Raju Traders' }]))
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('signs the user out when /auth/me returns 401', async () => {
    vi.mocked(authLib.getMe).mockRejectedValue(
      new ApiError('Unauthorized', 'UNAUTHORIZED', 401)
    )

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument())
    expect(sessionStorage.getItem('cachedUser'), 'a dead session must not stay cached').toBeNull()
  })

  it('keeps the cached session when the request never reaches the server', async () => {
    vi.mocked(authLib.getMe).mockRejectedValue(new TypeError('Failed to fetch'))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('authed')).toBeInTheDocument())
    expect(sessionStorage.getItem('cachedUser'), 'offline must stay signed in').not.toBeNull()
  })

  it('keeps the cached session when the server errors', async () => {
    vi.mocked(authLib.getMe).mockRejectedValue(new ApiError('boom', 'SERVER_ERROR', 500))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('authed')).toBeInTheDocument())
  })
})
