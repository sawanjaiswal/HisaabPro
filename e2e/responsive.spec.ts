import { test, expect } from '@playwright/test'

const mobileViewports = [
  { name: '320px (iPhone SE)', width: 320, height: 568 },
  { name: '375px (iPhone 14)', width: 375, height: 812 },
]

for (const vp of mobileViewports) {
  test.describe(`Responsive — ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
    })

    test('no horizontal scroll on login page', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('domcontentloaded')

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test('no horizontal scroll on 404 page', async ({ page }) => {
      await page.goto('/nonexistent-route')
      await page.waitForLoadState('domcontentloaded')

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test('no horizontal scroll on dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('domcontentloaded')

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test('touch targets >= 44px on login page', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('domcontentloaded')

      const buttons = page.getByRole('button')
      const count = await buttons.count()

      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox()
        if (box) {
          expect(
            box.width >= 44 || box.height >= 44,
            `Button ${i} is too small: ${box.width}x${box.height}`,
          ).toBeTruthy()
        }
      }
    })

    test('bottom nav visible on mobile (if authenticated)', async ({ page }) => {
      await page.goto('/dashboard')

      const url = page.url()
      if (url.includes('/login')) {
        // Unauthenticated — bottom nav should NOT show on login
        const nav = page.locator('nav[aria-label="Main navigation"]')
        await expect(nav).not.toBeVisible()
        return
      }

      // Authenticated — bottom nav should be visible
      const nav = page.locator('nav[aria-label="Main navigation"]')
      await expect(nav).toBeVisible()
    })

    test('headers render without overflow', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('domcontentloaded')

      // No element should overflow the viewport width
      const overflowing = await page.evaluate((viewportWidth) => {
        const elements = document.querySelectorAll('h1, h2, h3, header')
        for (const el of elements) {
          const rect = el.getBoundingClientRect()
          if (rect.right > viewportWidth + 1) return true
        }
        return false
      }, vp.width)

      expect(overflowing).toBe(false)
    })
  })
}
