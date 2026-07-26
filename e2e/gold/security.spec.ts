/**
 * Suite Q — Security, part 1: tenant isolation, authentication, CSRF.
 * Plan: docs/E2E_TEST_PLAN.md §18 (TC-SEC-01 … TC-SEC-04).
 *
 * These four are the cases where a failure is not a bug report but an incident:
 * one shop reading or rewriting another's books, an endpoint answering a caller
 * with no session, or a state change a third-party page can trigger from the
 * user's own browser. Every probe runs against the real server with real
 * cookies — nothing here is mocked, so a green case means the product refused.
 */

import { test, expect, loginViaUi, csrfRequest } from './support/fixtures'
import { API_BASE } from './support/api'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD, FOREIGN, COOKIES, CSRF_HEADER } from './support/constants'
import {
  openForeignSession,
  SCOPED_LIST_PATHS,
  AUTHENTICATED_PATHS,
  expectNoForeignData,
  expectRefused,
} from './support/security'
import { apiCreateInvoice, today } from './support/invoices'

test.describe('TC-SEC — tenant isolation, authentication, CSRF', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test('TC-SEC-01 the neighbour\'s books are unreadable, by ID and in bulk (P0)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)

    // A document of the neighbour's, made the way they would make it — so the
    // probe names a row that genuinely exists rather than a plausible-looking
    // id whose 404 proves only that nothing is there.
    const foreign = await openForeignSession(browser)
    let foreignInvoiceId: string

    try {
      const invoice = await apiCreateInvoice(foreign.page, {
        partyId: FOREIGN.partyId,
        documentDate: today(),
        lineItems: [{ productId: FOREIGN.productId, quantity: 1, rate: 99900 }],
      })
      foreignInvoiceId = invoice.id

    } finally {
      await foreign.close()
    }

    for (const url of [
      `${API_BASE}/parties/${FOREIGN.partyId}`,
      `${API_BASE}/products/${FOREIGN.productId}`,
      `${API_BASE}/documents/${foreignInvoiceId}`,
    ]) {
      const res = await page.request.get(url)
      expectRefused(res.status(), `GET ${url}`)
      expectNoForeignData(await res.text(), `the refusal from ${url}`)
    }

    // Bulk is the leak no single-row probe finds: a router that forgot its
    // `businessId` filter answers 200 with everybody's rows and never 403s.
    for (const path of SCOPED_LIST_PATHS) {
      const res = await page.request.get(`${API_BASE}${path}`)
      expect(res.status(), `GET ${path}`).toBe(200)
      const text = await res.text()
      expectNoForeignData(text, `GET ${path}`)
      // By id, not by number: numbering is per-business, so both shops issue an
      // "INV-2627-004" and matching on it would report the caller's own invoice
      // as a leak. The id is global and belongs to exactly one row.
      expect(text, `GET ${path} must not carry the neighbour's invoice`).not.toContain(
        foreignInvoiceId,
      )
    }
  })

  test('TC-SEC-02 the neighbour\'s books are unwritable, and survive the attempt (P0)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)

    const probes: Array<{ what: string; run: () => Promise<number> }> = [
      {
        what: 'PUT /parties/:id',
        run: async () =>
          (
            await csrfRequest(page, 'put', `${API_BASE}/parties/${FOREIGN.partyId}`, {
              name: 'Owned By Me Now',
            })
          ).status(),
      },
      {
        what: 'PUT /products/:id',
        run: async () =>
          (
            await csrfRequest(page, 'put', `${API_BASE}/products/${FOREIGN.productId}`, {
              name: 'Owned By Me Now',
            })
          ).status(),
      },
      {
        what: 'DELETE /parties/:id',
        run: async () =>
          (await csrfRequest(page, 'delete', `${API_BASE}/parties/${FOREIGN.partyId}`)).status(),
      },
      {
        what: 'DELETE /products/:id',
        run: async () =>
          (await csrfRequest(page, 'delete', `${API_BASE}/products/${FOREIGN.productId}`)).status(),
      },
    ]

    for (const probe of probes) {
      expectRefused(await probe.run(), probe.what)
    }

    // The refusal is only half the answer. A handler that scoped its response
    // but not its write would answer 404 and still have changed the row, so the
    // owner is asked directly whether their shop is as they left it.
    const foreign = await openForeignSession(browser)
    try {
      const party = await foreign.page.request.get(`${API_BASE}/parties/${FOREIGN.partyId}`)
      expect(party.status(), 'the owner can still read their own party').toBe(200)
      expect(await party.text(), 'the party is untouched').toContain(FOREIGN.partyName)

      const product = await foreign.page.request.get(`${API_BASE}/products/${FOREIGN.productId}`)
      expect(product.status(), 'the owner can still read their own product').toBe(200)
      expect(await product.text(), 'the product is untouched').toContain(FOREIGN.productName)
    } finally {
      await foreign.close()
    }
  })

  test('TC-SEC-03 no session, no data (P0)', async ({ page, request }) => {
    // Each path is proved reachable with a session first. Without that, a typo
    // in a path would 404 for the anonymous caller and read as a pass — the
    // suite would be asserting that a route which does not exist is protected.
    for (const path of AUTHENTICATED_PATHS) {
      const withSession = await page.request.get(`${API_BASE}${path}`)
      expect(withSession.status(), `GET ${path} with a session (probe is live)`).toBe(200)

      // The `request` fixture is its own context and carries none of the
      // browser's cookies — an anonymous caller, not a logged-out one.
      const anonymous = await request.get(`${API_BASE}${path}`)
      expect(anonymous.status(), `GET ${path} without a session`).toBe(401)
      expect(await anonymous.text(), `${path} leaks nothing in its 401`).not.toContain(
        SEEDED_OWNER_PHONE,
      )
    }
  })

  test('TC-SEC-04 a state change needs the CSRF token, not just the cookie', async ({ page }) => {
    const cookies = await page.context().cookies()
    const token = cookies.find((c) => c.name === COOKIES.csrf)?.value
    expect(token, 'the session carries a CSRF cookie to compare against').toBeTruthy()

    const body = { name: `E2E CSRF Probe ${Date.now().toString().slice(-6)}`, type: 'CUSTOMER' }
    const headers = {
      'X-Request-Nonce': crypto.randomUUID(),
      'X-Request-Timestamp': Date.now().toString(),
    }

    // Cookies ride along automatically — this is exactly what a form on another
    // origin can make the user's browser send. Only the header it cannot read
    // is missing.
    const noToken = await page.request.post(`${API_BASE}/parties`, { headers, data: body })
    expect(noToken.status(), 'a mutation with no CSRF header must be refused').toBe(403)

    const wrongToken = await page.request.post(`${API_BASE}/parties`, {
      headers: { ...headers, [CSRF_HEADER]: 'not-the-token' },
      data: body,
    })
    expect(wrongToken.status(), 'a guessed CSRF token must be refused').toBe(403)

    // The control: the same call with the real token succeeds. Without it, both
    // refusals above could be caused by anything — a bad payload, a dead route —
    // and the case would pass while proving nothing about CSRF.
    const withToken = await csrfRequest(page, 'post', `${API_BASE}/parties`, body)
    expect(
      withToken.ok(),
      `the same request with the token must succeed, got ${withToken.status()}: ${await withToken.text()}`,
    ).toBe(true)
  })
})
