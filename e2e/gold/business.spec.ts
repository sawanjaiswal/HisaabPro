/**
 * Suite E — Business & multi-business (TC-BIZ-01 … TC-BIZ-05).
 * Plan: docs/E2E_TEST_PLAN.md §6.
 *
 * Two shops share this server, and the only thing keeping their books apart is
 * the `businessId` on the caller's token. TC-BIZ-05 is the P0 case: it asks the
 * real API for the neighbour's rows by ID and fails if a single one comes back.
 *
 * FIX-FOREIGN (server/prisma/e2e-seed.ts) is a genuinely unrelated tenant — a
 * different user, a different business, no shared membership — because a probe
 * against a business the caller legitimately owns proves nothing.
 */

import { test, expect, loginViaUi, csrfPost } from './support/fixtures'
import { API_BASE, registerVerifiedUser } from './support/api'
import {
  SEEDED_OWNER_PHONE,
  VALID_PASSWORD,
  ROUTES,
  FOREIGN,
  uniquePhone,
} from './support/constants'
import type { Page } from '@playwright/test'

const BIZ_ROUTES = {
  create: '/business/create',
  join: '/join',
  parties: '/parties',
  staffInvite: '/settings/staff/invite',
} as const

/** The active business as the server sees it — the only trustworthy read. */
async function activeBusinessId(page: Page): Promise<string | null> {
  const res = await page.request.get(`${API_BASE}/auth/me`)
  expect(res.status(), 'GET /auth/me').toBe(200)
  const body = await res.json()
  return body.data.activeBusiness?.id ?? body.data.user?.businessId ?? null
}

/**
 * Types the 6-character code and submits.
 *
 * `fill()` alone is not enough: the field is React-controlled and the CTA stays
 * disabled until the component's own state holds six characters, so keystrokes
 * that land before hydration are silently dropped and the click then waits on a
 * permanently disabled button. Retry until the value sticks.
 */
async function enterInviteCode(page: Page, code: string): Promise<void> {
  const field = page.getByRole('textbox', { name: /invite code/i })
  const submit = page.getByRole('button', { name: /join business/i })
  await expect(async () => {
    await field.fill(code)
    await expect(field).toHaveValue(code, { timeout: 1_000 })
    await expect(submit).toBeEnabled({ timeout: 1_000 })
  }).toPass({ timeout: 20_000 })
  await submit.click()
}

test.describe('TC-BIZ — business & multi-business', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test('TC-BIZ-05 the neighbour\'s books are unreachable by ID (P0)', async ({ page }) => {
    // Asked for by ID, one endpoint at a time. A 200 here is not a failing
    // assertion — it is a customer of another shop rendered to this one.
    const probes = [
      `${API_BASE}/parties/${FOREIGN.partyId}`,
      `${API_BASE}/products/${FOREIGN.productId}`,
    ]
    for (const url of probes) {
      const res = await page.request.get(url)
      expect([403, 404], `${url} must refuse, got ${res.status()}`).toContain(res.status())
      const text = await res.text()
      expect(text, 'a refusal must not leak the row it refused').not.toContain('Rival Secret')
    }

    // Collections must not carry the neighbour either — an unscoped list leaks
    // in bulk, and no single-row check would catch it.
    for (const path of ['/parties?limit=100', '/products?limit=100']) {
      const res = await page.request.get(`${API_BASE}${path}`)
      expect(res.status(), `GET ${path}`).toBe(200)
      expect(await res.text(), `${path} is scoped to this business`).not.toContain('Rival Secret')
    }

    // Switching is the one path that re-mints businessId into the token. It has
    // to check membership, or the isolation above is a lock with the key taped
    // to the door.
    const switched = await csrfPost(page, `${API_BASE}/auth/switch-business`, {
      businessId: FOREIGN.businessId,
    })
    // 403, not 401. A 401 would say the *session* is bad, sending the client
    // through a token refresh and surfacing "session expired" for what is only
    // a membership check — the same fact requireActiveBusiness answers with 403.
    expect(
      [403, 404],
      `switching into a business the user is not a member of must be refused, got ${switched.status()}`,
    ).toContain(switched.status())
    expect(await activeBusinessId(page), 'a refused switch leaves the session where it was').not.toBe(
      FOREIGN.businessId,
    )
  })

  test('TC-BIZ-01 a second business can be created and shows in the switcher', async ({
    request,
    browser,
  }) => {
    // A fresh owner in its own context, not the seeded one. A business cannot
    // be deleted through the app, so running this against a shared account
    // walks it towards the 10-business cap until the case fails on "you have
    // reached the maximum" — a correct product answer reported as a test
    // failure. Its own context because the shared `page` is already signed in
    // as the seeded owner, and GuestRoute bounces an authenticated visitor
    // away from the login form.
    const ownerPhone = uniquePhone()
    await registerVerifiedUser(request, ownerPhone, VALID_PASSWORD, 'E2E Two-Shop Owner')
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginViaUi(page, ownerPhone, VALID_PASSWORD)

      const stamp = Date.now().toString().slice(-6)
      const names = [`E2E Shop A ${stamp}`, `E2E Shop B ${stamp}`]
      for (const name of names) {
        await page.goto(BIZ_ROUTES.create)
        await page.locator('#biz-name').fill(name)
        await page.getByRole('button', { name: /create business/i }).click()
        // The server is the record of what exists; the switcher only has to agree.
        await expect
          .poll(
            async () => {
              const res = await page.request.get(`${API_BASE}/auth/me`)
              const body = await res.json()
              return ((body.data?.businesses ?? []) as Array<{ name: string }>).some(
                (b) => b.name === name,
              )
            },
            { timeout: 20_000, message: `${name} is on the account` },
          )
          .toBe(true)
      }

      // The switcher a phone can actually reach: hamburger → "Your Businesses".
      // (`BusinessAvatar`, the tap-to-switch header control, is currently
      // rendered by nothing — see the findings; the side nav is the shipped path.)
      await page.goto(ROUTES.DASHBOARD)
      await page.getByRole('button', { name: /open menu/i }).click()
      await page.locator('.side-nav-business-accordion-trigger').click()
      for (const name of names) {
        await expect(
          page.locator('.side-nav-business-list').getByText(name, { exact: false }),
        ).toBeVisible({ timeout: 10_000 })
      }
    } finally {
      await context.close()
    }
  })

  test('TC-BIZ-02 switching re-scopes every list', async ({ page }) => {
    const me = await page.request.get(`${API_BASE}/auth/me`)
    const businesses = (await me.json()).data.businesses as Array<{ id: string; name: string }>
    const home = await activeBusinessId(page)
    const other = businesses.find((b) => b.id !== home)
    test.skip(!other, 'needs a second business — TC-BIZ-01 creates one')

    const before = await page.request.get(`${API_BASE}/parties?limit=100`)
    const beforeBody = await before.text()

    const res = await csrfPost(page, `${API_BASE}/auth/switch-business`, { businessId: other!.id })
    expect(res.status(), 'switching into an owned business').toBe(200)
    expect(await activeBusinessId(page)).toBe(other!.id)

    // The second shop was created empty. Anything from the first shop appearing
    // here is the same leak as TC-BIZ-05, arrived at through the front door.
    const after = await page.request.get(`${API_BASE}/parties?limit=100`)
    expect(after.status()).toBe(200)
    const afterBody = await after.text()
    if (beforeBody.includes('Raju Kirana Store')) {
      expect(afterBody, 'the first shop\'s parties do not follow the switch').not.toContain(
        'Raju Kirana Store',
      )
    }
    expect(afterBody, 'and neither does the neighbour\'s').not.toContain('Rival Secret')

    const back = await csrfPost(page, `${API_BASE}/auth/switch-business`, { businessId: home })
    expect(back.status(), `switching back: ${await back.text()}`).toBe(200)
    expect(await activeBusinessId(page), 'switching back restores the original').toBe(home)
  })

  test('TC-BIZ-03 a bogus invite code is refused with a readable reason', async ({ page }) => {
    await page.goto(BIZ_ROUTES.join)
    await enterInviteCode(page, 'ZZZZZZ')

    // Not "something went wrong": the user needs to know the code is the problem
    // so they ask the owner for a new one rather than reinstalling the app. The
    // page's own error slot, not any text that happens to say "code".
    const error = page.locator('.join-business-error')
    await expect(error).toBeVisible({ timeout: 15_000 })
    await expect(error).toHaveText(/invite|code|expired|not found/i)
    await expect(page).toHaveURL(new RegExp(`${BIZ_ROUTES.join}$`))
  })

  test('TC-BIZ-04 an invited staff member joins with the owner\'s powers withheld', async ({
    request,
    browser,
  }) => {
    // Two registrations, two UI logins, a business creation, an invite and a
    // join — the default 60s budget covers roughly half of that.
    test.setTimeout(150_000)

    // A fresh invitee each run: joining is once-only, so reusing a phone would
    // make the second run test the "already a member" path instead of this one.
    const staffPhone = uniquePhone()
    await registerVerifiedUser(request, staffPhone, VALID_PASSWORD, 'E2E Staff')

    // A fresh business too. Seats are capped by plan (3 on the free tier) and a
    // membership cannot be removed through the app, so inviting into the shared
    // seeded business exhausts it after three runs and the case then fails on
    // "user limit reached" — the plan working, reported as a bug.
    const ownerPhone = uniquePhone()
    await registerVerifiedUser(request, ownerPhone, VALID_PASSWORD, 'E2E Inviting Owner')
    const ownerContext = await browser.newContext()
    const page = await ownerContext.newPage()
    try {
    await loginViaUi(page, ownerPhone, VALID_PASSWORD)
    await page.goto(BIZ_ROUTES.create)
    await page.locator('#biz-name').fill(`E2E Invite Shop ${Date.now().toString().slice(-6)}`)
    await page.getByRole('button', { name: /create business/i }).click()
    await expect
      .poll(async () => (await activeBusinessId(page)) !== null, { timeout: 20_000 })
      .toBe(true)
    const invitingBusinessId = await activeBusinessId(page)

    // A hard reload before any business-scoped route: the client's auth state is
    // what ProtectedRoute reads, and until it re-fetches /auth/me it still holds
    // "no businesses" and bounces every such route to onboarding.
    await page.goto(ROUTES.DASHBOARD)
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000, message: 'the app sees the new business' })
      .toBe(ROUTES.DASHBOARD)

    await page.goto(BIZ_ROUTES.staffInvite)
    await page.locator('#invite-name').fill('E2E Staff')
    await page.locator('#invite-phone').fill(staffPhone)

    // A role is mandatory — an invite with no role would be a member with
    // undefined powers, which is the thing this case exists to check.
    await page.getByRole('combobox', { name: /roles/i }).click()
    // Anything but Owner — the point of the case is that a *staff* role cannot
    // do owner-only things, which an owner-roled invitee would trivially pass.
    await page.getByRole('option').filter({ hasNotText: /owner/i }).first().click()

    await page.getByRole('button', { name: /send invite|invite/i }).first().click()

    const code = await page
      .locator('[aria-label*="code" i]')
      .first()
      .textContent({ timeout: 20_000 })
    expect(code?.trim(), 'the owner is shown a code they can pass on').toMatch(/^[0-9A-F]{6}$/i)

    const staffContext = await browser.newContext()
    const staffPage = await staffContext.newPage()
    try {
      await loginViaUi(staffPage, staffPhone, VALID_PASSWORD)
      await staffPage.goto(BIZ_ROUTES.join)
      await enterInviteCode(staffPage, code!.trim())

      await expect
        .poll(
          async () => {
            const res = await staffPage.request.get(`${API_BASE}/auth/me`)
            const body = await res.json()
            return (body.data.businesses ?? []).length
          },
          { timeout: 20_000, message: 'the invite lands as a membership' },
        )
        .toBeGreaterThan(0)

      const meRes = await staffPage.request.get(`${API_BASE}/auth/me`)
      const me = await meRes.json()
      const joined = (me.data.businesses as Array<{ id: string; roleName?: string }>).find(
        (b) => b.id === invitingBusinessId,
      )
      expect(joined, 'joined the inviting business, not some other one').toBeTruthy()

      // The role has to mean something: an owner-only endpoint must refuse a
      // staff token, or "role applied" is a label with no enforcement behind it.
      const escalation = await csrfPost(
        staffPage,
        `${API_BASE}/businesses/${invitingBusinessId}/staff/invite`,
        { name: 'Smuggled In', phone: uniquePhone() },
      )
      expect(
        [401, 403],
        `staff must not be able to invite staff, got ${escalation.status()}`,
      ).toContain(escalation.status())
    } finally {
      await staffContext.close()
    }
    } finally {
      await ownerContext.close()
    }
  })
})
