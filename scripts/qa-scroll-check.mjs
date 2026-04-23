/**
 * Verify bottom-of-list clearance on scrollable pages.
 * Scrolls each list page to bottom, screenshots, and measures last-row vs FAB.
 */
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/qa-scroll'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:5174'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})

const page = await ctx.newPage()

const routes = [
  { name: 'parties', path: '/parties' },
  { name: 'products', path: '/products' },
  { name: 'invoices', path: '/invoices' },
  { name: 'outstanding', path: '/outstanding' },
  { name: 'settings', path: '/settings' },
]

for (const r of routes) {
  await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${r.name}-scrolled.png` })
  const info = await page.evaluate(() => {
    const fab = document.querySelector('.bnav__fab')
    const fabRect = fab?.getBoundingClientRect()
    // Find the bottom-most visible content-bearing element
    const all = [...document.querySelectorAll('main *')].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 30 && r.height > 10 && r.bottom <= window.innerHeight + 5
    })
    const bottomMost = all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]
    return {
      fabTop: fabRect?.top,
      fabVisualTop: fabRect ? fabRect.top - 11 : null,  // minus glow
      bottomMostTag: bottomMost?.tagName,
      bottomMostText: bottomMost?.textContent?.slice(0, 60),
      bottomMostBottom: bottomMost?.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    }
  })
  console.log(`${r.name}: fabTop=${info.fabTop} glowTop=${info.fabVisualTop} lastContentBottom=${info.bottomMostBottom} (${info.bottomMostTag}: "${info.bottomMostText?.replace(/\s+/g,' ')}")`)
  const clearance = (info.fabVisualTop || 0) - (info.bottomMostBottom || 0)
  console.log(`  clearance = ${clearance}px ${clearance >= 8 ? 'OK' : 'TIGHT/OVERLAP'}`)
}

await browser.close()
