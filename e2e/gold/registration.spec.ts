/**
 * Suite B — Registration + OTP (TC-REG-01 … TC-REG-12).
 * docs/E2E_TEST_PLAN.md §3. Real server, real Postgres, real cookies.
 */

import { test, expect, typeOtp, trackFailedRequests, actionFailures } from './support/fixtures'
import { waitForOtp, lastOtp, registerVerifiedUser, API_BASE } from './support/api'
import {
  ROUTES,
  SEL,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  VALID_PASSWORD,
  uniquePhone,
} from './support/constants'

// Every spec below drives the real limiter-guarded endpoints from one IP, so
// the bucket is cleared between cases. TC-REG-11 opts out — see its comment.
test.beforeEach(async ({ request }) => {
  await request.post(`${API_BASE}/__test__/reset-rate-limits`)
})

async function fillRegisterForm(page: import('@playwright/test').Page, phone: string, opts?: {
  name?: string
  password?: string
}) {
  await page.goto(ROUTES.REGISTER)
  await page.locator('#name').fill(opts?.name ?? 'E2E User')
  await page.locator('#phone').fill(phone)
  await page.locator('#password').fill(opts?.password ?? VALID_PASSWORD)
}

test.describe('TC-REG — registration + OTP', () => {
  test('TC-REG-01 golden path: register → OTP → authenticated', async ({ page, request }) => {
    const phone = uniquePhone()
    const failures = trackFailedRequests(page)

    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()

    await page.waitForURL(`**${ROUTES.VERIFY_OTP}`, { timeout: 20_000 })

    const otp = await waitForOtp(request, phone)
    expect(otp).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`))

    await typeOtp(page, otp, SEL.otpDigit)
    // Lands anywhere past the auth wall — onboarding for a user with no business.
    await page.waitForURL((url) => !url.pathname.startsWith(ROUTES.VERIFY_OTP), { timeout: 20_000 })

    // The real proof: a cookie-authenticated call to the real server.
    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.status(), 'authenticated /auth/me after OTP verify').toBe(200)
    const body = await me.json()
    expect(body.data.user.phone).toBe(phone)

    expect(actionFailures(failures.get()), 'no failed API calls on the golden path').toEqual([])
  })

  test('TC-REG-02 invalid phone is rejected before any API call', async ({ page }) => {
    const failures = trackFailedRequests(page)
    await fillRegisterForm(page, '')
    await page.locator('#phone').fill('98765') // 5 digits

    const submit = page.getByRole('button', { name: /continue/i })
    if (await submit.isEnabled()) await submit.click()

    await expect(page).toHaveURL(new RegExp(`${ROUTES.REGISTER}$`))
    expect(actionFailures(failures.get()), 'short phone must not reach the server').toEqual([])
  })

  test('TC-REG-03 weak password is rejected', async ({ page }) => {
    const phone = uniquePhone()
    await fillRegisterForm(page, phone, { password: '12345' })

    const submit = page.getByRole('button', { name: /continue/i })
    if (await submit.isEnabled()) await submit.click()

    // Either blocked client-side or refused server-side — never accepted.
    await expect(page).not.toHaveURL(new RegExp(`${ROUTES.VERIFY_OTP}$`))
  })

  test('TC-REG-04 duplicate phone gives a usable message, not a 500', async ({ page, request }) => {
    const phone = uniquePhone()
    await registerVerifiedUser(request, phone, VALID_PASSWORD)
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)

    const res = await request.post(`${API_BASE}/auth/register`, {
      data: { phone, name: 'Duplicate', password: VALID_PASSWORD },
    })
    expect(res.status(), 'duplicate registration must not 500').toBeLessThan(500)
    expect(res.status()).toBeGreaterThanOrEqual(400)

    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page).not.toHaveURL(new RegExp(`${ROUTES.VERIFY_OTP}$`), { timeout: 10_000 })
  })

  test('TC-REG-05 wrong OTP is rejected with a visible error', async ({ page, request }) => {
    const phone = uniquePhone()
    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(`**${ROUTES.VERIFY_OTP}`, { timeout: 20_000 })
    await waitForOtp(request, phone)

    await typeOtp(page, '000000', SEL.otpDigit)

    await expect(page.locator(SEL.otpError)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(new RegExp(`${ROUTES.VERIFY_OTP}$`))
  })

  test('TC-REG-06 OTP attempts are capped server-side', async ({ request }) => {
    const phone = uniquePhone()
    await request.post(`${API_BASE}/auth/register`, {
      data: { phone, name: 'Lockout', password: VALID_PASSWORD },
    })
    const real = await waitForOtp(request, phone)
    const wrong = real === '000000' ? '111111' : '000000'

    const statuses: number[] = []
    for (let i = 0; i < OTP_MAX_ATTEMPTS + 1; i++) {
      await request.post(`${API_BASE}/__test__/reset-rate-limits`)
      const res = await request.post(`${API_BASE}/auth/verify-registration`, {
        data: { phone, otp: wrong },
      })
      statuses.push(res.status())
    }
    expect(statuses.every((s) => s >= 400), 'no wrong OTP may ever verify').toBe(true)

    // After the cap, the CORRECT code must also be refused — otherwise the cap
    // is cosmetic and brute force still wins.
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const afterLockout = await request.post(`${API_BASE}/auth/verify-registration`, {
      data: { phone, otp: real },
    })
    expect(afterLockout.ok(), 'correct OTP after lockout must be refused').toBe(false)
  })

  test('TC-REG-08 resend is rate-limited by a visible cooldown', async ({ page, request }) => {
    const phone = uniquePhone()
    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(`**${ROUTES.VERIFY_OTP}`, { timeout: 20_000 })
    await waitForOtp(request, phone)

    // A countdown must be on screen immediately — resend cannot be spammed.
    await expect(page.locator('.auth-otp__cooldown').first()).toBeVisible({ timeout: 10_000 })
  })

  test('TC-REG-09 pasting a 6-digit code fills every box', async ({ page, request }) => {
    const phone = uniquePhone()
    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(`**${ROUTES.VERIFY_OTP}`, { timeout: 20_000 })
    const otp = await waitForOtp(request, phone)

    const first = page.locator(SEL.otpDigit).first()
    await first.focus()
    await page.evaluate(
      ([code, sel]) => {
        const el = document.querySelector(sel as string) as HTMLInputElement
        const dt = new DataTransfer()
        dt.setData('text/plain', code as string)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
      },
      [otp, SEL.otpDigit] as const,
    )

    const boxes = page.locator(SEL.otpDigit)
    for (let i = 0; i < OTP_LENGTH; i++) {
      await expect(boxes.nth(i), `box ${i} filled by paste`).toHaveValue(otp[i])
    }
  })

  test('TC-REG-10 landing on /verify-otp with no phone in state does not crash', async ({ page, consoleErrors }) => {
    await page.goto(ROUTES.VERIFY_OTP)
    // Either bounced back to register, or rendered without a crash — never a
    // white screen. Assert the app is alive rather than dictating which.
    await expect(page.locator('body')).toBeVisible()
    const crashed = consoleErrors.filter((e) => /cannot read|undefined is not|of null/i.test(e))
    expect(crashed, 'no dereference crash on direct /verify-otp').toEqual([])
  })

  test('TC-REG-11 register endpoint is rate-limited (no reset — that is the point)', async ({ request }) => {
    // Deliberately does NOT clear the bucket first: this case exists to prove
    // the limiter fires. beforeEach cleared it, so the count starts at 0 here.
    const statuses: number[] = []
    for (let i = 0; i < 30; i++) {
      const res = await request.post(`${API_BASE}/auth/register`, {
        data: { phone: uniquePhone(), name: 'Flood', password: VALID_PASSWORD },
      })
      statuses.push(res.status())
      if (res.status() === 429) break
    }
    expect(statuses, 'a burst of registrations must eventually 429').toContain(429)
  })

  test('TC-REG-12 back from OTP screen returns to register without a session', async ({ page, request }) => {
    const phone = uniquePhone()
    await fillRegisterForm(page, phone)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(`**${ROUTES.VERIFY_OTP}`, { timeout: 20_000 })
    await waitForOtp(request, phone)

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${ROUTES.REGISTER}$`))

    // No ghost session: an unverified registration must not be authenticated.
    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'unverified registration must not be logged in').toBe(false)
  })

  test('TC-REG-07 OTP is single-use', async ({ request }) => {
    // TTL expiry (5 min) is not wall-clock-testable in a 60s spec. What IS
    // testable, and matters more, is that a consumed code cannot be replayed.
    const phone = uniquePhone()
    await request.post(`${API_BASE}/auth/register`, {
      data: { phone, name: 'Replay', password: VALID_PASSWORD },
    })
    const otp = await waitForOtp(request, phone)

    const first = await request.post(`${API_BASE}/auth/verify-registration`, { data: { phone, otp } })
    expect(first.ok(), `first verify should succeed: ${first.status()}`).toBe(true)

    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    const replay = await request.post(`${API_BASE}/auth/verify-registration`, { data: { phone, otp } })
    expect(replay.ok(), 'a consumed OTP must not verify twice').toBe(false)
  })

  test('TC-REG-SEC OTP is never returned by a non-test endpoint', async ({ request }) => {
    const phone = uniquePhone()
    const res = await request.post(`${API_BASE}/auth/register`, {
      data: { phone, name: 'Leak check', password: VALID_PASSWORD },
    })
    const text = await res.text()
    const otp = await lastOtp(request, phone)
    expect(otp).not.toBeNull()
    expect(text, 'register response must not leak the OTP').not.toContain(otp as string)
  })
})
