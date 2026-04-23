/** Focused walkthrough: only the pages touched in this session */
import { chromium, devices } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/tmp/touched'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:5002'
const ROUTES = [
  { name: 'settings',          path: '/settings' },
  { name: 'staff',             path: '/settings/staff' },
  { name: 'sessions',          path: '/settings/sessions' },
  { name: 'invoices',          path: '/invoices' },
  { name: 'parties',           path: '/parties' },
  { name: 'products',          path: '/products' },
  { name: 'product-new',       path: '/products/new' },
  { name: 'pos',               path: '/pos' },
]

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'light' })

console.log('Logging in via dev-login…')
const loginResp = await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
console.log(`  login status=${loginResp.status()}`)
const cookies = await ctx.cookies()
console.log(`  cookies set: ${cookies.map(c => c.name).join(', ') || '(none)'}`)

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
})

const results = []
for (const r of ROUTES) {
  errors.length = 0
  const t = Date.now()
  await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const ms = Date.now() - t
  const finalUrl = page.url()
  const redirected = finalUrl.includes('/login') ? '→/login' : 'ok'
  await page.screenshot({ path: `${OUT}/${r.name}.png`, fullPage: false })
  results.push({ ...r, ms, redirected, errors: [...errors] })
  console.log(`  ${r.name.padEnd(15)} ${redirected.padEnd(10)} ${ms}ms ${errors.length ? `[${errors.length} err]` : ''}`)
}

writeFileSync(`${OUT}/REPORT.json`, JSON.stringify(results, null, 2))
console.log(`\nReport: ${OUT}/REPORT.json`)
console.log(`Screenshots: ${OUT}/`)

await browser.close()
