/**
 * Suite D — Onboarding wizard (TC-ONB-01 … TC-ONB-08).
 * docs/E2E_TEST_PLAN.md §5. Real server, real Postgres, real cookies.
 *
 * Every case starts from a brand-new verified account with no business, which
 * is the only state that renders the wizard: ProtectedRoute sends a user with
 * zero businesses to /onboarding and a user with one straight past it.
 */

import { test, expect, loginViaUi, expectNoHorizontalScroll } from './support/fixtures'
import { API_BASE } from './support/api'
import { ROUTES } from './support/constants'
import type { Page } from '@playwright/test'

// Every case needs its own brand-new account, and registration is limited per
// IP — a real defence that a suite registering seven users from one address
// trips halfway through. Cleared per test so the limiter guards production
// rather than this file. Registration limits are asserted in Suite B.
test.beforeEach(async ({ request }) => {
  await request.post(`${API_BASE}/__test__/reset-rate-limits`)
})

/** The wizard's own route — a fresh account is bounced here from anywhere. */
async function openWizard(page: Page, phone: string, password: string): Promise<void> {
  await loginViaUi(page, phone, password)
  await page.waitForURL(`**${ROUTES.ONBOARDING}`, { timeout: 20_000 })
}

const btn = (page: Page, name: RegExp) => page.getByRole('button', { name })

async function stepWelcome(page: Page): Promise<void> {
  await btn(page, /get started/i).click()
}

async function stepDetails(
  page: Page,
  opts: { name: string; location?: string },
): Promise<void> {
  await page.locator('#businessName').fill(opts.name)
  if (opts.location) await page.locator('#businessLocation').fill(opts.location)
  await btn(page, /continue/i).click()
}

async function stepType(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('radio', { name: label }).first().click()
  await btn(page, /continue/i).click()
}

async function stepSource(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('radio', { name: label }).first().click()
  await btn(page, /continue/i).click()
}

async function stepPath(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('radio', { name: label }).first().click()
  await btn(page, /continue/i).click()
}

/** The business the wizard just created, read back from the real API. */
async function createdBusiness(page: Page): Promise<Record<string, unknown>> {
  const me = await page.request.get(`${API_BASE}/auth/me`)
  expect(me.status(), '/auth/me after onboarding').toBe(200)
  const body = await me.json()
  const list = body.data.businesses as Array<{ id: string }>
  expect(list.length, 'exactly one business after onboarding').toBe(1)
  const detail = await page.request.get(`${API_BASE}/businesses/${list[0]!.id}`)
  expect(detail.status(), 'GET /businesses/:id').toBe(200)
  return (await detail.json()).data as Record<string, unknown>
}

test.describe('TC-ONB — onboarding wizard', () => {
  test('TC-ONB-01 golden path: six steps, business created, dashboard reached', async ({
    page,
    freshUser,
  }) => {
    await openWizard(page, freshUser.phone, freshUser.password)

    await stepWelcome(page)
    await stepDetails(page, { name: 'Raju Kirana Store' })
    await stepType(page, /retail/i)
    await stepSource(page, /notebook/i)
    await stepPath(page, /start fresh/i)

    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible({ timeout: 20_000 })
    await btn(page, /go to home/i).click()
    await page.waitForURL(`**${ROUTES.DASHBOARD}`, { timeout: 20_000 })

    const business = await createdBusiness(page)
    expect(business.name).toBe('Raju Kirana Store')
    expect(business.businessType).toBe('retail')

    // Setup happens once. /onboarding stays reachable on purpose — it is the
    // "add another business" flow behind the business switcher — but a
    // shopkeeper who already has a shop must never be pushed back into it, and
    // must never see last time's answers waiting in the fields.
    await page.goto(ROUTES.DASHBOARD)
    await expect(page).toHaveURL(new RegExp(`${ROUTES.DASHBOARD}$`), { timeout: 20_000 })

    await page.goto(ROUTES.ONBOARDING)
    await btn(page, /get started/i).click()
    await expect(page.locator('#businessName'), 'a second business starts blank').toHaveValue('')
  })

  test('TC-ONB-02 a blank business name cannot advance', async ({ page, freshUser }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)

    await expect(btn(page, /continue/i)).toBeDisabled()
    // Whitespace is not a name — trim, not truthiness.
    await page.locator('#businessName').fill('   ')
    await expect(btn(page, /continue/i)).toBeDisabled()

    await page.locator('#businessName').fill('Priya Traders')
    await expect(btn(page, /continue/i)).toBeEnabled()
  })

  test('TC-ONB-03 the vertical picked at onboarding is the one persisted', async ({
    page,
    freshUser,
  }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)
    await stepDetails(page, { name: 'Amit Medical' })

    // Every vertical the picker offers must be one the server's enum accepts —
    // a card that 400s at the last step wastes the whole wizard.
    const cards = page.getByRole('radio')
    await expect(cards).not.toHaveCount(0)

    await stepType(page, /pharmacy/i)
    await stepSource(page, /excel/i)
    await stepPath(page, /start fresh/i)

    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible({ timeout: 20_000 })
    const business = await createdBusiness(page)
    expect(business.businessType, 'the vertical the shopkeeper chose').toBe('pharmacy')
  })

  test('TC-ONB-04 the answers the wizard collects are actually kept', async ({
    page,
    freshUser,
  }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)
    await stepDetails(page, { name: 'Kumar Wholesale', location: 'Indore' })
    await stepType(page, /wholesale/i)
    await stepSource(page, /tally/i)
    await stepPath(page, /start fresh/i)

    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible({ timeout: 20_000 })
    const business = await createdBusiness(page)

    // Asking for the shop's location and then discarding it is worse than not
    // asking: the shopkeeper believes it is on file, and the invoice header
    // that should carry it stays blank.
    expect(business.city ?? business.address, 'business location captured at onboarding').toBe(
      'Indore',
    )
  })

  test('TC-ONB-05 choosing "import my existing data" leads to the import flow', async ({
    page,
    freshUser,
  }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)
    await stepDetails(page, { name: 'Verma Distributors' })
    await stepType(page, /wholesale/i)
    await stepSource(page, /excel/i)
    await stepPath(page, /import my existing data/i)

    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible({ timeout: 20_000 })
    await btn(page, /go to home/i).click()

    // The recommended path is a promise: a shopkeeper who said "I have data to
    // bring in" must land where they can bring it in, not on an empty dashboard
    // that gives no hint the importer exists.
    await expect(page).toHaveURL(/\/imports?(\/|$)/, { timeout: 20_000 })
  })

  test('TC-ONB-06 going back keeps the answers already given', async ({ page, freshUser }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)
    await stepDetails(page, { name: 'Singh Electronics', location: 'Bhopal' })
    await stepType(page, /retail/i)

    // dataSource → back → back lands on business details.
    await btn(page, /back/i).click()
    await btn(page, /back/i).click()

    await expect(page.locator('#businessName')).toHaveValue('Singh Electronics')
    await expect(page.locator('#businessLocation')).toHaveValue('Bhopal')
  })

  test('TC-ONB-07 an interrupted setup resumes where it stopped', async ({ page, freshUser }) => {
    await openWizard(page, freshUser.phone, freshUser.password)
    await stepWelcome(page)
    await stepDetails(page, { name: 'Nair Stores' })

    // A shopkeeper on a Rs 8K phone loses the app to a call or a low-memory
    // kill mid-setup. Reopening must not throw away what they already typed.
    await page.reload()

    await expect(
      page.getByRole('heading', { name: /what kind of business/i }),
      'resumed at the step the user left',
    ).toBeVisible({ timeout: 20_000 })
  })

  test('TC-ONB-08 the whole wizard fits 320px', async ({ page, freshUser }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await openWizard(page, freshUser.phone, freshUser.password)

    await expectNoHorizontalScroll(page)
    await stepWelcome(page)
    await expectNoHorizontalScroll(page)
    await stepDetails(page, { name: 'Small Screen Traders' })
    await expectNoHorizontalScroll(page)
    await stepType(page, /retail/i)
    await expectNoHorizontalScroll(page)
    await stepSource(page, /notebook/i)
    await expectNoHorizontalScroll(page)
  })
})
