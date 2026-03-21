/**
 * Shared Playwright fixtures — authenticated page, mock data, API helpers.
 *
 * Usage in tests:
 *   import { test, expect, MOCK_USER, MOCK_BUSINESS_ID } from './fixtures'
 *
 * The `test` exported here extends Playwright's `test` with an `authedPage`
 * fixture that pre-sets sessionStorage + mocks GET /auth/me so the app
 * believes the user is logged in. All API calls are intercepted by default
 * to prevent real network requests.
 */

import { test as base, expect, type Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

export const MOCK_BUSINESS_ID = 'biz_test_001'

export const MOCK_USER = {
  id: 'user_test_001',
  phone: '9876543210',
  name: 'Test User',
  email: 'test@hisaabpro.in',
  businessId: MOCK_BUSINESS_ID,
}

export const MOCK_AUTH_ME_RESPONSE = {
  success: true,
  data: {
    user: {
      id: MOCK_USER.id,
      phone: MOCK_USER.phone,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      businessUsers: [{ business: { id: MOCK_BUSINESS_ID } }],
    },
  },
}

// ─── API Mock Helpers ───────────────────────────────────────────────────────

/** Mock a GET endpoint to return { success: true, data: ... } */
export async function mockApiGet(page: Page, urlPattern: string, data: unknown) {
  await page.route(`**/api/${urlPattern}`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      })
    } else {
      route.continue()
    }
  })
}

/** Mock a POST endpoint to return { success: true, data: ... } */
export async function mockApiPost(page: Page, urlPattern: string, data: unknown) {
  await page.route(`**/api/${urlPattern}`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      })
    } else {
      route.continue()
    }
  })
}

/** Mock any API call to return empty success */
export async function mockApiEmpty(page: Page, urlPattern: string) {
  await page.route(`**/api/${urlPattern}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
}

/** Mock any API call to return 500 error */
export async function mockApiError(page: Page, urlPattern: string) {
  await page.route(`**/api/${urlPattern}`, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } }),
    }),
  )
}

// ─── Auth Setup ─────────────────────────────────────────────────────────────

/**
 * Set up authenticated state:
 * 1. Inject cached user into sessionStorage
 * 2. Mock GET /auth/me to confirm the session
 * 3. Mock CSRF token endpoint
 */
export async function setupAuth(page: Page) {
  // Mock auth verification
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_AUTH_ME_RESPONSE),
    }),
  )

  // Mock CSRF token
  await page.route('**/api/csrf-token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { csrfToken: 'test-csrf-token' } }),
    }),
  )

  // Navigate to a blank page first to set sessionStorage in the app's origin
  await page.goto('/login')
  await page.evaluate((user) => {
    sessionStorage.setItem('cachedUser', JSON.stringify(user))
  }, MOCK_USER)
}

// ─── Extended Test Fixture ──────────────────────────────────────────────────

/**
 * Extended test that provides `authedPage` — a page pre-authenticated
 * with MOCK_USER. Use this for all tests that need a logged-in state.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await setupAuth(page)
    await use(page)
  },
})

export { expect }

// ─── Phase 4 Mock Data ──────────────────────────────────────────────────────

export const MOCK_PRODUCTS = [
  { id: 'prod_001', name: 'Tata Salt 1kg', sku: 'SALT-001', salePrice: 2800, purchasePrice: 2200, unit: 'PCS', stock: 500, lowStockAlert: 50 },
  { id: 'prod_002', name: 'Amul Butter 500g', sku: 'BTR-001', salePrice: 28000, purchasePrice: 24000, unit: 'PCS', stock: 100, lowStockAlert: 20 },
  { id: 'prod_003', name: 'Samsung Galaxy A15', sku: 'SAM-A15', salePrice: 1399900, purchasePrice: 1200000, unit: 'PCS', stock: 10, lowStockAlert: 3 },
  { id: 'prod_004', name: 'Parle-G Biscuit', sku: 'PLG-001', salePrice: 1000, purchasePrice: 800, unit: 'PKT', stock: 1000, lowStockAlert: 100 },
  { id: 'prod_005', name: 'Notebook A4 100pg', sku: 'NB-001', salePrice: 5000, purchasePrice: 3500, unit: 'PCS', stock: 200, lowStockAlert: 30 },
]

export const MOCK_GODOWNS = [
  { id: 'gdn_001', name: 'Main Warehouse', address: 'Industrial Area, Pune 411001', isDefault: true, stockValue: 1250000 },
  { id: 'gdn_002', name: 'Shop Floor', address: 'MG Road, Pune 411005', isDefault: false, stockValue: 350000 },
]

export const MOCK_BATCHES = [
  { id: 'bat_001', productId: 'prod_001', batchNumber: 'SALT-2026-A', manufacturingDate: '2026-01-15', expiryDate: '2027-01-15', costPrice: 2200, salePrice: 2800, quantity: 200 },
  { id: 'bat_002', productId: 'prod_001', batchNumber: 'SALT-2026-B', manufacturingDate: '2026-02-01', expiryDate: '2027-02-01', costPrice: 2200, salePrice: 2800, quantity: 150 },
  { id: 'bat_003', productId: 'prod_002', batchNumber: 'BTR-MAR26', manufacturingDate: '2026-03-01', expiryDate: '2026-09-01', costPrice: 24000, salePrice: 28000, quantity: 50 },
]

export const MOCK_SERIALS = [
  { id: 'ser_001', productId: 'prod_003', serialNumber: 'IMEI-001-TEST', status: 'AVAILABLE' },
  { id: 'ser_002', productId: 'prod_003', serialNumber: 'IMEI-002-TEST', status: 'AVAILABLE' },
  { id: 'ser_003', productId: 'prod_003', serialNumber: 'IMEI-003-TEST', status: 'SOLD' },
  { id: 'ser_004', productId: 'prod_003', serialNumber: 'IMEI-004-TEST', status: 'RETURNED' },
  { id: 'ser_005', productId: 'prod_003', serialNumber: 'IMEI-005-TEST', status: 'DAMAGED' },
]

export const MOCK_VERIFICATION = {
  id: 'ver_001',
  name: 'Monthly Count March 2026',
  status: 'IN_PROGRESS',
  type: 'FULL',
  createdAt: '2026-03-20T10:00:00Z',
  items: [
    { productId: 'prod_001', productName: 'Tata Salt 1kg', expectedQty: 500, countedQty: 498, discrepancy: -2 },
    { productId: 'prod_002', productName: 'Amul Butter 500g', expectedQty: 100, countedQty: 100, discrepancy: 0 },
    { productId: 'prod_004', productName: 'Parle-G Biscuit', expectedQty: 1000, countedQty: null, discrepancy: null },
  ],
  progress: { total: 5, counted: 2, percentage: 40 },
}

export const MOCK_POS_CART = [
  { productId: 'prod_001', name: 'Tata Salt 1kg', quantity: 2, price: 2800, total: 5600 },
  { productId: 'prod_004', name: 'Parle-G Biscuit', quantity: 5, price: 1000, total: 5000 },
]

export const MOCK_QUICK_SALE_RESULT = {
  invoiceId: 'inv_pos_001',
  invoiceNumber: 'POS-2026-0001',
  items: MOCK_POS_CART,
  subtotal: 10600,
  total: 10600,
  paymentMethod: 'CASH',
  paidAmount: 10600,
  change: 0,
  createdAt: '2026-03-20T14:30:00Z',
}
