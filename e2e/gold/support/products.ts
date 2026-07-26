/**
 * Product helpers for the gold suites (plan §10, Suite I).
 *
 * Same rule as the party helpers: creating a product through the form is under
 * test in TC-PRD-01, so every other case arranges its subject over the API.
 */

import type { Page } from '@playwright/test'
import { csrfPost } from './fixtures'
import { API } from './parties'

export { API }

/** Product names must not collide across runs — the DB is never reset. */
export function uniqueProductName(prefix = 'E2E Product'): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
}

/** A barcode no other run owns, inside the 128-char server limit. */
export function uniqueBarcode(): string {
  return `890${String(Date.now()).slice(-7)}${Math.floor(10 + Math.random() * 89)}`
}

export interface CreatedProduct {
  id: string
  name: string
  sku?: string
  currentStock?: number
}

/**
 * The business's default unit id. `unitId` is required by createProductSchema,
 * and units are seeded per business — hardcoding one would pass on the seeded
 * tenant and fail on any other.
 */
export async function apiFirstUnitId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/units`)
  const body = (await res.json()) as { data?: Array<{ id: string }> | { units?: Array<{ id: string }> } }
  const list = Array.isArray(body.data) ? body.data : (body.data?.units ?? [])
  if (!list[0]?.id) throw new Error(`no units for this business: ${JSON.stringify(body)}`)
  return list[0].id
}

/** Creates a product over the API using the logged-in page's own session. */
export async function apiCreateProduct(
  page: Page,
  body: Record<string, unknown> = {},
): Promise<CreatedProduct> {
  const unitId = (body.unitId as string) ?? (await apiFirstUnitId(page))
  const res = await csrfPost(page, `${API}/products`, {
    name: uniqueProductName(),
    salePrice: 10000,
    unitId,
    ...body,
  })
  if (!res.ok()) throw new Error(`create product failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: { product?: CreatedProduct } }
  const product = envelope.data?.product
  if (!product?.id) throw new Error(`create product returned no id: ${JSON.stringify(envelope)}`)
  return product
}

/** How many products the business actually has — read from the API, not the DOM. */
export async function apiProductTotal(page: Page): Promise<number> {
  const res = await page.request.get(`${API}/products?limit=1`)
  const body = (await res.json()) as { data?: { pagination?: { total?: number } } }
  return body.data?.pagination?.total ?? 0
}

/** Current stock as the server holds it — the only trustworthy value in a stock case. */
export async function apiProductStock(page: Page, id: string): Promise<number> {
  const res = await page.request.get(`${API}/products/${id}`)
  const body = (await res.json()) as { data?: { product?: { currentStock?: number } } }
  return Number(body.data?.product?.currentStock ?? 0)
}

/**
 * Moves the create-product wizard to a later section. The Save CTA only exists
 * on the last one — the earlier sections show Next — so a spec that filled the
 * basics and looked for Save would time out on a button that is not rendered yet.
 */
export async function gotoProductSection(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('tab', { name: label }).click()
}
