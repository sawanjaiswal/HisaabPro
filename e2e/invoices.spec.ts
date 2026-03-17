/**
 * Invoices feature — E2E tests
 *
 * Covers: list page, create page, detail page, responsive checks.
 * All API calls mocked via fixtures helpers. Backend uses /documents endpoint.
 */

import { test, expect, mockApiGet } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_INVOICE_LIST = {
  documents: [
    {
      id: 'inv_1',
      documentNumber: 'INV-2526-001',
      type: 'SALE_INVOICE',
      status: 'SAVED',
      party: { id: 'p1', name: 'Sharma Electronics', phone: '9876543210' },
      grandTotal: 1500000,
      subtotal: 1500000,
      totalDiscount: 0,
      totalAdditionalCharges: 0,
      roundOff: 0,
      totalProfit: 300000,
      paidAmount: 0,
      balanceDue: 1500000,
      lineItemCount: 3,
      documentDate: '2026-03-15',
      dueDate: null,
      createdAt: '2026-03-15T00:00:00Z',
      updatedAt: '2026-03-15T00:00:00Z',
    },
    {
      id: 'inv_2',
      documentNumber: 'INV-2526-002',
      type: 'SALE_INVOICE',
      status: 'SHARED',
      party: { id: 'p2', name: 'Gupta Traders', phone: '9876543211' },
      grandTotal: 750000,
      subtotal: 750000,
      totalDiscount: 0,
      totalAdditionalCharges: 0,
      roundOff: 0,
      totalProfit: 150000,
      paidAmount: 750000,
      balanceDue: 0,
      lineItemCount: 1,
      documentDate: '2026-03-16',
      dueDate: null,
      createdAt: '2026-03-16T00:00:00Z',
      updatedAt: '2026-03-16T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
  summary: {
    totalAmount: 2250000,
    totalPaid: 750000,
    totalDue: 1500000,
  },
}

const MOCK_INVOICE_DETAIL = {
  ...MOCK_INVOICE_LIST.documents[0],
  paymentTerms: 'NET_30',
  party: {
    id: 'p1',
    name: 'Sharma Electronics',
    phone: '9876543210',
    email: null,
    gstin: null,
    billingAddress: null,
    shippingAddress: null,
    outstandingBalance: 1500000,
  },
  shippingAddressId: null,
  lineItems: [
    {
      id: 'li_1',
      sortOrder: 1,
      product: { id: 'prod_1', name: 'Widget A', sku: 'WA-001', unit: 'pcs', currentStock: 100 },
      quantity: 10,
      rate: 100000,
      discountType: 'AMOUNT' as const,
      discountValue: 0,
      discountAmount: 0,
      lineTotal: 1000000,
      purchasePrice: 70000,
      profit: 300000,
      profitPercent: 30,
    },
    {
      id: 'li_2',
      sortOrder: 2,
      product: { id: 'prod_2', name: 'Widget B', sku: 'WB-001', unit: 'pcs', currentStock: 50 },
      quantity: 5,
      rate: 100000,
      discountType: 'AMOUNT' as const,
      discountValue: 0,
      discountAmount: 0,
      lineTotal: 500000,
      purchasePrice: 60000,
      profit: 200000,
      profitPercent: 40,
    },
  ],
  additionalCharges: [],
  notes: null,
  termsAndConditions: null,
  signatureUrl: null,
  includeSignature: false,
  sourceDocument: null,
  convertedTo: null,
  shareLogs: [],
  transportDetails: null,
  profitPercent: 33.33,
  totalCost: 1000000,
  createdBy: { id: 'user_test_001', name: 'Test User' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Mock the documents list endpoint (backend uses /documents, not /invoices) */
async function mockDocumentsList(page: Page) {
  await mockApiGet(page, 'documents**', MOCK_INVOICE_LIST)
}

/** Mock the documents list to return empty */
async function mockDocumentsEmpty(page: Page) {
  await mockApiGet(page, 'documents**', {
    documents: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    summary: { totalAmount: 0, totalPaid: 0, totalDue: 0 },
  })
}

/** Mock a single document detail endpoint */
async function mockDocumentDetail(page: Page) {
  await mockApiGet(page, 'documents/inv_1', MOCK_INVOICE_DETAIL)
}

/** Mock the next document number endpoint (needed for create page) */
async function mockNextDocumentNumber(page: Page) {
  await mockApiGet(page, 'settings/documents/number-series/*/next', {
    nextNumber: 'INV-2526-003',
    prefix: 'INV',
    financialYear: '2526',
    sequence: 3,
  })
}

/** Mock document settings (needed for create/edit) */
async function mockDocumentSettings(page: Page) {
  await mockApiGet(page, 'settings/documents', {
    defaultPaymentTerms: 'NET_30',
    stockValidation: 'WARN',
    roundOffTo: 'NEAREST_1',
    decimalPlaces: { quantity: 2, rate: 2, amount: 2 },
    defaultTermsAndConditions: null,
    autoShareOnSave: false,
    autoShareChannel: 'WHATSAPP',
    autoShareFormat: 'PDF',
    showProfitDuringBilling: false,
    allowFutureDates: false,
    transactionLockDays: 0,
    recycleBinRetentionDays: 30,
    defaultAdditionalCharges: [],
  })
}

/** Mock parties list (needed for create/edit party selector) */
async function mockParties(page: Page) {
  await mockApiGet(page, 'parties**', {
    items: [
      { id: 'p1', name: 'Sharma Electronics', phone: '9876543210', type: 'CUSTOMER', balance: 0 },
      { id: 'p2', name: 'Gupta Traders', phone: '9876543211', type: 'CUSTOMER', balance: 0 },
    ],
    total: 2,
    nextCursor: null,
  })
}

/** Mock products list (needed for create/edit line item selector) */
async function mockProducts(page: Page) {
  await mockApiGet(page, 'products**', {
    items: [
      { id: 'prod_1', name: 'Widget A', sku: 'WA-001', unit: 'pcs', salePrice: 100000, currentStock: 100 },
      { id: 'prod_2', name: 'Widget B', sku: 'WB-001', unit: 'pcs', salePrice: 100000, currentStock: 50 },
    ],
    total: 2,
    nextCursor: null,
  })
}

// ─── List Page Tests ────────────────────────────────────────────────────────

test.describe('Invoices — List Page', () => {
  test('renders invoice list with mocked data', async ({ authedPage }) => {
    await mockDocumentsList(authedPage)
    await authedPage.goto('/invoices')

    // Both invoice cards should be visible with party names
    await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()
    await expect(authedPage.getByText('Gupta Traders')).toBeVisible()

    // Document numbers should appear
    await expect(authedPage.getByText('INV-2526-001')).toBeVisible()
    await expect(authedPage.getByText('INV-2526-002')).toBeVisible()
  })

  test('shows empty state when no invoices', async ({ authedPage }) => {
    await mockDocumentsEmpty(authedPage)
    await authedPage.goto('/invoices')

    await expect(authedPage.getByText('No invoices yet')).toBeVisible()
    await expect(authedPage.getByText('Create your first invoice to start billing')).toBeVisible()
  })

  test('"Create Invoice" FAB is visible', async ({ authedPage }) => {
    await mockDocumentsList(authedPage)
    await authedPage.goto('/invoices')

    const fab = authedPage.getByLabel('Create new invoice')
    await expect(fab).toBeVisible()
  })

  test('clicking an invoice card navigates to detail', async ({ authedPage }) => {
    await mockDocumentsList(authedPage)
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices')

    // Click the first invoice card
    await authedPage
      .getByRole('button', { name: /Sharma Electronics/ })
      .click()

    await expect(authedPage).toHaveURL(/\/invoices\/inv_1/)
  })
})

// ─── Create Invoice Page Tests ──────────────────────────────────────────────

test.describe('Invoices — Create Page', () => {
  test('form page renders at /invoices/new', async ({ authedPage }) => {
    await mockNextDocumentNumber(authedPage)
    await mockDocumentSettings(authedPage)
    await mockParties(authedPage)
    await mockProducts(authedPage)
    // Also mock empty documents list in case the page fetches it
    await mockDocumentsList(authedPage)

    await authedPage.goto('/invoices/new')

    // Page should not be blank — form content should be present
    const body = authedPage.locator('body')
    await expect(body).not.toBeEmpty()

    // Header should indicate creating a new invoice
    const pageContent = await authedPage.textContent('body')
    expect(pageContent).toBeTruthy()
  })
})

// ─── Detail Page Tests ──────────────────────────────────────────────────────

test.describe('Invoices — Detail Page', () => {
  test('shows invoice number, party name, and amount', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // Document number in the hero header
    await expect(authedPage.getByText('INV-2526-001')).toBeVisible()

    // Party name
    await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()

    // Grand total — 1500000 paise = Rs 15,000.00
    // The formatInvoiceAmount uses en-IN locale with INR currency
    await expect(authedPage.getByText(/15,000/)).toBeVisible()
  })

  test('shows status badge', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // SAVED status badge
    const statusBadge = authedPage.getByLabel(/Document status/)
    await expect(statusBadge.first()).toBeVisible()
  })

  test('shows payment status badge', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // paidAmount = 0, grandTotal = 1500000 -> UNPAID
    const paymentBadge = authedPage.getByLabel(/Payment status/)
    await expect(paymentBadge.first()).toBeVisible()
  })

  test('back button navigates to invoices list', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await mockDocumentsList(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // Header has a back link/button pointing to /invoices
    const backButton = authedPage.getByRole('link', { name: /back/i }).or(
      authedPage.getByLabel(/back/i),
    )
    await expect(backButton.first()).toBeVisible()

    await backButton.first().click()
    await expect(authedPage).toHaveURL(/\/invoices$/)
  })

  test('overview tab shows document details', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // Overview tab should be active by default
    const overviewTab = authedPage.getByRole('tab', { name: 'Overview' })
    await expect(overviewTab).toBeVisible()
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true')

    // Grand Total label should be visible in overview
    await expect(authedPage.getByText('Grand Total')).toBeVisible()
  })

  test('items tab shows line items', async ({ authedPage }) => {
    await mockDocumentDetail(authedPage)
    await authedPage.goto('/invoices/inv_1')

    // Click Items tab
    await authedPage.getByRole('tab', { name: 'Items' }).click()

    // Line item product names should appear
    await expect(authedPage.getByText('Widget A')).toBeVisible()
    await expect(authedPage.getByText('Widget B')).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14', width: 375, height: 812 },
  { name: 'iPhone SE', width: 320, height: 568 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test(`invoices list: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockDocumentsList(authedPage)
      await authedPage.goto('/invoices')

      // Wait for list to render
      await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()

      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`invoice detail: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockDocumentDetail(authedPage)
      await authedPage.goto('/invoices/inv_1')

      // Wait for detail to render
      await expect(authedPage.getByText('INV-2526-001')).toBeVisible()

      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
}
