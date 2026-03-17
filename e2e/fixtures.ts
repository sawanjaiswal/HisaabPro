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
