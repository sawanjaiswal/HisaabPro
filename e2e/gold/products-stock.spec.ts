/**
 * Suite I — Products, part 2: stock adjustment + movement ledger, low-stock
 * alerting, barcode lookup, search and pagination, list summary.
 * Plan: docs/E2E_TEST_PLAN.md §10. Cases TC-PRD-06,07,09,10,11.
 *
 * TC-PRD-08 (stock falls when an invoice is raised) belongs to the invoices
 * suite — it needs an invoice, and asserting it here would test two features
 * and blame the wrong one when it breaks.
 */

import { test, expect, loginViaUi, csrfPost } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import {
  API,
  apiCreateProduct,
  apiProductStock,
  uniqueBarcode,
  uniqueProductName,
} from './support/products'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test('TC-PRD-06 a stock adjustment changes the stock and is recorded as a movement', async ({
  page,
}) => {
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Adjustable'),
    openingStock: 10,
  })

  await page.goto(`/products/${product.id}`)
  await page.getByRole('button', { name: /adjust stock/i }).first().click()
  await expect(page.locator('#adjust-quantity')).toBeVisible({ timeout: 15_000 })
  await page.locator('#adjust-quantity').fill('15')
  await page.getByRole('button', { name: /add stock|confirm/i }).last().click()

  await expect(async () => {
    expect(await apiProductStock(page, product.id), '10 + 15 must be 25 on the server').toBe(25)
  }).toPass({ timeout: 20_000 })

  // The ledger is the part a shop owner argues with a supplier over: a stock
  // number that changed with no movement behind it is unauditable.
  const res = await page.request.get(`${API}/products/${product.id}/stock/movements`)
  const body = (await res.json()) as {
    data?: { movements?: Array<{ type?: string; quantity?: number }> }
  }
  const movements = body.data?.movements ?? []
  expect(
    movements.some((m) => m.type === 'ADJUSTMENT_IN' && Number(m.quantity) === 15),
    'the adjustment must appear in the movement ledger',
  ).toBe(true)
})

test('TC-PRD-07 a product below its minimum shows up as low stock', async ({ page }) => {
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('LowStock'),
    openingStock: 2,
    minStockLevel: 10,
  })

  const res = await page.request.get(`${API}/products?lowStockOnly=true&limit=100`)
  const body = (await res.json()) as {
    data?: { products?: Array<{ id: string }>; summary?: { lowStockCount?: number } }
  }
  expect(
    (body.data?.products ?? []).map((p) => p.id),
    'stock 2 against a minimum of 10 is low stock',
  ).toContain(product.id)
  expect(Number(body.data?.summary?.lowStockCount ?? 0)).toBeGreaterThan(0)

  // The list page surfaces the same number — the tile is what the owner acts on.
  await page.goto('/products')
  await expect(page.locator('.product-row, .product-list-item').first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.locator('body')).toContainText(/low stock/i)
})

test('TC-PRD-09 a barcode round-trips and looks the product up', async ({ page }) => {
  const barcode = uniqueBarcode()
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Scanned'),
    barcode,
    barcodeFormat: 'EAN13',
  })

  const res = await page.request.get(`${API}/products/by-barcode/${barcode}`)
  expect(res.status(), 'a saved barcode must be findable by scan').toBe(200)
  const body = (await res.json()) as { data?: { product?: { id?: string } } }
  const found = body.data?.product ?? (body.data as { id?: string } | undefined)
  expect(found?.id, 'the scan must return the product that owns the barcode').toBe(product.id)

  const unknown = await page.request.get(`${API}/products/by-barcode/${uniqueBarcode()}`)
  expect(
    unknown.status(),
    'an unknown barcode must 404, not return someone else’s product',
  ).toBe(404)
})

test('TC-PRD-10 search narrows the list, and every product is reachable past page 1', async ({
  page,
}) => {
  const marker = `Pager${Date.now().toString(36)}`
  // 21 > the page size of 20: the 21st product is the one a single-page list
  // silently hides, and hiding inventory is how stock counts stop matching.
  const names = Array.from({ length: 21 }, (_, i) => `${marker} ${String(i).padStart(2, '0')}`)
  const unitId = await firstUnit(page)
  for (const name of names) {
    await csrfPost(page, `${API}/products`, { name, salePrice: 1000, unitId })
  }

  await page.goto(`/products?search=${encodeURIComponent(marker)}`)
  const search = page.getByPlaceholder(/search/i).first()
  await search.fill(marker)

  const rows = page.locator('.product-list-item')
  // Wait for the debounced search to land before counting: the unfiltered list
  // also shows twenty rows, so counting too early would count the wrong twenty
  // and then page the wrong list.
  await expect(rows.first()).toContainText(marker, { timeout: 20_000 })
  await expect(async () => {
    expect(await rows.count(), 'the search must narrow the list to the marked set').toBe(20)
  }).toPass({ timeout: 20_000 })

  const loadMore = page.getByRole('button', { name: /load more/i })
  await expect(loadMore, 'a list with a 21st product must offer a way to reach it').toBeVisible()
  await loadMore.click()

  await expect(async () => {
    expect(await rows.count(), 'loading more must add rows, not replace them').toBe(21)
  }).toPass({ timeout: 20_000 })
  await expect(page.locator('.product-list-item').last()).toContainText(marker)
})

test('TC-PRD-11 the list summary agrees with the rows it heads', async ({ page }) => {
  const res = await page.request.get(`${API}/products?limit=1`)
  const body = (await res.json()) as {
    data?: {
      pagination?: { total?: number }
      summary?: { totalProducts?: number; lowStockCount?: number; outOfStockCount?: number }
    }
  }
  const { pagination, summary } = body.data ?? {}
  // F17: these two disagreed for as long as the default list included deleted
  // products. They are the same set by definition — pin it.
  expect(
    Number(pagination?.total),
    'pagination.total and summary.totalProducts count the same products',
  ).toBe(Number(summary?.totalProducts))
  expect(Number(summary?.lowStockCount)).toBeLessThanOrEqual(Number(summary?.totalProducts))
  expect(Number(summary?.outOfStockCount)).toBeLessThanOrEqual(Number(summary?.totalProducts))
})

/** The business's first unit id — required by createProductSchema. */
async function firstUnit(page: import('@playwright/test').Page): Promise<string> {
  const res = await page.request.get(`${API}/units`)
  const body = (await res.json()) as {
    data?: Array<{ id: string }> | { units?: Array<{ id: string }> }
  }
  const list = Array.isArray(body.data) ? body.data : (body.data?.units ?? [])
  return list[0]!.id
}
