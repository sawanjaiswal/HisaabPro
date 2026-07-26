/**
 * The no-business gate: which routes a user with zero memberships may reach.
 *
 * `ProtectedRoute` sends such a user to onboarding, because every
 * business-scoped endpoint would answer NO_BUSINESS. The exceptions are the
 * routes that exist to *give* them a business — creating their own, or
 * redeeming an invite into someone else's. Missing one of those locks the user
 * out of the app entirely (see .claude/fix-trace-join-business-gate.md), so the
 * set is asserted here rather than left to an inline pathname comparison.
 */

import { describe, it, expect } from 'vitest'
import { ROUTES } from '@/config/routes.config'
import { NO_BUSINESS_ROUTES } from '@/config/route-access.config'

describe('NO_BUSINESS_ROUTES', () => {
  it('lets an invited staff member reach the invite-code screen', () => {
    // Their only way in. Redirecting it to onboarding tells them to create the
    // business they were invited to join.
    expect(NO_BUSINESS_ROUTES).toContain(ROUTES.JOIN_BUSINESS)
  })

  it('lets a new owner reach both ways of getting a business', () => {
    expect(NO_BUSINESS_ROUTES).toContain(ROUTES.ONBOARDING)
    expect(NO_BUSINESS_ROUTES).toContain(ROUTES.CREATE_BUSINESS)
  })

  it('does not exempt business-scoped routes', () => {
    // These 403 with NO_BUSINESS server-side; rendering them would show an
    // error screen where onboarding belongs.
    for (const route of [ROUTES.DASHBOARD, ROUTES.PARTIES, ROUTES.INVOICES]) {
      expect(NO_BUSINESS_ROUTES).not.toContain(route)
    }
  })

  it('holds only static paths — the guard compares pathnames exactly', () => {
    for (const route of NO_BUSINESS_ROUTES) {
      expect(route, `${route} has a :param the guard cannot match`).not.toContain(':')
    }
  })
})
