/**
 * Playwright fixtures for the gold suites.
 *
 * The difference from e2e/legacy-mocked/fixtures.ts is the whole point of this
 * directory: nothing here calls page.route(). Auth is a real registration
 * against a real server, and the resulting cookies are real cookies.
 */

import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'
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

/**
 * Sessions already established in this worker, keyed by identity.
 *
 * The login endpoint is rate limited to 20 attempts per minute per IP — a real
 * brute-force defence that a suite doing one UI login per test trips at test
 * 21, failing whichever case happens to be there. Reusing the cookies of a
 * session this worker already earned keeps every test authenticated as a real
 * logged-in user without pretending the limiter isn't there. Login itself is
 * under test in the auth suite, which is where those attempts belong.
 */
type SessionCookies = Awaited<ReturnType<BrowserContext['cookies']>>
interface CachedSession {
  cookies: SessionCookies
  /** sessionStorage the app writes at login — `cachedUser` is the hint
   *  ProtectedRoute reads before the server confirms the cookie. Restoring
   *  cookies alone leaves the first render logged-out, which bounces a deep
   *  link to the dashboard (finding F8) and makes the target page never load. */
  storage: Record<string, string>
}
const sessions = new Map<string, CachedSession>()

/** Logs in through the real form and waits for the app shell to take over. */
export async function loginViaUi(page: Page, phone: string, password: string): Promise<void> {
  const cached = sessions.get(phone)
  if (cached) {
    await page.context().addCookies(cached.cookies)
    await page.addInitScript((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value)
    }, cached.storage)
    await page.goto(ROUTES.DASHBOARD)
    await page.waitForURL((url) => !url.pathname.startsWith(ROUTES.LOGIN), { timeout: 20_000 })
    return
  }

  await page.goto(ROUTES.LOGIN)

  const identifier = page.locator('#identifier')
  const password_ = page.locator('#password')
  const submit = page.getByRole('button', { name: /sign in/i })

  // The CTA is disabled until both fields hold a value. Typing into the form
  // before React has hydrated it silently loses the keystrokes — the input
  // shows text, the component's state does not, and the button stays disabled
  // through a 60s retry loop that reads like the login endpoint hanging.
  // Re-fill until the value sticks, then wait on the button's own state.
  await expect(async () => {
    await identifier.fill(phone)
    await password_.fill(password)
    await expect(identifier).toHaveValue(phone, { timeout: 1_000 })
    await expect(submit).toBeEnabled({ timeout: 1_000 })
  }).toPass({ timeout: 20_000 })

  await submit.click()
  await page.waitForURL((url) => !url.pathname.startsWith(ROUTES.LOGIN), { timeout: 20_000 })
  sessions.set(phone, {
    cookies: await page.context().cookies(),
    storage: await page.evaluate(() => ({ ...sessionStorage }) as Record<string, string>),
  })
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
    headers: {
      [CSRF_HEADER]: token,
      // replayProtection rejects a mutation without these; the real client adds
      // them in buildRequestHeaders() for every state-changing request, so a
      // helper that omitted them would fail as MISSING_REQUEST_HEADERS and read
      // like the endpoint being broken.
      'X-Request-Nonce': crypto.randomUUID(),
      'X-Request-Timestamp': Date.now().toString(),
    },
    ...(data === undefined ? {} : { data }),
  })
}

/**
 * The offline mutation queue as the browser holds it (Dexie → IndexedDB).
 *
 * A queued mutation that never lands is indistinguishable from one that was
 * never queued unless the item's own status and error are read back — "still
 * pending" (the app never retried), "dead" (the server refused it) and "absent"
 * are three different bugs.
 */
export async function readSyncQueue(
  page: Page,
): Promise<Array<{ path: string; status: string; errorMessage: string | null }>> {
  return page.evaluate(async () => {
    // Mirrors SYNC_DB_NAME (src/lib/offline.constants.ts). Matching loosely on
    // /hisaab/ would open whichever of the app's several IndexedDB databases
    // came back first and report an empty queue for the wrong store.
    const name = 'hisaabpro-sync'
    return new Promise((resolve) => {
      const req = indexedDB.open(name)
      req.onerror = () => resolve([])
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('syncQueue')) return resolve([])
        const all = db.transaction('syncQueue', 'readonly').objectStore('syncQueue').getAll()
        all.onerror = () => resolve([])
        all.onsuccess = () =>
          resolve(
            all.result.map((i: Record<string, unknown>) => ({
              path: String(i.path),
              status: String(i.status),
              errorMessage: (i.errorMessage as string | null) ?? null,
            })),
          )
      }
    })
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
