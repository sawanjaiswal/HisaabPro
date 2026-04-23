/** Smoke check: dashboard header (centered title + 3 actions + scroll-condense)
 *  and standard page header (title left + back + actions) — capture screenshots.  */
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5002'
const OUT = '/tmp/qa-headers'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
const page = await ctx.newPage()

// Warm up auth
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

// 1. Dashboard cold (top of page, no scroll)
await page.screenshot({ path: `${OUT}/01-dashboard-cold.png`, clip: { x: 0, y: 0, width: 390, height: 80 } })

// 2. Dashboard scrolled (should pick up frosted glass)
await page.evaluate(() => document.querySelector('main')?.scrollTo?.(0, 200) ?? window.scrollTo(0, 200))
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/02-dashboard-scrolled.png`, clip: { x: 0, y: 0, width: 390, height: 110 } })

// 3. Standard page header (parties list — no back, has avatar via root-page heuristic)
await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/03-parties-list.png`, clip: { x: 0, y: 0, width: 390, height: 80 } })

// 4. Standard page header w/ back (party create)
await page.goto(`${BASE}/parties/new`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/04-party-create.png`, clip: { x: 0, y: 0, width: 390, height: 80 } })

// 5. Detail page header w/ back + actions (need an existing party — just check invoices list which has actions)
await page.goto(`${BASE}/invoices`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/05-invoices-list.png`, clip: { x: 0, y: 0, width: 390, height: 80 } })

// 6. Settings header
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/06-settings.png`, clip: { x: 0, y: 0, width: 390, height: 80 } })

// Confirm dashboard header DOM uses unified component classes
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const headerInfo = await page.evaluate(() => {
  const h = document.querySelector('header')
  return {
    classes: h?.className,
    hasIconBtn: document.querySelectorAll('.header-icon-btn').length,
    hasCenterTitle: !!document.querySelector('.header-title--center'),
    hasOldDashClass: !!document.querySelector('.dashboard-header-icon-btn'),
  }
})
console.log('Dashboard header info:', JSON.stringify(headerInfo, null, 2))

await browser.close()
console.log(`Screenshots: ${OUT}/`)
