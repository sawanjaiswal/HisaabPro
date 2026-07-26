/**
 * Suite O — Offline & sync.
 * Plan: docs/E2E_TEST_PLAN.md §16. Cases TC-OFF-01..08.
 *
 * A shopkeeper on 2G in a basement market is the design centre of this app, so
 * every case here drives the real form with the real network switched off and
 * then reads back what Dexie actually holds — not what the UI claims.
 */

import { test, expect, loginViaUi, csrfPost, csrfRequest } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { API, apiCreateParty, uniqueName, fillPartyBasics } from './support/parties'
import {
  OFFLINE_BANNER,
  createPartyOffline,
  expectQueueDrains,
  goOffline,
  goOnline,
  readApiCacheKeys,
  readQueueLabels,
  returnToPartyList,
  warmPartyForm,
} from './support/offline'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test.afterEach(async ({ page }) => {
  // A case that fails mid-outage would otherwise hand the next one a context
  // that is still offline, turning one failure into eight.
  await page.context().setOffline(false)
})

test('TC-OFF-01 losing the connection tells the user within five seconds', async ({ page }) => {
  await page.goto('/parties')
  await expect(page.locator(OFFLINE_BANNER)).toBeHidden()

  await page.context().setOffline(true)
  const banner = page.locator(OFFLINE_BANNER)
  await expect(banner).toBeVisible({ timeout: 5_000 })
  // Announced, not merely painted — the shopkeeper may be using TalkBack.
  await expect(banner).toHaveAttribute('role', 'status')
  await expect(banner).toContainText(/offline/i)

  await goOnline(page)
})

test('TC-OFF-02 a queued save is described by its own name, not "Offline change"', async ({ page }) => {
  await warmPartyForm(page)
  await goOffline(page)

  const name = uniqueName('Offline Kirana')
  await createPartyOffline(page, name)

  await expect
    .poll(async () => (await readQueueLabels(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0)

  const queued = await readQueueLabels(page)
  const item = queued.find((i) => i.path === '/parties')
  expect(item, `no queued POST /parties — queue held ${JSON.stringify(queued)}`).toBeTruthy()
  expect(item!.entityType).toBe('party')
  expect(
    item!.entityLabel,
    'the sync queue must name the change so the user can recognise it',
  ).toBe(name)

  // And the drawer shows that label rather than the generic fallback.
  await page.locator('.sync-icon-btn').first().click()
  await expect(page.locator('.sync-drawer-item-label', { hasText: name })).toBeVisible({
    timeout: 10_000,
  })
})

test('TC-OFF-03 reconnecting drains the queue and every queued change lands', async ({ page }) => {
  await warmPartyForm(page)
  await goOffline(page)

  const first = uniqueName('Queue One')
  const second = uniqueName('Queue Two')
  await createPartyOffline(page, first)
  await returnToPartyList(page)
  await createPartyOffline(page, second)

  await expect.poll(async () => (await readQueueLabels(page)).length, { timeout: 15_000 }).toBe(2)

  await goOnline(page)
  await expectQueueDrains(page)

  for (const name of [first, second]) {
    const res = await page.request.get(`${API}/parties?search=${encodeURIComponent(name)}`)
    const body = (await res.json()) as { data?: { parties?: Array<{ name: string }> } }
    const found = body.data?.parties ?? []
    expect(found.map((p) => p.name), `${name} never reached the server`).toContain(name)
  }
})

test('TC-OFF-04 a stale edit is refused deterministically and offered to the user', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Conflict Party'), type: 'CUSTOMER' })

  // A new row is version 0, so "version 0" is not stale — someone else has to
  // save first. This edit is that someone.
  await csrfRequest(page, 'put', `${API}/parties/${party.id}`, { name: `${party.name} (theirs)` })

  // Server-level: the version guard answers CONFLICT with the version to retry
  // against — an error the client can act on, not a generic 500.
  const stale = await csrfRequest(page, 'put', `${API}/parties/${party.id}`, { name: 'Stale write' }, {
    headers: { 'x-entity-version': '0' },
  })
  expect(stale.status()).toBe(409)
  const body = (await stale.json()) as {
    error?: { code?: string; details?: { serverVersion?: number } }
  }
  expect(body.error?.code).toBe('CONFLICT')
  expect(typeof body.error?.details?.serverVersion).toBe('number')

  // User-level: the same race through the form opens the reconcile dialog
  // instead of a "something went wrong" toast. Money records never auto-merge.
  await page.goto(`/parties/${party.id}/edit`)
  await expect(page.locator('#party-name')).toHaveValue(/Conflict Party/, { timeout: 15_000 })

  await csrfRequest(page, 'put', `${API}/parties/${party.id}`, { name: `${party.name} (theirs again)` })

  await fillPartyBasics(page, { name: `${party.name} (mine)` })
  await page.getByRole('button', { name: /update party/i }).first().click()

  await expect(page.getByText(/someone got here first/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /reload latest/i })).toBeVisible()
})

test('TC-OFF-05 a queued change survives closing the app', async ({ page }) => {
  await warmPartyForm(page)
  await goOffline(page)

  const name = uniqueName('Survives Restart')
  await createPartyOffline(page, name)
  await expect.poll(async () => (await readQueueLabels(page)).length, { timeout: 15_000 }).toBe(1)

  // Reloading needs the dev server reachable, so the network comes back — but
  // the API stays unreachable, which is the honest shape of "app restarted,
  // still no signal". The claim is that the change is still in hand, whatever
  // status the restarted drain has moved it to.
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'))
  await page.context().setOffline(false)
  await page.reload()

  const after = await readQueueLabels(page)
  expect(after.map((i) => i.entityLabel), 'the queued party was lost on restart').toContain(name)
  await page.unroute('**/api/**')
})

test('TC-OFF-06 a replayed save with the same idempotency key creates one party', async ({ page }) => {
  const name = uniqueName('Idempotent Party')
  const key = crypto.randomUUID()
  const payload = { name, type: 'CUSTOMER' }

  const first = await csrfPost(page, `${API}/parties`, payload, {
    headers: { 'X-Idempotency-Key': key },
  })
  expect(first.ok(), `first create failed: ${await first.text()}`).toBe(true)

  // What the drain does after a reconnect it could not confirm: send it again.
  const second = await csrfPost(page, `${API}/parties`, payload, {
    headers: { 'X-Idempotency-Key': key },
  })
  expect(second.ok(), `replay failed: ${await second.text()}`).toBe(true)

  const res = await page.request.get(`${API}/parties?search=${encodeURIComponent(name)}`)
  const body = (await res.json()) as { data?: { parties?: unknown[] } }
  expect(body.data?.parties ?? [], 'the replay created a duplicate party').toHaveLength(1)
})

test('TC-OFF-07 saving offline reads as saved, not as a failure', async ({ page, consoleErrors }) => {
  await warmPartyForm(page)
  await goOffline(page)

  const name = uniqueName('Optimistic Party')
  await createPartyOffline(page, name)

  // api() resolves `{}` for a queued mutation. A handler that dereferences the
  // response (`created.id`) throws, and the form's catch turns a change that IS
  // safely queued into "Failed to save party" — the one message guaranteed to
  // make a shopkeeper type it all again. See OFFLINE_RULES.md rule 5.
  await expect(page.getByText(/failed to save party/i)).toHaveCount(0)
  await expect(page.getByText(new RegExp(`${name}.*added`, 'i'))).toBeVisible({ timeout: 10_000 })
  await page.waitForURL('**/parties', { timeout: 10_000 })

  expect(
    consoleErrors.filter((e) => !/Failed to (load|fetch)|net::ERR|ERR_INTERNET/i.test(e)),
    'an offline save must not throw',
  ).toEqual([])
})

test('TC-OFF-08 the read cache never holds identity, and logout empties it', async ({ page }) => {
  await page.goto('/dashboard')
  await page.goto('/parties')
  await page.waitForTimeout(1_000)

  const keys = await readApiCacheKeys(page)
  const identity = keys.filter((k) => /^\/(auth\/|me\b|csrf)/.test(k))
  expect(identity, 'credentials and identity must never be persisted to IndexedDB').toEqual([])

  // Through the menu, not the endpoint: clearApiCache() is part of the client's
  // logout (src/lib/auth.ts:28), so a bare API call would leave the cache the
  // next user on this phone can read and prove nothing.
  await page.getByRole('button', { name: /more|menu/i }).first().click()
  await page.locator('.side-nav-item--logout').click()
  await page.getByRole('button', { name: /log ?out|sign ?out/i }).last().click()
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 })

  await expect
    .poll(async () => (await readApiCacheKeys(page)).length, { timeout: 10_000 })
    .toBe(0)
})
