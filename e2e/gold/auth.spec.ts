/**
 * Suite C — Login / session (TC-AUTH-01 … TC-AUTH-06, TC-AUTH-10).
 * docs/E2E_TEST_PLAN.md §4. Real server, real Postgres, real cookies.
 *
 * TC-AUTH-07 (session revoke), 08 (PIN gate) and 09 (WebAuthn) are not here:
 * 07/08 need a second device context and a backgrounded app, 09 needs a
 * platform authenticator. They stay manual — §55 of the plan records that.
 */

import { test, expect, loginViaUi, actionFailures, trackFailedRequests } from './support/fixtures'
import { waitForOtp, registerVerifiedUser, API_BASE } from './support/api'
import { ROUTES, SEL, SEEDED_OWNER_PHONE, VALID_PASSWORD, uniquePhone, COOKIES } from './support/constants'

test.beforeEach(async ({ request }) => {
  await request.post(`${API_BASE}/__test__/reset-rate-limits`)
})

test.describe('TC-AUTH — login and session', () => {
  test('TC-AUTH-01 password login lands past the auth wall with cookies set', async ({
    page,
    context,
  }) => {
    const failures = trackFailedRequests(page)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'authenticated /auth/me after login').toBe(true)
    expect((await me.json()).data.user.phone).toBe(SEEDED_OWNER_PHONE)

    // Session must be cookie-borne, and the access cookie must not be readable
    // from JS — a token in document.cookie is an XSS-exfiltration primitive.
    const cookies = await context.cookies()
    expect(cookies.length, 'login must set cookies').toBeGreaterThan(0)
    const jsVisible = await page.evaluate(() => document.cookie)
    expect(jsVisible, 'auth cookies must be httpOnly').not.toMatch(/token|jwt|refresh/i)

    expect(actionFailures(failures.get()), 'no failed API calls on login').toEqual([])
  })

  test('TC-AUTH-02 wrong password does not reveal whether the account exists', async ({
    request,
  }) => {
    // A throwaway "known" account: a failed login increments a lockout counter
    // that outlives the test, so spending those attempts on the seeded owner
    // would lock the tenant that TC-AUTH-01/05/06 depend on.
    const knownPhone = uniquePhone()
    await registerVerifiedUser(request, knownPhone, VALID_PASSWORD)
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)

    const known = await request.post(`${API_BASE}/auth/login`, {
      data: { identifier: knownPhone, password: 'Wrong@12345' },
    })
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const unknown = await request.post(`${API_BASE}/auth/login`, {
      data: { identifier: '9000000099', password: 'Wrong@12345' },
    })

    expect(known.ok()).toBe(false)
    expect(unknown.ok()).toBe(false)
    // Same status AND same message — a difference in either enumerates users.
    expect(unknown.status(), 'status must not enumerate').toBe(known.status())
    const msg = (r: unknown) => (r as { error?: { message?: string } }).error?.message
    expect(msg(await unknown.json()), 'message must not enumerate').toBe(msg(await known.json()))
  })

  test('TC-AUTH-02b wrong password shows a visible error and stays on /login', async ({
    page,
    request,
  }) => {
    const phone = uniquePhone()
    await registerVerifiedUser(request, phone, VALID_PASSWORD)
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)

    await page.goto(ROUTES.LOGIN)
    await page.locator('#identifier').fill(phone)
    await page.locator('#password').fill('Wrong@12345')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.locator(SEL.loginError)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(new RegExp(`${ROUTES.LOGIN}$`))
  })

  test('TC-AUTH-03 repeated wrong passwords are guarded (lockout, then rate limit)', async ({
    request,
  }) => {
    // A throwaway account on purpose: this case locks whoever it targets for
    // LOCKOUT_DURATION_MS, and pointing it at the seeded owner would break every
    // later spec in a way that looks like a login bug.
    const phone = uniquePhone()
    await registerVerifiedUser(request, phone, VALID_PASSWORD)
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)

    const bodies: string[] = []
    const statuses: number[] = []
    for (let i = 0; i < 30; i++) {
      const res = await request.post(`${API_BASE}/auth/login`, {
        data: { identifier: phone, password: `Wrong@${i}2345` },
      })
      statuses.push(res.status())
      bodies.push(await res.text())
      if (res.status() === 429) break
    }

    expect(statuses.every((s) => s >= 400), 'no wrong password may ever succeed').toBe(true)
    expect(
      bodies.some((b) => /locked/i.test(b)) || statuses.includes(429),
      'a burst of bad logins must lock the account or trip the limiter',
    ).toBe(true)

    // And the guard must hold against the CORRECT password too — otherwise it
    // only slows an attacker who never guesses right.
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const withRealPassword = await request.post(`${API_BASE}/auth/login`, {
      data: { identifier: phone, password: VALID_PASSWORD },
    })
    expect(withRealPassword.ok(), 'correct password during lockout must be refused').toBe(false)
  })

  test('TC-AUTH-04 forgot password: OTP → new password → old one stops working', async ({
    page,
    request,
  }) => {
    // A throwaway account, so the reset cannot strand the seeded owner.
    const phone = uniquePhone()
    await request.post(`${API_BASE}/auth/register`, {
      data: { phone, name: 'Reset Me', password: VALID_PASSWORD },
    })
    const regOtp = await waitForOtp(request, phone)
    await request.post(`${API_BASE}/auth/verify-registration`, { data: { phone, otp: regOtp } })
    await request.post(`${API_BASE}/__test__/reset-otps`)
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)

    const newPassword = 'Fresh@54321'
    const forgot = await request.post(`${API_BASE}/auth/forgot-password`, { data: { phone } })
    expect(forgot.ok(), `forgot-password: ${await forgot.text()}`).toBe(true)

    const resetOtp = await waitForOtp(request, phone)
    const reset = await request.post(`${API_BASE}/auth/reset-password`, {
      data: { phone, otp: resetOtp, newPassword },
    })
    expect(reset.ok(), `reset-password: ${await reset.text()}`).toBe(true)

    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const oldPw = await request.post(`${API_BASE}/auth/login`, {
      data: { identifier: phone, password: VALID_PASSWORD },
    })
    expect(oldPw.ok(), 'the old password must stop working').toBe(false)

    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, phone, newPassword)
    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'the new password must work through the real form').toBe(true)
  })

  test('TC-AUTH-05 an expired access token refreshes silently', async ({ page, context }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    // Simulate expiry the only way a browser can: drop the access cookie and
    // keep the refresh cookie. The next call must recover without a visit to
    // /login — that is what "silent refresh" means to a user.
    const cookies = await context.cookies()
    expect(
      cookies.map((c) => c.name),
      'expected the access-token cookie to exist',
    ).toContain(COOKIES.access)
    await context.clearCookies({ name: COOKIES.access })

    // Not networkidle — the app holds an SSE stream open, so the network is
    // never idle and the wait would burn the whole timeout.
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2_000)
    await expect(page, 'must not be bounced to login').not.toHaveURL(
      new RegExp(`${ROUTES.LOGIN}$`),
    )
    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'session survives access-token loss via refresh').toBe(true)
  })

  test('TC-AUTH-06 logout from the menu ends the session and returns to login', async ({
    page,
  }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    // The real path a user takes: bottom nav "More" → Logout → confirm.
    await page.getByRole('button', { name: /more|menu/i }).first().click()
    await page.locator('.side-nav-item--logout').click()
    await page.getByRole('button', { name: /log ?out|sign ?out/i }).last().click()

    await expect(page, 'logout must return to login').toHaveURL(
      new RegExp(`${ROUTES.LOGIN}$`),
      { timeout: 15_000 },
    )

    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'no session may survive logout').toBe(false)

    // Nothing tenant-identifying may outlive the session on a shared phone.
    const leftovers = await page.evaluate(() => Object.keys(sessionStorage))
    expect(leftovers, 'session storage must be empty after logout').toEqual([])
  })

  test('TC-AUTH-06b a dead session sends the user to login, not to an error state', async ({
    page,
    context,
  }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    // Server-side death without a client-side logout: revoked session, expired
    // refresh token, admin force-logout. The app must recognise "not
    // authenticated" and route to login.
    await context.clearCookies({ name: COOKIES.access })
    await context.clearCookies({ name: COOKIES.refresh })

    await page.goto(ROUTES.DASHBOARD)
    await expect(page, 'a dead session must land on login').toHaveURL(
      new RegExp(`${ROUTES.LOGIN}$`),
      { timeout: 15_000 },
    )
  })

  test('TC-AUTH-11 two sessions can start at the same moment', async ({ request }) => {
    // A shop owner signs in on the counter phone and the back-office browser, or
    // double-taps "Sign in" on a slow connection. Every attempt must produce its
    // own session.
    //
    // generateTokens (server/src/lib/jwt.ts:31) signs {userId, phone,
    // businessId, type} with a 1-second-granularity iat and no jti, so tokens
    // issued in the same second are byte-identical — and RefreshToken.token is
    // @unique. Concurrent logins collide on insert and return
    // 409 DUPLICATE_ENTRY "token already exists". The same collision against an
    // already-rotated row trips reuse-detection, which revokes the whole family
    // and force-logs-out the user.
    //
    // Unfixed: lib/jwt.ts is a high-risk path and needs the architect+security
    // design plan first. Tracked as F12 in docs/E2E_RESULTS.md.
    const attempts = await Promise.all(
      [0, 1, 2, 3].map(() =>
        request.post(`${API_BASE}/auth/login`, {
          data: { identifier: SEEDED_OWNER_PHONE, password: VALID_PASSWORD },
        }),
      ),
    )

    const statuses = attempts.map((r) => r.status())
    expect(statuses, `concurrent logins must all succeed, got ${statuses.join(',')}`).toEqual([
      200, 200, 200, 200,
    ])
  })

  test('TC-AUTH-10 login while offline fails loudly, not silently', async ({ page, context }) => {
    await page.goto(ROUTES.LOGIN)
    await page.locator('#identifier').fill(SEEDED_OWNER_PHONE)
    await page.locator('#password').fill(VALID_PASSWORD)

    await context.setOffline(true)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Either a visible error or a visible offline banner — never a spinner that
    // hangs and never a silent no-op.
    const feedback = page.locator(`${SEL.loginError}, .offline-banner, [data-offline]`)
    await expect(feedback.first()).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(new RegExp(`${ROUTES.LOGIN}$`))

    await context.setOffline(false)
  })
})

test.describe('TC-AUTH — surface', () => {
  test('TC-AUTH-SURF there is no OTP login endpoint to attack', async ({ request }) => {
    // csrf.ts exempts /api/auth/send-otp and /api/auth/verify-otp, but neither
    // route is mounted — OTP is a registration/reset factor only. Asserted so
    // that mounting one later is a deliberate act with a CSRF decision attached,
    // not an accident that inherits a pre-existing exemption.
    for (const path of ['/auth/send-otp', '/auth/verify-otp']) {
      const res = await request.post(`${API_BASE}${path}`, { data: { phone: SEEDED_OWNER_PHONE } })
      expect(res.status(), `${path} should not be mounted`).toBe(404)
    }
  })
})
