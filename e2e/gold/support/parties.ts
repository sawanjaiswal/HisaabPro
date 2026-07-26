/**
 * Party helpers for the gold suites.
 *
 * Creating a party through the form is itself under test (TC-PTY-01), so every
 * *other* case arranges its subject over the API instead — driving the form
 * twelve times would test the same code path twelve times and make each spec's
 * failure ambiguous between "search is broken" and "creation is broken".
 */

import type { Page } from '@playwright/test'
import { csrfPost } from './fixtures'

export const API = 'http://localhost:5001/api'

/**
 * Party names must not collide across runs: the DB is shared and never reset
 * between suites, so a fixed name would make run 2 assert against run 1's row
 * (and TC-PTY-03's duplicate-phone case would fire on the wrong record).
 */
export function uniqueName(prefix = 'E2E Party'): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
}

/** A 10-digit Indian mobile that passes PHONE_REGEX and no seed row owns. */
export function uniquePartyPhone(): string {
  return `7${String(Date.now()).slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 10)
}

export interface CreatedParty {
  id: string
  name: string
}

/** Creates a party over the API using the logged-in page's own session. */
export async function apiCreateParty(
  page: Page,
  body: Record<string, unknown>,
): Promise<CreatedParty> {
  const res = await csrfPost(page, `${API}/parties`, { type: 'CUSTOMER', ...body })
  if (!res.ok()) throw new Error(`create party failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: { party?: CreatedParty } }
  // The route answers { success, data: { party } } — note the nesting, which the
  // list route does not use. A shape change should fail loudly here rather than
  // as an undefined id three assertions later.
  const party = envelope.data?.party
  if (!party?.id) throw new Error(`create party returned no id: ${JSON.stringify(envelope)}`)
  return party
}

/**
 * Expands one of the party form's collapsed blocks (Business / Credit / Custom
 * fields). Only the identity fields are visible on load — opening balance and
 * GSTIN live behind an Accordion, so a spec that fills them without this step
 * times out on a field that exists in the DOM only after the trigger is hit.
 */
export async function openPartySection(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('button', { name: label }).first().click()
}

/** Fills the Create Party form's basic section. Shared by create and edit cases. */
export async function fillPartyBasics(
  page: Page,
  fields: { name?: string; phone?: string; email?: string; company?: string },
): Promise<void> {
  if (fields.name !== undefined) await page.locator('#party-name').fill(fields.name)
  if (fields.phone !== undefined) await page.locator('#party-phone').fill(fields.phone)
  if (fields.email !== undefined) await page.locator('#party-email').fill(fields.email)
  if (fields.company !== undefined) await page.locator('#party-company').fill(fields.company)
}
