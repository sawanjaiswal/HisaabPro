/**
 * Suite Q — Security, part 2: privilege, injection, abuse limits, leakage.
 * Plan: docs/E2E_TEST_PLAN.md §18 (TC-SEC-05 … TC-SEC-08).
 *
 * Part 1 (security.spec.ts) asks whether the walls are there. This half asks
 * what happens when someone leans on them: a shopkeeper's token reaching for
 * the platform admin, a party name carrying a script, an attacker paying for
 * the shop's SMS, and whatever the app says out loud while doing its job.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { API_BASE, registerVerifiedUser } from './support/api'
import {
  SEEDED_OWNER_PHONE,
  VALID_PASSWORD,
  uniquePhone,
  GSTIN,
} from './support/constants'
import { ADMIN_PATHS, expectRefused } from './support/security'
import { apiCreateParty, uniqueName, uniquePartyPhone } from './support/parties'

/** A payload that announces itself: if the browser runs it, the flag is set. */
const XSS_FLAG = '__e2eXssFired'
const XSS_PAYLOAD = `<img src=x onerror="window.${XSS_FLAG}=true">Ravi`

test.describe('TC-SEC — privilege, injection, abuse limits, leakage', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test.afterEach(async ({ request }) => {
    // TC-SEC-07 deliberately exhausts buckets. Leaving them exhausted would
    // fail whichever spec runs next on a defence working exactly as designed.
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
  })

  test('TC-SEC-05 a shopkeeper\'s session is not an admin session', async ({ page }) => {
    for (const path of ADMIN_PATHS) {
      const res = await page.request.get(`${API_BASE}${path}`)
      expectRefused(res.status(), `GET ${path} with a shopkeeper session`)
      const text = await res.text()
      // A refusal that still lists the platform's users would make the status
      // code decorative.
      expect(text, `${path} must not answer with data`).not.toContain('"users"')
      expect(text, `${path} must not answer with data`).not.toContain('"businesses"')
    }
  })

  test('TC-SEC-06 a script in a party name is text, everywhere it is shown', async ({ page }) => {
    const marker = uniqueName('XSS')
    const party = await apiCreateParty(page, { name: `${XSS_PAYLOAD} ${marker}`, type: 'CUSTOMER' })

    // An alert() payload would hang the page instead of failing the case;
    // accepting dialogs keeps the failure readable if one ever appears.
    let dialogs = 0
    page.on('dialog', async (d) => {
      dialogs += 1
      await d.dismiss()
    })

    for (const url of ['/parties', `/parties/${party.id}`]) {
      await page.goto(url)
      await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 20_000 })

      // The payload rendered as characters, not as a node: React escapes it, so
      // the <img> never exists and its onerror never runs.
      expect(
        await page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag], XSS_FLAG),
        `${url} executed the payload`,
      ).toBeUndefined()
      expect(await page.locator('img[src="x"]').count(), `${url} built a node from the payload`).toBe(0)
    }
    expect(dialogs, 'no payload opened a dialog').toBe(0)
  })

  test('TC-SEC-07 attempts against one phone and one password are capped', async ({ request }) => {
    test.setTimeout(150_000)

    // OTP: the shop pays for every message, and the victim receives every one.
    // A fresh number, because the cap is per phone.
    const victim = uniquePhone()
    const otpStatuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${API_BASE}/auth/register`, {
        data: { phone: victim, name: 'E2E OTP Target', password: VALID_PASSWORD },
      })
      otpStatuses.push(res.status())
      if (res.status() === 429) break
    }
    expect(
      otpStatuses,
      `repeated OTP requests for one number must be capped, got ${otpStatuses.join(',')}`,
    ).toContain(429)

    // …and the cap belongs to that number, not to everyone. A limiter that
    // locked the whole endpoint would stop registrations across the country.
    const bystander = uniquePhone()
    const clean = await request.post(`${API_BASE}/auth/register`, {
      data: { phone: bystander, name: 'E2E Bystander', password: VALID_PASSWORD },
    })
    expect(
      clean.status(),
      `another number must still be able to register, got ${clean.status()}`,
    ).toBeLessThan(400)

    // Passwords: 20/min per IP. Wrong ones, so a pass would mean the account
    // was guessable AND unlimited.
    //
    // Guessed against a throwaway account, never the seeded owner: failed
    // attempts also drive the per-account lockout, so hammering the shared
    // login every suite depends on would leave it locked for whatever runs
    // next — a defence working correctly, reported as unrelated failures.
    const target = uniquePhone()
    await registerVerifiedUser(request, target, VALID_PASSWORD, 'E2E Guess Target')
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const loginStatuses: number[] = []
    for (let i = 0; i < 25; i++) {
      const res = await request.post(`${API_BASE}/auth/login`, {
        data: { identifier: target, password: `Wrong@${i}Pass` },
      })
      loginStatuses.push(res.status())
      if (res.status() === 429) break
    }
    expect(loginStatuses, 'password guessing must be capped').toContain(429)
  })

  test('TC-SEC-08 the app does not say the customer\'s details out loud', async ({
    page,
    request,
  }) => {
    // A registration (two OTP round-trips) plus three page walks — the default
    // 60s budget covers about half of it.
    test.setTimeout(150_000)

    const spoken: string[] = []
    page.on('console', (msg) => spoken.push(msg.text()))

    // A phone and a GSTIN this run put into the system, so the check is against
    // data that actually flows through the pages being walked.
    const phone = uniquePhone()
    await registerVerifiedUser(request, phone, VALID_PASSWORD, 'E2E Log Probe')
    // A number no earlier run used: party phones are unique per business, so a
    // fixed one turns the second run of this case into a 409 about duplicates.
    const customerPhone = uniquePartyPhone()
    const party = await apiCreateParty(page, {
      name: uniqueName('Log Probe'),
      type: 'CUSTOMER',
      phone: customerPhone,
      gstin: GSTIN.intraState,
    })

    for (const url of ['/dashboard', '/parties', `/parties/${party.id}`]) {
      await page.goto(url)
      // `networkidle` never arrives on a page that polls; the skip-link target
      // is the signal that the page rendered whatever it will say. By id, not
      // by <main>: the dashboard's main region is a div (an a11y finding of its
      // own), so a role-based wait would only ever pass on some of these pages.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 })
    }

    const cookies = await page.context().cookies()
    const accessToken = cookies.find((c) => c.name === 'at')?.value ?? '__no-token__'
    const secrets: Array<[string, string]> = [
      ['a customer phone', customerPhone],
      ['a GSTIN', GSTIN.intraState],
      ['the access token', accessToken],
      ['a password', VALID_PASSWORD],
    ]
    const transcript = spoken.join('\n')
    for (const [what, secret] of secrets) {
      expect(transcript, `the console must not print ${what}`).not.toContain(secret)
    }

    // The other half of the same question: what the server hands back. A
    // password hash in a profile response is a leak no console check finds.
    const me = await page.request.get(`${API_BASE}/auth/me`)
    const body = await me.text()
    for (const field of ['passwordHash', 'password"', 'otp"', 'refreshToken']) {
      expect(body, `/auth/me must not return ${field}`).not.toContain(field)
    }
  })
})
