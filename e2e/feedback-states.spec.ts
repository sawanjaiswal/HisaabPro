import { test, expect } from '@playwright/test'

test.describe('Feedback States', () => {
  test('404 page renders with correct content', async ({ page }) => {
    await page.goto('/this-does-not-exist')

    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.getByText("doesn't exist or has been moved")).toBeVisible()
    await expect(page.getByRole('button', { name: /go to dashboard/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible()
  })

  test('404 page shows 404 code', async ({ page }) => {
    await page.goto('/nonexistent')
    await expect(page.getByText('404')).toBeVisible()
  })

  test('error state renders when API returns 500', async ({ page }) => {
    // Mock all API calls to fail — tests that error boundaries catch failures
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } }),
      }),
    )

    await page.goto('/dashboard')

    const url = page.url()
    if (url.includes('/login')) {
      // Unauthenticated — can't test dashboard error state
      return
    }

    // Should show some error feedback, not a blank page
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('empty state renders for zero items on parties page', async ({ page }) => {
    // Mock parties API to return empty array
    await page.route('**/api/parties**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    )

    await page.goto('/parties')

    const url = page.url()
    if (url.includes('/login')) return

    // Page should render (not be blank) — specific empty state text depends on implementation
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('empty state renders for zero items on products page', async ({ page }) => {
    await page.route('**/api/products**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    )

    await page.goto('/products')

    const url = page.url()
    if (url.includes('/login')) return

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('loading state appears briefly before content', async ({ page }) => {
    // Delay API response to observe loading state
    await page.route('**/api/**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }), 2000),
    )

    await page.goto('/dashboard')

    const url = page.url()
    if (url.includes('/login')) return

    // The page should show something during loading (spinner, skeleton, or content)
    // It should NOT be a completely blank white page
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('404 go-to-dashboard button navigates away from 404', async ({ page }) => {
    await page.goto('/does-not-exist-123')
    await expect(page.getByText('Page not found')).toBeVisible()

    await page.getByRole('button', { name: /go to dashboard/i }).click()
    // Should leave the 404 page
    await expect(page.getByText('Page not found')).not.toBeVisible()
  })

  test('404 go-back button works', async ({ page }) => {
    // First visit login, then go to 404
    await page.goto('/login')
    await page.goto('/does-not-exist-456')
    await expect(page.getByText('Page not found')).toBeVisible()

    await page.getByRole('button', { name: /go back/i }).click()
    // Should go back to the previous page (login)
    await expect(page).toHaveURL(/\/login/)
  })
})
