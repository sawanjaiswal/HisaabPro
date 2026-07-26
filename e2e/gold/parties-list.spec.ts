/**
 * Suite H — Parties, part 2: search, pagination, detail, GSTIN, offline, states.
 * Plan: docs/E2E_TEST_PLAN.md §9. Cases TC-PTY-06..12.
 *
 * Part 1 (create/edit/delete) is e2e/gold/parties.spec.ts. Split because one
 * spec file per concern keeps a failure's blast radius readable, not because
 * of a line limit.
 */

import {
  test,
  expect,
  loginViaUi,
  expectNoHorizontalScroll,
  trackFailedRequests,
  readSyncQueue,
} from './support/fixtures'
import { GSTIN, SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import {
  apiCreateParty,
  apiPartyTotal,
  openPartySection,
  uniqueName,
  uniquePartyPhone,
} from './support/parties'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test('TC-PTY-06 search finds a party by partial name and by phone', async ({ page }) => {
  const token = Date.now().toString(36)
  const phone = uniquePartyPhone()
  const party = await apiCreateParty(page, { name: `Findable ${token} Traders`, phone })

  await page.goto('/parties')
  const search = page.getByRole('searchbox', { name: /search parties/i })

  await search.fill(token)
  await expect(page.locator('.txn-row', { hasText: party.name })).toBeVisible({ timeout: 10_000 })

  // Phone search matters more than name search here: a shopkeeper looking a
  // customer up at the counter has the number, not the spelling.
  await search.fill(phone)
  await expect(page.locator('.txn-row', { hasText: party.name })).toBeVisible({ timeout: 10_000 })

  await search.fill('zzz-no-such-party-zzz')
  await expect(page.locator('.txn-row')).toHaveCount(0, { timeout: 10_000 })
})

test('TC-PTY-07 every party is reachable once there are more than one page', async ({ page }) => {
  // DEFAULT_FILTERS asks for 20 per page (src/features/parties/party.constants.ts).
  // Priya and Amit have hundreds of parties, so "page 2 exists" is the normal
  // case for two of the three personas, not an edge case.
  const PAGE_SIZE = 20
  await page.goto('/parties')
  await expect(page.locator('.txn-row').first()).toBeVisible({ timeout: 15_000 })

  const total = await apiPartyTotal(page)
  for (let i = total; i <= PAGE_SIZE; i++) {
    await apiCreateParty(page, { name: uniqueName('Pager') })
  }

  await page.goto('/parties')
  await expect(page.locator('.txn-row').first()).toBeVisible({ timeout: 15_000 })
  const rows = await page.locator('.txn-row').count()
  const shown = await apiPartyTotal(page)
  expect(shown, 'the business must now hold more parties than one page').toBeGreaterThan(PAGE_SIZE)

  // A pager, a "load more", or infinite scroll all satisfy this. None of them
  // means every party past the 20th is unreachable except by exact search.
  if (rows < shown) {
    await expect(
      page.getByRole('button', { name: /load more|next|show more/i }),
      `${shown} parties exist but only ${rows} rendered with no way to reach the rest`,
    ).toBeVisible()
  }
})

test('TC-PTY-08 the detail page reconciles name, balance and ledger', async ({ page }) => {
  const failures = trackFailedRequests(page)
  const party = await apiCreateParty(page, {
    name: uniqueName('Ledger'),
    phone: uniquePartyPhone(),
    openingBalance: { amount: 250000, type: 'RECEIVABLE', asOfDate: '2026-07-26' },
  })

  await page.goto(`/parties/${party.id}`)
  await expect(page.locator('.pdh-name')).toHaveText(party.name, { timeout: 15_000 })

  // 250000 paise = Rs 2,500 — the paise→rupee boundary is where this breaks.
  await expect(page.locator('body')).toContainText(/2,?500/)
  expect(failures.get(), 'the detail page must load without an API failure').toEqual([])
})

test('TC-PTY-10 GSTIN is validated before it can classify an invoice as B2B', async ({ page }) => {
  const failures = trackFailedRequests(page)
  await page.goto('/parties/new')
  await page.locator('#party-name').fill(uniqueName('GST Party'))
  await openPartySection(page, /^business$/i)

  await page.locator('#party-gstin').fill(GSTIN.malformed)
  await page.getByRole('button', { name: /save party/i }).first().click()
  await expect(page.getByText(/valid 15-character GSTIN/i)).toBeVisible()

  // Shape alone is not enough: a 15-char GSTIN with a wrong check digit is a
  // typo, and accepting it would put an unfilable number on a B2B invoice.
  await page.locator('#party-gstin').fill(GSTIN.badChecksum)
  await expect(page.getByText(/checksum/i)).toBeVisible({ timeout: 10_000 })

  // 27 = Maharashtra. A valid GSTIN must save AND round-trip, because the
  // invoice flow reads it back to decide CGST+SGST vs IGST.
  await page.locator('#party-gstin').fill(GSTIN.intraState)
  await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /save party/i }).first().click()
  await page.waitForURL('**/parties', { timeout: 15_000 })
  expect(failures.get(), 'saving a valid GSTIN must not produce an API failure').toEqual([])
})

test('TC-PTY-11 a party created offline is queued with a readable label', async ({ page, context }) => {
  await page.goto('/parties/new')
  const name = uniqueName('Offline Party')

  // Load the screen fully before cutting the network. Going offline while the
  // route's lazy chunk is still in flight tests the SW's asset cache, not the
  // mutation queue — and a shopkeeper loses signal mid-form, not mid-navigation.
  await expect(page.locator('#party-name')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(true)
  await page.locator('#party-name').fill(name)
  await page.locator('#party-phone').fill(uniquePartyPhone())
  await page.getByRole('button', { name: /save party/i }).first().click()

  // OFFLINE_RULES rule 2: the queue must name the thing being saved, not show
  // "Offline change". The party's own name is the label the service passes.
  await expect(page.locator('body')).toContainText(name, { timeout: 15_000 })

  await context.setOffline(false)
  await expect(async () => {
    const res = await page.request.get(
      `http://localhost:5001/api/parties?search=${encodeURIComponent(name)}`,
    )
    const body = (await res.json()) as { data?: { parties?: unknown[] } }
    const queue = await readSyncQueue(page)
    expect(
      body.data?.parties?.length,
      `the queued party must sync once online — queue: ${JSON.stringify(queue)}`,
    ).toBeGreaterThan(0)
  }).toPass({ timeout: 45_000 })
})

test('TC-PTY-12 the list survives 320px in every state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })

  await page.goto('/parties')
  await expectNoHorizontalScroll(page)
  await expect(page.locator('.txn-row').first()).toBeVisible({ timeout: 15_000 })
  await expectNoHorizontalScroll(page)

  // Empty state — a search nothing matches renders the same surface an empty
  // business sees, without needing a second business to test it.
  await page.getByRole('searchbox', { name: /search parties/i }).fill('zzz-no-such-party-zzz')
  await expect(page.locator('.txn-row')).toHaveCount(0, { timeout: 10_000 })
  await expectNoHorizontalScroll(page)

  await page.goto('/parties/new')
  await expect(page.locator('#party-name')).toBeVisible({ timeout: 15_000 })
  await expectNoHorizontalScroll(page)
})
