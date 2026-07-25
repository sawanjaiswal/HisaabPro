/**
 * Playwright fixtures for the gold suites.
 *
 * The difference from e2e/legacy-mocked/fixtures.ts is the whole point of this
 * directory: nothing here calls page.route(). Auth is a real registration
 * against a real server, and the resulting cookies are real cookies.
 */

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
import { registerVerifiedUser, testHooksLive } from './api'
import { uniquePhone, VALID_PASSWORD, ROUTES, COOKIES, CSRF_HEADER } from './constants'

interface FreshUser {
  phone: string
  password: string
}

interface GoldFixtures {
  /** Fails the spec early and clearly if the API was started without hooks. */
  hooksGuard: void
  /** A brand-new verified account, unique to this test. */
  freshUser: FreshUser
  /** Console errors collected for the whole test — assert empty where relevant. */
  consoleErrors: string[]
}

export const test = base.extend<GoldFixtures>({
  hooksGuard: [
    async ({ request }, use) => {
      if (!(await testHooksLive(request))) {
        throw new Error(
          'E2E test hooks are not live. The API must run with E2E_TEST_HOOKS=1 ' +
            '(playwright.config.ts sets this) — without it there is no way to read an OTP.',
        )
      }
      await use()
    },
    { auto: true },
  ],

  freshUser: async ({ request }, use) => {
    const phone = uniquePhone()
    await registerVerifiedUser(request, phone, VALID_PASSWORD)
    await use({ phone, password: VALID_PASSWORD })
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await use(errors)
  },
})

export { expect }

/** Logs in through the real form and waits for the app shell to take over. */
export async function loginViaUi(page: Page, phone: string, password: string): Promise<void> {
  await page.goto(ROUTES.LOGIN)
  await page.locator('#identifier').fill(phone)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith(ROUTES.LOGIN), { timeout: 20_000 })
}

/**
 * Fills the 6 OTP boxes one digit at a time and submits, the way a user does.
 *
 * The screen does NOT auto-submit on the sixth digit — there is an explicit
 * "Verify and create" CTA, disabled until the code is complete. Filling alone
 * therefore verifies nothing.
 */
export async function typeOtp(page: Page, otp: string, selector: string): Promise<void> {
  const boxes = page.locator(selector)
  for (let i = 0; i < otp.length; i++) {
    await boxes.nth(i).fill(otp[i])
  }
  const submit = page.locator('.auth-otp .login-page__submit')
  await expect(submit).toBeEnabled({ timeout: 5_000 })
  await submit.click()
}

/**
 * API failures caused by the user action under test, ignoring the anonymous
 * boot probe. Every logged-out page load fires `GET /auth/me` (401) and
 * `POST /auth/refresh` (400) to discover there is no session — expected, and
 * not evidence of anything a registration case asserts.
 */
export function actionFailures(failures: string[]): string[] {
  return failures.filter((f) => !/\/api\/auth\/(me|refresh)$/.test(f))
}

/**
 * Issues a state-changing API call the way the app does: with the CSRF token
 * bootstrapped from the cookie. Playwright's request context inherits cookies
 * but sends no `x-csrf-token` header, so a bare POST is rejected with
 * CSRF_FAILED — which would look like the endpoint failing rather than the
 * caller skipping a step the real client performs.
 */
export async function csrfPost(page: Page, path: string, data?: unknown) {
  await page.request.get(`${path.replace(/\/api\/.*$/, '')}/api/auth/csrf-token`).catch(() => {})
  const cookies = await page.context().cookies()
  const token = cookies.find((c) => c.name === COOKIES.csrf)?.value ?? ''
  return page.request.post(path, {
    headers: { [CSRF_HEADER]: token },
    ...(data === undefined ? {} : { data }),
  })
}

/** Non-2xx/3xx responses seen during the test — catches silent 500s. */
export function trackFailedRequests(page: Page): { get: () => string[] } {
  const failures: string[] = []
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      failures.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`)
    }
  })
  return { get: () => [...failures] }
}

/** Assert no horizontal overflow — every page, every viewport (checklist F). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `horizontal overflow: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth + 1,
  )
}

export type { APIRequestContext }
