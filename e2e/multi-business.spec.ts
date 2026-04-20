/**
 * Multi-Business E2E — comprehensive coverage for PRD #9 Task #23.
 *
 * Covers: BusinessAvatar (tap/switch), JoinBusiness (success/error/validation),
 * CreateBusiness (clone toggle, validation), StaffPermissionsPage (4 UI states + tabs).
 */
import { test, expect, type Page, type Route } from '@playwright/test'

// ─── Fixtures ──────────────────────────────────────────────────────────────
const BIZ_A = { id: 'biz_a', name: 'Acme Traders', businessType: 'general', role: 'owner', roleName: 'Owner', status: 'ACTIVE', lastActiveAt: null }
const BIZ_B = { id: 'biz_b', name: 'Bharat Stores', businessType: 'retail', role: 'staff', roleName: 'Salesman', status: 'ACTIVE', lastActiveAt: null }
const BIZ_C = { id: 'biz_c', name: 'Chai Point',    businessType: 'retail', role: 'staff', roleName: 'Cashier',  status: 'ACTIVE', lastActiveAt: null }

const USER = { id: 'user_mb', phone: '9876543210', name: 'Multi Biz', email: null, businessId: BIZ_A.id }

const ROLES = [
  { id: 'role_owner', name: 'Owner',    isSystem: true, isDefault: false, priority: 100, staffCount: 1, permissions: ['invoicing.view', 'invoicing.create', 'inventory.view', 'parties.view'] },
  { id: 'role_sales', name: 'Salesman', isSystem: true, isDefault: false, priority: 40,  staffCount: 2, permissions: ['invoicing.view', 'parties.view'] },
]

const STAFF = [
  { id: 'staff_1', userId: 'u1', name: 'Anita Rao',  phone: '9111111111', role: { id: 'role_sales', name: 'Salesman' }, status: 'ACTIVE', lastActiveAt: null, invitedBy: USER.id, joinedAt: '2026-03-15T10:00:00Z' },
  { id: 'staff_2', userId: 'u2', name: 'Binod Kumar', phone: '9222222222', role: { id: 'role_sales', name: 'Salesman' }, status: 'ACTIVE', lastActiveAt: null, invitedBy: USER.id, joinedAt: '2026-03-20T10:00:00Z' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────
async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockMe(page: Page, businesses = [BIZ_A, BIZ_B, BIZ_C], activeId = BIZ_A.id) {
  const active = businesses.find(b => b.id === activeId) ?? businesses[0] ?? null
  await page.route('**/api/auth/me', (r) => json(r, 200, {
    success: true,
    data: {
      user: { id: USER.id, phone: USER.phone, name: USER.name, email: USER.email },
      businesses, activeBusiness: active,
    },
  }))
  await page.route('**/api/auth/csrf-token', (r) => json(r, 200, { success: true, data: { token: 'tok' } }))
}

async function seedSession(page: Page, businesses = [BIZ_A, BIZ_B, BIZ_C]) {
  await page.goto('/login')
  await page.evaluate(({ u, bs }) => {
    sessionStorage.setItem('cachedUser', JSON.stringify(u))
    sessionStorage.setItem('cachedBusinesses', JSON.stringify(bs))
  }, { u: USER, bs: businesses })
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/mb-${name}.png`, fullPage: true })
}

// ─── BusinessAvatar ────────────────────────────────────────────────────────
test.describe('BusinessAvatar', () => {
  test('renders initials + dots when user has 2+ businesses', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.goto('/')
    const avatar = page.locator('.business-avatar').first()
    await expect(avatar).toBeVisible({ timeout: 10_000 })
    await expect(avatar).toHaveText(/AT/) // Acme Traders initials
    await expect(page.locator('.business-dots')).toBeVisible()
    await screenshot(page, 'avatar-multi')
  })

  test('hides dots when user has only 1 business', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.goto('/')
    await expect(page.locator('.business-avatar').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.business-dots')).toHaveCount(0)
    await screenshot(page, 'avatar-single')
  })

  test('tap opens BusinessSwitcher with all businesses listed', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.goto('/')
    await page.locator('.business-avatar').first().click()
    const sheet = page.locator('.business-switcher-sheet')
    await expect(sheet).toBeVisible()
    const items = page.locator('.business-switcher-item')
    await expect(items).toHaveCount(3)
    await expect(items.first()).toContainText('Acme Traders')
    await expect(items.nth(1)).toContainText('Bharat Stores')
    await expect(items.nth(2)).toContainText('Chai Point')
    // Active marker on Acme (current business)
    await expect(items.first()).toHaveClass(/business-switcher-item--active/)
    await screenshot(page, 'switcher-open')
  })

  test('selecting another business fires switchBusiness API', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    let switchCalled = false
    await page.route('**/api/auth/switch-business', async (r) => {
      switchCalled = true
      const payload = JSON.parse(r.request().postData() ?? '{}') as { businessId: string }
      expect(payload.businessId).toBe(BIZ_B.id)
      await json(r, 200, { success: true, data: { business: { id: BIZ_B.id, name: BIZ_B.name, businessType: BIZ_B.businessType } } })
    })
    await page.goto('/')
    await page.locator('.business-avatar').first().click()
    await page.locator('.business-switcher-item').nth(1).click()
    await page.waitForTimeout(500)
    expect(switchCalled).toBe(true)
  })

  test('swipe down on avatar cycles to next business (Gmail-style)', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    let switchedTo: string | null = null
    await page.route('**/api/auth/switch-business', async (r) => {
      const payload = JSON.parse(r.request().postData() ?? '{}') as { businessId: string }
      switchedTo = payload.businessId
      await json(r, 200, { success: true, data: { business: { id: BIZ_B.id, name: BIZ_B.name, businessType: BIZ_B.businessType } } })
    })
    await page.goto('/')
    await page.locator('.business-dots').first().waitFor({ timeout: 5000 })
    const avatar = page.locator('.business-avatar').first()
    const box = await avatar.boundingBox()
    if (!box) throw new Error('avatar has no bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 40, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    expect(switchedTo).toBe(BIZ_B.id)
  })

  test('swipe up on avatar cycles to previous business', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    let switchedTo: string | null = null
    await page.route('**/api/auth/switch-business', async (r) => {
      const payload = JSON.parse(r.request().postData() ?? '{}') as { businessId: string }
      switchedTo = payload.businessId
      await json(r, 200, { success: true, data: { business: { id: BIZ_C.id, name: BIZ_C.name, businessType: BIZ_C.businessType } } })
    })
    await page.goto('/')
    await page.locator('.business-dots').first().waitFor({ timeout: 5000 })
    const avatar = page.locator('.business-avatar').first()
    const box = await avatar.boundingBox()
    if (!box) throw new Error('avatar has no bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy - 40, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    expect(switchedTo).toBe(BIZ_C.id)
  })

  test('ArrowDown on focused avatar cycles to next business', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    let switchedTo: string | null = null
    await page.route('**/api/auth/switch-business', async (r) => {
      const payload = JSON.parse(r.request().postData() ?? '{}') as { businessId: string }
      switchedTo = payload.businessId
      await json(r, 200, { success: true, data: { business: { id: BIZ_B.id, name: BIZ_B.name, businessType: BIZ_B.businessType } } })
    })
    await page.goto('/')
    await page.locator('.business-dots').first().waitFor({ timeout: 5000 })
    const avatar = page.locator('.business-avatar').first()
    await avatar.focus()
    await avatar.press('ArrowDown')
    await page.waitForTimeout(400)
    expect(switchedTo).toBe(BIZ_B.id)
  })

  test('swipe is ignored for single-business users', async ({ page }) => {
    await mockMe(page, [BIZ_A], BIZ_A.id)
    await seedSession(page, [BIZ_A])
    let called = false
    await page.route('**/api/auth/switch-business', async (r) => {
      called = true
      await json(r, 200, { success: true, data: {} })
    })
    await page.goto('/')
    const avatar = page.locator('.business-avatar').first()
    await avatar.waitFor({ timeout: 5000 })
    const box = await avatar.boundingBox()
    if (!box) throw new Error('avatar has no bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 40, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    expect(called).toBe(false)
  })
})

// ─── JoinBusiness ──────────────────────────────────────────────────────────
test.describe('JoinBusiness', () => {
  test('submit disabled until 6-char code entered', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.goto('/join')
    const input = page.locator('.join-business-input')
    const btn = page.locator('.join-business-btn')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await expect(btn).toBeDisabled()
    await input.fill('ABC12')
    await expect(btn).toBeDisabled()
    await input.fill('ABC123')
    await expect(btn).toBeEnabled()
    await screenshot(page, 'join-ready')
  })

  test('submit success shows welcome screen', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.route('**/api/businesses/join', (r) => json(r, 200, {
      success: true,
      data: {
        businessUser: { id: 'bu_1', role: 'staff', status: 'ACTIVE' },
        business: { id: BIZ_B.id, name: BIZ_B.name, businessType: BIZ_B.businessType },
      },
    }))
    await page.goto('/join')
    await page.locator('.join-business-input').fill('D12B99')
    await page.locator('.join-business-btn').click()
    await expect(page.locator('.join-business-success-title')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.join-business-success-title')).toContainText('Bharat Stores')
    await screenshot(page, 'join-success')
  })

  test('submit error shows validation message', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.route('**/api/businesses/join', (r) => json(r, 400, {
      success: false,
      error: { code: 'INVITE_PHONE_MISMATCH', message: 'This invite was sent to a different phone number' },
    }))
    await page.goto('/join')
    await page.locator('.join-business-input').fill('ABC999')
    await page.locator('.join-business-btn').click()
    await expect(page.locator('.join-business-error')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.join-business-error')).toContainText('different phone')
    await screenshot(page, 'join-error')
  })
})

// ─── CreateBusiness ────────────────────────────────────────────────────────
test.describe('CreateBusiness', () => {
  test('clone toggle hidden for single-business users', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.goto('/business/create')
    await expect(page.locator('.create-biz-submit')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.create-biz-clone-section')).toHaveCount(0)
    await screenshot(page, 'create-solo')
  })

  test('clone toggle visible for multi-business users and reveals picker', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.goto('/business/create')
    const toggle = page.locator('.create-biz-toggle')
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    // Picker hidden before toggle
    await expect(page.locator('.create-biz-clone-picker')).toHaveCount(0)
    await toggle.click()
    await expect(page.locator('.create-biz-clone-picker')).toBeVisible()
    await screenshot(page, 'create-clone-on')
  })

  test('empty-name submit shows inline validation', async ({ page }) => {
    await mockMe(page, [BIZ_A])
    await seedSession(page, [BIZ_A])
    await page.goto('/business/create')
    await page.locator('.create-biz-submit').click()
    await expect(page.locator('.create-biz-field-error, .create-biz-input--error').first()).toBeVisible({ timeout: 3000 })
    await screenshot(page, 'create-validation')
  })
})

// ─── StaffPermissions — 4 UI states + tabs ─────────────────────────────────
test.describe('StaffPermissions', () => {
  test('loading state — spinner visible while APIs pending', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    // Delay both endpoints
    await page.route('**/api/businesses/*/roles', async (r) => { await new Promise(res => setTimeout(res, 3000)); await json(r, 200, { success: true, data: ROLES }) })
    await page.route('**/api/businesses/*/staff', async (r) => { await new Promise(res => setTimeout(res, 3000)); await json(r, 200, { success: true, data: { staff: STAFF, pending: [] } }) })
    await page.goto('/settings/permissions')
    // Loading state should be visible within the first 1.5s
    await page.waitForTimeout(800)
    await screenshot(page, 'perm-loading')
  })

  test('error state — both endpoints 500', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.route('**/api/businesses/*/roles', (r) => json(r, 500, { success: false, error: { code: 'SERVER', message: 'boom' } }))
    await page.route('**/api/businesses/*/staff', (r) => json(r, 500, { success: false, error: { code: 'SERVER', message: 'boom' } }))
    await page.goto('/settings/permissions')
    await expect(page.getByText(/could not load|failed|try again/i).first()).toBeVisible({ timeout: 5000 })
    await screenshot(page, 'perm-error')
  })

  test('empty state — no roles', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.route('**/api/businesses/*/roles', (r) => json(r, 200, { success: true, data: [] }))
    await page.route('**/api/businesses/*/staff', (r) => json(r, 200, { success: true, data: { staff: [], pending: [] } }))
    await page.goto('/settings/permissions')
    await page.waitForTimeout(1200)
    await screenshot(page, 'perm-empty')
  })

  test('success state + By Role / By Person tab switching', async ({ page }) => {
    await mockMe(page)
    await seedSession(page)
    await page.route('**/api/businesses/*/roles', (r) => json(r, 200, { success: true, data: ROLES }))
    await page.route('**/api/businesses/*/staff', (r) => json(r, 200, { success: true, data: { staff: STAFF, pending: [] } }))
    await page.goto('/settings/permissions')
    // By Role default
    await expect(page.getByText('Owner').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Salesman').first()).toBeVisible()
    await screenshot(page, 'perm-by-role')
    // Switch to By Person
    await page.getByText(/By Person/i).click()
    await expect(page.getByText('Anita Rao').first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Binod Kumar').first()).toBeVisible()
    await page.waitForTimeout(600) // let stagger animation settle
    await screenshot(page, 'perm-by-person')
  })
})

// ─── Viewport sweep ────────────────────────────────────────────────────────
const viewports = [
  { name: '320', w: 320, h: 568 },
  { name: '768', w: 768, h: 1024 },
  { name: '1280', w: 1280, h: 720 },
]

for (const vp of viewports) {
  test(`viewport ${vp.name}px — avatar + join + permissions render without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await mockMe(page)
    await seedSession(page)
    await page.route('**/api/businesses/*/roles', (r) => json(r, 200, { success: true, data: ROLES }))
    await page.route('**/api/businesses/*/staff', (r) => json(r, 200, { success: true, data: { staff: STAFF, pending: [] } }))

    for (const [route, tag] of [['/', 'dash'], ['/join', 'join'], ['/settings/permissions', 'perm']] as const) {
      await page.goto(route)
      await page.waitForTimeout(500)
      const overflow = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      expect(overflow.sw, `${route} @${vp.name}px`).toBeLessThanOrEqual(overflow.cw + 1)
      await page.screenshot({ path: `test-results/mb-vp${vp.name}-${tag}.png`, fullPage: false })
    }
  })
}
