/**
 * Measure computed styles for the scroll clearance problem.
 * Asks the browser: what's the actual padding-bottom on app-shell-content
 * and how does that compare to the FAB's top edge?
 */
import { chromium, devices } from '@playwright/test'

const BASE = 'http://localhost:5174'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})

const page = await ctx.newPage()
await page.goto(`${BASE}/outstanding`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const report = await page.evaluate(() => {
  const rootStyles = getComputedStyle(document.documentElement)
  const fab = document.querySelector('.bnav__fab')
  const fabRect = fab?.getBoundingClientRect()
  const emptyTitle = [...document.querySelectorAll('*')].find(el => el.textContent?.trim() === 'All clear — no outstanding balance!')
  const emptyDesc = [...document.querySelectorAll('*')].find(el => el.textContent?.trim().startsWith('All balances are settled'))

  return {
    bnavHeightToken: rootStyles.getPropertyValue('--bottom-nav-height').trim(),
    appShellPad: getComputedStyle(document.querySelector('.app-shell-content')).paddingBottom,
    appShellRect: document.querySelector('.app-shell-content')?.getBoundingClientRect(),
    pageContainerRect: document.querySelector('.page-container')?.getBoundingClientRect(),
    pageContainerPad: document.querySelector('.page-container') ? getComputedStyle(document.querySelector('.page-container')).paddingBottom : 'N/A',
    fabTop: fabRect?.top,
    fabBottom: fabRect?.bottom,
    emptyTitleRect: emptyTitle?.getBoundingClientRect(),
    emptyDescRect: emptyDesc?.getBoundingClientRect(),
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    scrollTop: window.scrollY,
    isScrollable: document.documentElement.scrollHeight > window.innerHeight,
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
