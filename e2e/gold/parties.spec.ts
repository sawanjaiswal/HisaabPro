/**
 * Suite H — Parties, part 1: create, validate, edit, delete.
 * Plan: docs/E2E_TEST_PLAN.md §9. Cases TC-PTY-01..05.
 *
 * Real server, real Postgres, no page.route. The session is the seeded owner
 * (npm run e2e:seed) because a freshly registered user has no business yet and
 * would land in onboarding rather than on /parties.
 */

import { test, expect, loginViaUi, trackFailedRequests } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import {
  apiCreateParty,
  fillPartyBasics,
  openPartySection,
  uniqueName,
  uniquePartyPhone,
} from './support/parties'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test('TC-PTY-01 a customer created through the form appears in the list', async ({ page }) => {
  const failures = trackFailedRequests(page)
  const name = uniqueName('Raju Kirana')
  const phone = uniquePartyPhone()

  await page.goto('/parties/new')
  await fillPartyBasics(page, { name, phone })
  // Opening balance is rupees in the form and paise on the wire — the round
  // trip is the actual risk here, so assert the rendered rupee value later
  // rather than trusting the field we just typed into.
  await openPartySection(page, /^credit$/i)
  await page.locator('#opening-balance-amount').fill('1500')
  await page.getByRole('button', { name: /save party/i }).first().click()

  await page.waitForURL('**/parties', { timeout: 15_000 })
  // Search for it rather than expecting it on page 1: the list is name-sorted
  // and paged, so on a business with more than a page of parties "did it save?"
  // and "is it the first row?" are different questions. The first is the claim.
  await page.getByPlaceholder(/search/i).first().fill(name)
  const row = page.locator('.txn-row', { hasText: name }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  expect(failures.get(), 'creating a party must not produce an API failure').toEqual([])

  // Opening balance survives the rupee→paise→rupee conversion.
  // The row, not the text node — the click handler lives on the card.
  await row.click()
  await page.waitForURL(/\/parties\/[^/]+$/)
  await expect(page.locator('body')).toContainText(/1,?500/)
})

test('TC-PTY-02 a supplier keeps its type and shows under the supplier filter', async ({ page }) => {
  const name = uniqueName('Verma Wholesale')

  await page.goto('/parties/new')
  await fillPartyBasics(page, { name })
  await page.getByRole('button', { name: /set party type to supplier/i }).click()
  await page.getByRole('button', { name: /save party/i }).first().click()
  await page.waitForURL('**/parties', { timeout: 15_000 })

  // The type chips filter server-side (`?type=SUPPLIER`), so this proves the
  // stored type, not just what the form rendered.
  await page.locator('.type-chip', { hasText: /supplier/i }).first().click()
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 10_000 })

  await page.locator('.type-chip', { hasText: /customer/i }).first().click()
  await expect(page.getByText(name, { exact: false })).toHaveCount(0)
})

test('TC-PTY-03 the form blocks a blank name and a malformed phone', async ({ page }) => {
  await page.goto('/parties/new')

  // Blank name: the CTA is always enabled, so the guard has to be validation.
  await page.getByRole('button', { name: /save party/i }).first().click()
  await expect(page.getByText(/name is required/i)).toBeVisible()
  expect(page.url(), 'a rejected save must not navigate').toContain('/parties/new')

  await fillPartyBasics(page, { name: 'A' })
  await page.getByRole('button', { name: /save party/i }).first().click()
  await expect(page.getByText(/at least 2 characters/i)).toBeVisible()

  await fillPartyBasics(page, { name: uniqueName(), phone: '12345' })
  await page.getByRole('button', { name: /save party/i }).first().click()
  await expect(page.getByText(/valid 10-digit/i)).toBeVisible()

  await fillPartyBasics(page, { phone: uniquePartyPhone(), email: 'not-an-email' })
  await page.getByRole('button', { name: /save party/i }).first().click()
  await expect(page.getByText(/valid email/i)).toBeVisible()
})

test('TC-PTY-04 an edit persists across a reload', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Edit Me'), phone: uniquePartyPhone() })
  const renamed = uniqueName('Renamed')

  await page.goto(`/parties/${party.id}/edit`)
  await expect(page.locator('#party-name')).toHaveValue(party.name, { timeout: 15_000 })
  await page.locator('#party-name').fill(renamed)
  await page.getByRole('button', { name: /save|update/i }).first().click()

  await page.waitForURL(`**/parties/${party.id}`, { timeout: 15_000 })
  // Reload rather than trusting the optimistic cache write — the bug class
  // this case exists for is "the UI updated but the PATCH never landed".
  await page.reload()
  await expect(page.locator('.pdh-name')).toHaveText(renamed, { timeout: 15_000 })
})

test('TC-PTY-05 delete asks for confirmation in a dialog, never window.confirm', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Delete Me') })

  // If any code path still calls window.confirm, Playwright auto-dismisses it
  // and the delete silently no-ops — so fail loudly instead of dismissing.
  page.on('dialog', async (d) => {
    throw new Error(`native ${d.type()} used instead of <ConfirmDialog>: ${d.message()}`)
  })

  await page.goto(`/parties/${party.id}`)
  await page.getByRole('button', { name: /more actions/i }).click()
  await page.getByRole('menuitem', { name: /delete/i }).click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog, 'the confirm text must say what is lost, not "are you sure"').not.toHaveText(
    /^\s*Are you sure\?\s*$/i,
  )

  await dialog.getByRole('button', { name: /delete/i }).click()
  await page.waitForURL('**/parties', { timeout: 15_000 })
  await expect(page.getByText(party.name, { exact: false })).toHaveCount(0)
})
