import { test, expect, mockApiGet } from './fixtures'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_APP_SETTINGS = {
  pinEnabled: false,
  biometricEnabled: false,
  operationPinSet: false,
  dateFormat: 'DD/MM/YYYY',
  calculatorPosition: 'BOTTOM_RIGHT',
}

const MOCK_ROLES_RESPONSE = {
  roles: [],
}

const MOCK_STAFF_RESPONSE = {
  staff: [],
  pending: [],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Settings Hub', () => {
  test('renders with setting sections', async ({ authedPage: page }) => {
    // Mock app settings API
    await page.route('**/api/users/*/settings**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_APP_SETTINGS }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Settings')).toBeVisible()

    // Setting sections should be visible (Security is the first section)
    await expect(page.getByText('Security')).toBeVisible()
  })

  test('no horizontal scroll on 375px', async ({ authedPage: page }) => {
    await page.route('**/api/users/*/settings**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_APP_SETTINGS }),
        })
      } else {
        route.continue()
      }
    })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})

test.describe('Roles Page', () => {
  test('renders roles page', async ({ authedPage: page }) => {
    await page.route('**/api/businesses/*/roles**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_ROLES_RESPONSE }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/settings/roles')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Roles')).toBeVisible()
  })
})

test.describe('Staff Page', () => {
  test('renders staff page', async ({ authedPage: page }) => {
    // Staff page also fetches roles for the role-change drawer
    await page.route('**/api/businesses/*/staff**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_STAFF_RESPONSE }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/businesses/*/roles**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_ROLES_RESPONSE }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/settings/staff')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Staff')).toBeVisible()
  })
})

test.describe('Security Page', () => {
  test('renders security / PIN setup page', async ({ authedPage: page }) => {
    await page.goto('/settings/security')
    await page.waitForLoadState('domcontentloaded')

    // The security route renders PinSetupPage — verify it loads
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()

    // Should show PIN-related content
    await expect(page.getByText(/pin/i)).toBeVisible()
  })
})

test.describe('Shortcuts Page', () => {
  test('renders keyboard shortcuts page', async ({ authedPage: page }) => {
    await page.goto('/settings/shortcuts')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible()

    // Should mention desktop/tablet usage
    await expect(page.getByText(/desktop and tablet/i)).toBeVisible()
  })
})
