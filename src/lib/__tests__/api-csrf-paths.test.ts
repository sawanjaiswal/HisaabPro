/**
 * The client never decides which routes are CSRF-exempt — the server does.
 *
 * `needsCsrf` used to skip the whole `/auth/` prefix on the assumption that
 * every auth route is unauthenticated. Two are not: `/auth/logout` and
 * `/auth/switch-business` carry a session and are CSRF-protected server-side
 * (server/src/middleware/csrf.ts lists neither in CSRF_EXEMPT_AUTH_PATHS). The
 * prefix made both POSTs 403 forever: logout left the session alive and
 * business switching was impossible.
 *
 * The fix is the absence of a list, not a better one — a second copy of the
 * server's exemptions is a source of truth that drifts. These tests exist to
 * keep it absent. See .claude/fix-trace-logout-session-survives.md.
 */

import { describe, it, expect } from 'vitest'
import { needsCsrf } from '../api-request'

const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE']
const SAFE = ['GET', 'HEAD', 'OPTIONS']

describe('needsCsrf', () => {
  it('sends the token on every mutation, auth routes included', () => {
    for (const method of MUTATIONS) {
      expect(needsCsrf(method), `${method} is state-changing`).toBe(true)
    }
  })

  it('never sends it on a safe method', () => {
    for (const method of SAFE) {
      expect(needsCsrf(method), `${method} is safe`).toBe(false)
    }
  })

  it('takes no path argument — routing the exemption is the server’s job', () => {
    // A path parameter is the shape the drift came in. If one is ever added
    // back, this fails and the reviewer reads the trace above.
    expect(needsCsrf.length, 'needsCsrf must not branch on the path').toBe(1)
  })
})
