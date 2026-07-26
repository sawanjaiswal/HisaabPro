/**
 * Suite Q support — the neighbour's session, and the probe lists.
 *
 * Tenant isolation cannot be proved from one side. A refusal is only meaningful
 * if the row it refused really exists and really belongs to somebody else, so
 * every write probe here is checked twice: the caller is refused, and then the
 * owner is asked whether their row survived intact. A silently-succeeded write
 * that answers 403 to the attacker would pass the first check alone.
 */

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { loginViaUi } from './fixtures'
import { API_BASE } from './api'
import { FOREIGN, VALID_PASSWORD } from './constants'

export { API_BASE }

/** The neighbouring shop, signed in for real, in a context of its own. */
export interface ForeignSession {
  page: Page
  context: BrowserContext
  close(): Promise<void>
}

export async function openForeignSession(browser: Browser): Promise<ForeignSession> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginViaUi(page, FOREIGN.phone, VALID_PASSWORD)
  return { page, context, close: () => context.close() }
}

/**
 * Business-scoped read endpoints, one per router that serves a tenant's books.
 *
 * Chosen for breadth over depth: a leak is a property of how a router builds
 * its `where`, so one endpoint per router finds a whole family of them, while
 * ten endpoints from one router prove one thing ten times.
 */
export const SCOPED_LIST_PATHS = [
  '/parties?limit=100',
  '/products?limit=100',
  '/documents?type=SALE_INVOICE&limit=100',
  '/payments?limit=100',
  '/expenses?limit=100',
  '/dashboard/home',
  '/reports/day-book',
] as const

/** Endpoints that must never answer a caller with no session at all. */
export const AUTHENTICATED_PATHS = [
  '/parties',
  '/products',
  '/documents?type=SALE_INVOICE',
  '/payments',
  '/expenses',
  '/dashboard/home',
  '/reports/day-book',
  '/auth/me',
] as const

/** Platform-admin surface — a shopkeeper's token is not an admin token. */
export const ADMIN_PATHS = [
  '/admin/users',
  '/admin/businesses',
  '/admin/dashboard/overview',
  '/admin/settings',
] as const

/**
 * The strings that only ever appear in the neighbour's rows.
 *
 * Asserted against raw response text rather than a parsed field: a leak that
 * arrives in an unexpected shape — an embedded party on a document, a name in
 * a search index — is still a leak, and a field-by-field check would miss it.
 */
export const FOREIGN_MARKERS = [FOREIGN.partyName, FOREIGN.productName, FOREIGN.businessName] as const

export function expectNoForeignData(text: string, what: string): void {
  for (const marker of FOREIGN_MARKERS) {
    expect(text, `${what} must not carry the neighbour's data (${marker})`).not.toContain(marker)
  }
}

/**
 * A refusal, stated as the two statuses that mean it.
 *
 * 403 and 404 are both correct answers to "someone else's row": 404 hides
 * existence, 403 admits it but denies access. 200 is the only failure, and a
 * 500 means the scoping threw rather than filtered — also not a refusal.
 */
export function expectRefused(status: number, what: string): void {
  expect([401, 403, 404], `${what} must be refused, got ${status}`).toContain(status)
}
