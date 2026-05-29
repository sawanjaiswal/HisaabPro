/** One-off: record the dashboard's count-up + spring-press motion to a video.
 * Not part of the build. Run: node scripts/record-dashboard.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = 'docs/audit/flagship'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: { width: 375, height: 812 } },
})
const page = await ctx.newPage()

await page.goto('http://localhost:5002/')
await page.evaluate(async () => {
  const c = await (await fetch('/api/auth/csrf-token', { credentials: 'include' })).json()
  await fetch('/api/auth/dev-login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': c.data.csrfToken },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
})

// Warm the data cache so the reload renders the hero instantly.
await page.goto('http://localhost:5002/dashboard')
await page.locator('.dashboard-hero-card--collect').waitFor({ state: 'visible', timeout: 30000 })
await page.waitForTimeout(800)

// Reload — count-up now plays from 0 on a warm (fast) load. This is the moment we want.
await page.goto('http://localhost:5002/dashboard')
await page.locator('.dashboard-hero-card--collect').waitFor({ state: 'visible', timeout: 30000 })
await page.waitForTimeout(1600) // let the count-up (0.9s) finish + settle

// Demonstrate the spring press on each hero card.
for (const sel of ['.dashboard-hero-card--collect', '.dashboard-hero-card--pay']) {
  const card = page.locator(sel)
  await card.dispatchEvent('pointerdown')
  await page.waitForTimeout(200)
  await card.dispatchEvent('pointerup')
  await page.waitForTimeout(450)
}

await ctx.close() // flushes the video file
await browser.close()
console.log('video written to', OUT)
