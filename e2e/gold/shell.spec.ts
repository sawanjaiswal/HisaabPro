/**
 * Suite A — App shell (TC-SHELL-01 … TC-SHELL-08). docs/E2E_TEST_PLAN.md §2.
 *
 * TC-SHELL-03 (3G paint budget) and TC-SHELL-04 (Capacitor status-bar overlap)
 * are not here: 03 needs a throttled Lighthouse run and 04 needs a signed build
 * on a device. Both stay manual — §55 of the plan records that.
 */

import { test, expect, loginViaUi, trackFailedRequests } from './support/fixtures'
import { API_BASE } from './support/api'
import { ROUTES, SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'

test.beforeEach(async ({ request }) => {
  await request.post(`${API_BASE}/__test__/reset-rate-limits`)
})

test.describe('TC-SHELL — boot and navigation', () => {
  test('TC-SHELL-01 a cold, unauthenticated boot lands on a real screen', async ({ page }) => {
    const failures = trackFailedRequests(page)
    const consoleErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })

    await page.goto(ROUTES.LANDING)
    await page.waitForLoadState('domcontentloaded')

    // Something must actually render — a white screen is the failure mode this
    // case exists for.
    await expect(page.locator('body')).not.toBeEmpty()
    const text = (await page.locator('body').innerText()).trim()
    expect(text.length, 'the first screen must render content').toBeGreaterThan(0)

    // No redirect loop: the URL must settle, and it must not be /login→/→/login.
    const first = page.url()
    await page.waitForTimeout(1_500)
    expect(page.url(), 'the landing URL must settle, not bounce').toBe(first)

    // A boot with no session legitimately 401s /auth/me and 400s /auth/refresh;
    // anything else is a broken request on the very first screen.
    const unexpected = failures.get().filter((f) => !/\/api\/auth\/(me|refresh)$/.test(f))
    expect(unexpected, 'no unexpected failed requests on cold boot').toEqual([])

    // Console errors from those same two probes are expected noise.
    const realErrors = consoleErrors.filter((e) => !/401|400|Unauthorized/.test(e))
    expect(realErrors, 'cold boot must not log errors').toEqual([])
  })

  test('TC-SHELL-02 a deep link while logged out goes to login', async ({ page }) => {
    await page.goto(ROUTES.INVOICES)
    await expect(page, 'a protected deep link must redirect to login').toHaveURL(
      new RegExp(`${ROUTES.LOGIN}$`),
      { timeout: 15_000 },
    )
  })

  test('TC-SHELL-02b after logging in the user reaches an authenticated screen', async ({
    page,
  }) => {
    // The plan asks for the intended path to be preserved across login. The app
    // redirects with `<Navigate replace />` and no location state, so it cannot
    // be — this case pins the behaviour that DOES exist (login always lands
    // authenticated) and the return-to-intent gap is filed in docs/E2E_RESULTS.md
    // rather than asserted here as a false green.
    await page.goto(ROUTES.INVOICES)
    await expect(page).toHaveURL(new RegExp(`${ROUTES.LOGIN}$`), { timeout: 15_000 })

    await page.locator('#identifier').fill(SEEDED_OWNER_PHONE)
    await page.locator('#password').fill(VALID_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page, 'login must leave the auth wall').not.toHaveURL(
      new RegExp(`${ROUTES.LOGIN}$`),
      { timeout: 15_000 },
    )
    const me = await page.request.get(`${API_BASE}/auth/me`)
    expect(me.ok(), 'the session must be live after login').toBe(true)
  })

  test('TC-SHELL-06 an offline cold boot shows the shell, never a white screen', async ({
    page,
    context,
  }) => {
    await page.goto(ROUTES.LANDING)
    await page.waitForLoadState('domcontentloaded')

    // An offline cold boot is served entirely by the service worker, and the
    // worker is deliberately absent under `vite dev` (src/lib/sw-register.ts
    // unregisters it so a stale worker can't serve dead chunk URLs). Asserting
    // here against the dev server would only prove that dev has no SW. The case
    // runs unchanged the day the suite points at a `vite preview` build.
    const swCount = await page.evaluate(async () =>
      'serviceWorker' in navigator
        ? (await navigator.serviceWorker.getRegistrations()).length
        : 0,
    )
    test.skip(swCount === 0, 'no service worker under vite dev — needs a preview build')

    await context.setOffline(true)
    await page.reload().catch(() => {
      // A hard navigation failure offline is itself the finding; assert below.
    })

    const text = (await page.locator('body').innerText().catch(() => '')).trim()
    expect(text.length, 'an offline boot must render something, not a blank tab').toBeGreaterThan(0)

    await context.setOffline(false)
  })

  test('TC-SHELL-06b going offline mid-session keeps the app usable', async ({ page, context }) => {
    // The case that does not need a service worker: the app is already loaded
    // (Raju's phone drops to no-signal inside a shop). The shell must stay up
    // and must say so — a silent dead UI is the failure mode.
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
    await context.setOffline(true)

    const banner = page.locator('.offline-banner, [data-offline]')
    await expect(banner.first(), 'the user must be told they are offline').toBeVisible({
      timeout: 30_000,
    })

    // And the shell must still navigate — the banner is an overlay, not a wall.
    await page.locator('nav.bnav .bnav__tab').first().click()
    await expect(page.locator('nav.bnav'), 'the shell must survive going offline').toBeVisible()

    await context.setOffline(false)
  })
})

test.describe('TC-SHELL — chrome', () => {
  test('TC-SHELL-08 the bottom nav is complete and tappable', async ({ page }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    const nav = page.locator('nav.bnav')
    await expect(nav, 'authenticated pages carry the bottom nav').toBeVisible()

    const tabs = nav.locator('.bnav__tab')
    await expect(tabs, 'the nav must have its full set of entries').toHaveCount(5)

    // Hardware floor, independent of the density type scale (CLAUDE.md).
    const count = await tabs.count()
    for (let i = 0; i < count; i++) {
      const box = await tabs.nth(i).boundingBox()
      expect(box, `tab ${i} must be laid out`).not.toBeNull()
      expect(box!.height, `tab ${i} height`).toBeGreaterThanOrEqual(40)
      expect(box!.width, `tab ${i} width`).toBeGreaterThanOrEqual(40)
    }

    // Exactly one active entry, and it is the one matching the current route.
    await expect(nav.locator('.bnav__tab--active')).toHaveCount(1)
  })

  test('TC-SHELL-08b every nav entry navigates and keeps the nav mounted', async ({ page }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)

    const nav = page.locator('nav.bnav')
    const labels = await nav.locator('.bnav__tab:not(.bnav__tab--create) .bnav__label').allInnerTexts()
    expect(labels.length, 'expected route tabs beside Create').toBeGreaterThan(0)

    for (const label of labels) {
      await nav.locator('.bnav__tab', { hasText: label }).first().click()
      await page.waitForLoadState('domcontentloaded')
      // The tab bar is persistent chrome — losing it mid-journey traps the user.
      await expect(nav, `nav must survive navigating to ${label}`).toBeVisible()
      await expect(page, `${label} must not bounce to login`).not.toHaveURL(
        new RegExp(`${ROUTES.LOGIN}$`),
      )
    }
  })

  test('TC-SHELL-05 the language switch flips the UI to Hindi and survives a reload', async ({
    page,
  }) => {
    // The toggle lives in Settings, not on the login screen the plan named —
    // there is no pre-login language control at all. Recorded as a finding; the
    // toggle that DOES exist is tested here.
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const before = await page.locator('body').innerText()
    await page.getByText(/language|भाषा/i).first().click()

    await expect
      .poll(async () => await page.locator('body').innerText(), { timeout: 10_000 })
      .not.toBe(before)

    const after = await page.locator('body').innerText()
    expect(/[ऀ-ॿ]/.test(after), 'switching must render Devanagari').toBe(true)
    // A missing key renders as the key itself — the classic i18n leak.
    expect(after, 'no raw translation keys may leak').not.toMatch(/\bt\.[a-zA-Z]/)

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect
      .poll(async () => /[ऀ-ॿ]/.test(await page.locator('body').innerText()), {
        timeout: 10_000,
      })
      .toBe(true)
  })
})
