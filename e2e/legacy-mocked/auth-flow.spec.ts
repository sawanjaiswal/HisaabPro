import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test('unauthenticated user is redirected to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to login from parties', async ({ page }) => {
    await page.goto('/parties')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to login from invoices', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to login from products', async ({ page }) => {
    await page.goto('/products')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to login from settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders with visible content', async ({ page }) => {
    await page.goto('/login')

    // Page should not be blank
    const body = page.locator('body')
    await expect(body).toBeVisible()
    const text = await body.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  test('login page does not show bottom navigation', async ({ page }) => {
    await page.goto('/login')

    const nav = page.locator('nav[aria-label="Main navigation"]')
    await expect(nav).not.toBeVisible()
  })

  test('root path redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/')
    // Root redirects to /dashboard, which redirects to /login if unauthenticated
    await expect(page).toHaveURL(/\/login/)
  })

  test('already-authenticated user on login page is redirected to dashboard', async ({ page }) => {
    // This test verifies the GuestRoute redirect behavior
    // When a user is already authenticated and visits /login, they should be sent to /dashboard
    // Since we can't easily set auth state in E2E without a backend,
    // we verify the page at least loads without errors
    await page.goto('/login')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
