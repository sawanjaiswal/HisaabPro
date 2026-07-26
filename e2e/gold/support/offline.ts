/**
 * Offline helpers for Suite O.
 *
 * Connectivity is simulated with `context.setOffline()` rather than
 * `page.route(..., abort)`: the app decides it is offline from the browser's
 * own `offline` event (src/hooks/useOnlineStatus.ts), and route-aborting leaves
 * `navigator.onLine` true — the auto-sync watcher would then keep draining into
 * a dead network and dead-letter every queued item, which is a different test.
 */

import { expect, type Page } from '@playwright/test'
import { fillPartyBasics } from './parties'

/** The banner is the user's only signal that saves are now local. */
export const OFFLINE_BANNER = '.offline-banner'

export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true)
  await expect(page.locator(OFFLINE_BANNER)).toBeVisible({ timeout: 5_000 })
}

export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false)
  await expect(page.locator(OFFLINE_BANNER)).toBeHidden({ timeout: 10_000 })
}

/**
 * Loads /parties with the create form's route chunk already fetched, so the
 * outage that follows can still reach the form.
 *
 * `page.goto()` is a document request — it fails outright once the context is
 * offline, and a lazily-imported route would fail the same way on first visit.
 * A user who is about to lose signal has, by definition, already loaded the app;
 * warming the chunk reproduces that rather than testing Vite's loader.
 */
export async function warmPartyForm(page: Page): Promise<void> {
  await page.goto('/parties')
  const fab = page.getByRole('button', { name: /add new party/i }).first()
  await expect(fab).toBeVisible({ timeout: 20_000 })

  // Both routes must be resolved inside THIS document: a module registry does
  // not survive a reload, so warming the form on a previous page load leaves
  // the click after the outage waiting on a fetch that can never answer.
  await fab.click()
  await expect(page.locator('#party-name')).toBeVisible({ timeout: 20_000 })
  await page.goBack()
  await expect(fab).toBeVisible({ timeout: 20_000 })
}

/**
 * Drives the real Create Party form while the network is down, navigating the
 * way the app does — client-side, from the list's FAB.
 *
 * Deliberately does NOT wait for navigation afterwards: whether a queued save
 * still hands the shopkeeper back to the list is exactly what TC-OFF-07 asks,
 * so asserting it here would make every other case fail for that one reason.
 */
export async function createPartyOffline(page: Page, name: string): Promise<void> {
  if (!page.url().includes('/parties/new')) {
    await page.getByRole('button', { name: /add new party/i }).first().click()
    await expect(page.locator('#party-name')).toBeVisible({ timeout: 15_000 })
  }
  await fillPartyBasics(page, { name })
  await page.getByRole('button', { name: /save party/i }).first().click()
}

/** Back to the list without a document request — the form may or may not have
 *  navigated on its own, which is TC-OFF-07's question, not this helper's. */
export async function returnToPartyList(page: Page): Promise<void> {
  if (page.url().includes('/parties/new')) await page.goBack()
  await expect(page.getByRole('button', { name: /add new party/i }).first()).toBeVisible({
    timeout: 15_000,
  })
}

export interface QueuedItem {
  path: string
  status: string
  entityType: string | null
  entityLabel: string | null
}

/**
 * The queue as Dexie holds it, including the labels `readSyncQueue` omits —
 * "Offline change" versus the party's own name is the whole of TC-OFF-02.
 */
export async function readQueueLabels(page: Page): Promise<QueuedItem[]> {
  return page.evaluate(async () => {
    return new Promise<QueuedItem[]>((resolve) => {
      const req = indexedDB.open('hisaabpro-sync')
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
              entityType: (i.entityType as string | null) ?? null,
              entityLabel: (i.entityLabel as string | null) ?? null,
            })),
          )
      }
    })
  }) as Promise<QueuedItem[]>
}

/** Keys held in the opt-in GET cache (src/lib/api-cache.ts). */
export async function readApiCacheKeys(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    return new Promise<string[]>((resolve) => {
      const req = indexedDB.open('hisaabpro-api-cache')
      req.onerror = () => resolve([])
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('cache')) return resolve([])
        const all = db.transaction('cache', 'readonly').objectStore('cache').getAllKeys()
        all.onerror = () => resolve([])
        all.onsuccess = () => resolve(all.result.map(String))
      }
    })
  }) as Promise<string[]>
}

/** Waits for the queue to hold nothing that still needs sending. */
export async function expectQueueDrains(page: Page, timeout = 30_000): Promise<void> {
  await expect
    .poll(async () => (await readQueueLabels(page)).filter((i) => i.status !== 'dead').length, {
      timeout,
      message: 'the offline queue never drained after reconnecting',
    })
    .toBe(0)
}
