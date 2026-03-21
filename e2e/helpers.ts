import { type Page, expect } from '@playwright/test'
import { MOCK_USER, MOCK_AUTH_ME_RESPONSE } from './fixtures'

// ─── Login Helper ────────────────────────────────────────────────────────────
export async function loginAsAdmin(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_AUTH_ME_RESPONSE),
    }),
  )
  await page.route('**/api/csrf-token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { csrfToken: 'test-csrf-token' } }),
    }),
  )
  await page.goto('/login')
  await page.evaluate((user) => {
    sessionStorage.setItem('cachedUser', JSON.stringify(user))
  }, MOCK_USER)
}

// ─── Visual Check Helpers ────────────────────────────────────────────────────
export async function checkNoHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth)
}

export async function checkTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const smalls: { tag: string; text: string; w: number; h: number }[] = []
    document.querySelectorAll('a, button, input, select, textarea, [role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if ((r.width > 0 && r.width < 44) || (r.height > 0 && r.height < 44)) {
        smalls.push({
          tag: el.tagName,
          text: (el.textContent || '').trim().slice(0, 20),
          w: Math.round(r.width),
          h: Math.round(r.height),
        })
      }
    })
    return smalls
  })
  return small
}

export async function checkFontSizes(page: Page) {
  const small = await page.evaluate(() => {
    const smalls: { tag: string; text: string; size: number }[] = []
    document.querySelectorAll('*').forEach((el) => {
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < 14 && (el as HTMLElement).offsetHeight > 0 && el.textContent?.trim()) {
        smalls.push({
          tag: el.tagName,
          text: el.textContent.trim().slice(0, 30),
          size: fs,
        })
      }
    })
    return smalls.slice(0, 20)
  })
  return small
}

export function setupConsoleErrorCapture(page: Page): { getErrors: () => string[] } {
  const errors: string[] = []
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') errors.push(msg.text())
  }
  page.on('console', handler)
  return { getErrors: () => [...errors] }
}

// ─── Navigation Helpers ──────────────────────────────────────────────────────
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle' })
  // Wait for skeletons to disappear (condition-based, not hardcoded timeout)
  const skeleton = page.locator('[data-testid="skeleton"], .skeleton, [data-testid="loading"]')
  await skeleton.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // No skeleton found — page loaded without loading state, which is fine
  })
}

export async function verifyPageLoaded(page: Page) {
  const errorState = page.locator('[data-testid="error-state"], .error-state, [role="alert"]')
  if (await errorState.count() > 0) {
    const text = await errorState.first().textContent()
    if (text?.toLowerCase().includes('error') || text?.toLowerCase().includes('failed')) {
      throw new Error(`Page shows error state: ${text}`)
    }
  }
}

// ─── Form Helpers ────────────────────────────────────────────────────────────
export async function fillFormField(page: Page, label: string, value: string) {
  const field = page.getByLabel(label)
  await field.fill(value)
}

export async function submitForm(page: Page, buttonText = 'Submit') {
  const btn = page.getByRole('button', { name: buttonText })
  await btn.click()
}

export async function verifyValidationError(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 3000 })
}

// ─── State Helpers ───────────────────────────────────────────────────────────
export async function verifyToast(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 })
}

export async function verifyEmptyState(page: Page, text?: string) {
  const empty = page.locator('[data-testid="empty-state"], .empty-state')
  await expect(empty).toBeVisible({ timeout: 3000 })
  if (text) {
    await expect(empty).toContainText(text)
  }
}

export async function verifyLoadingState(page: Page) {
  const loading = page.locator('[data-testid="skeleton"], .skeleton, [data-testid="loading"]')
  const count = await loading.count()
  return count > 0
}

export async function verifyErrorState(page: Page, message?: string) {
  const error = page.locator('[data-testid="error-state"], .error-state')
  await expect(error).toBeVisible({ timeout: 3000 })
  if (message) {
    await expect(error).toContainText(message)
  }
  const retry = page.getByRole('button', { name: /retry/i })
  await expect(retry).toBeVisible()
}

// ─── Viewport Helpers ────────────────────────────────────────────────────────
export const VIEWPORTS = {
  mobileSmall: { width: 320, height: 568 },
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
} as const

export async function testAtViewports(
  page: Page,
  testFn: (viewport: string) => Promise<void>,
) {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size)
    await testFn(name)
  }
}
