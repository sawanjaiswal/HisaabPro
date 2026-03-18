/**
 * Products — E2E Tests
 *
 * Covers: list page, empty state, FAB, product detail, create product form,
 * and responsive checks.
 * All tests use the authedPage fixture from ./fixtures.ts for authenticated state.
 */

import { test, expect, mockApiGet } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRODUCTS_RESPONSE = {
  products: [
    {
      id: 'prod_1',
      name: 'Cement 50kg',
      sku: 'CEM-001',
      category: { id: 'cat_1', name: 'Building Materials' },
      unit: { id: 'unit_1', name: 'Bag', symbol: 'bag' },
      salePrice: 35000,
      purchasePrice: 30000,
      currentStock: 100,
      minStockLevel: 10,
      status: 'ACTIVE',
      createdAt: '2026-03-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  summary: {
    totalProducts: 1,
    lowStockCount: 0,
    totalStockValue: 3000000,
  },
}

const MOCK_EMPTY_PRODUCTS = {
  products: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  summary: {
    totalProducts: 0,
    lowStockCount: 0,
    totalStockValue: 0,
  },
}

const MOCK_PRODUCT_DETAIL = {
  id: 'prod_1',
  name: 'Cement 50kg',
  sku: 'CEM-001',
  category: { id: 'cat_1', name: 'Building Materials' },
  unit: { id: 'unit_1', name: 'Bag', symbol: 'bag' },
  salePrice: 35000,
  purchasePrice: 30000,
  currentStock: 100,
  minStockLevel: 10,
  status: 'ACTIVE',
  description: null,
  hsnCode: null,
  sacCode: null,
  stockValidation: 'GLOBAL',
  customFields: [],
  recentMovements: [],
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
}

const MOCK_CATEGORIES: unknown[] = []
const MOCK_UNITS: unknown[] = []

// ─── 1. List Page (/products) ──────────────────────────────────────────────

test.describe('Products List Page', () => {
  test('renders product list with mocked data', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS_RESPONSE)
    await page.goto('/products')
    await page.waitForLoadState('domcontentloaded')

    // Product name visible
    await expect(page.getByText('Cement 50kg')).toBeVisible()

    // Product list container exists
    const list = page.locator('[role="list"][aria-label="Products"]')
    await expect(list).toBeVisible()

    // Correct number of list items
    const items = list.locator('[role="listitem"]')
    await expect(items).toHaveCount(1)
  })

  test('shows empty state when no products exist', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_EMPTY_PRODUCTS)
    await page.goto('/products')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('No products yet')).toBeVisible()
    await expect(page.getByText('Add your first product to start managing inventory')).toBeVisible()

    // Empty state has an Add Product CTA (use exact aria-label to avoid matching FAB)
    const addBtn = page.getByRole('button', { name: 'Add first product' })
    await expect(addBtn).toBeVisible()
  })

  test('Add Product FAB is visible', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS_RESPONSE)
    await page.goto('/products')
    await page.waitForLoadState('domcontentloaded')

    const fab = page.getByRole('button', { name: /add new product/i })
    await expect(fab).toBeVisible()
  })
})

// ─── 2. Product Detail (/products/:id) ────────────────────────────────────

test.describe('Product Detail Page', () => {
  test('shows product name, category, and prices', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT_DETAIL)
    await page.goto('/products/prod_1')
    await page.waitForLoadState('domcontentloaded')

    // Product name (use heading to avoid matching the aria-live status announcement)
    await expect(page.getByRole('heading', { name: 'Cement 50kg' })).toBeVisible()

    // Category visible in overview tab (default)
    await expect(page.getByText('Building Materials')).toBeVisible()

    // Tab navigation exists
    const overviewTab = page.getByRole('tab', { name: 'Overview' })
    await expect(overviewTab).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Stock' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Info' })).toBeVisible()
  })
})

// ─── 3. Create Product (/products/new) ─────────────────────────────────────

test.describe('Create Product Page', () => {
  test('form renders with header and section tabs', async ({ authedPage: page }) => {
    await mockApiGet(page, 'categories**', MOCK_CATEGORIES)
    await mockApiGet(page, 'units**', MOCK_UNITS)
    await page.goto('/products/new')
    await page.waitForLoadState('domcontentloaded')

    // Header
    await expect(page.getByText('New Product')).toBeVisible()

    // Section tabs
    await expect(page.getByRole('tab', { name: 'Basic Info' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Stock' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Extra' })).toBeVisible()

    // Save button
    await expect(page.getByRole('button', { name: /save product$/i })).toBeVisible()
  })
})

// ─── 4. Responsive Checks ─────────────────────────────────────────────────

test.describe('Products — Responsive', () => {
  test('no horizontal scroll on 375px for list page', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApiGet(page, 'products**', MOCK_PRODUCTS_RESPONSE)
    await page.goto('/products')
    await page.waitForLoadState('domcontentloaded')

    // Wait for list to render
    await expect(page.getByText('Cement 50kg')).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
