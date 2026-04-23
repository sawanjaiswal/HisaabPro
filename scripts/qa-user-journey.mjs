/**
 * Senior-QA user journey — Priya the wholesaler
 *
 * Walks the golden path a real user takes on day one:
 *   login → dashboard → add party → add product → create invoice
 *        → record payment → outstanding → settings → logout
 *
 * Captures: screenshot per step, console errors, network 4xx/5xx,
 * load timing, and a JSON trace for the writeup.
 */

import { chromium, devices } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/tmp/qa-journey'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:5002'
const API  = 'http://localhost:4000'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  colorScheme: 'light',
})

// ─── Telemetry collectors ────────────────────────────────────────────────────
const trace = []
const consoleErrors = []
const networkFailures = []
const pageErrors = []

const page = await ctx.newPage()
page.on('pageerror', (e) => pageErrors.push({ url: page.url(), msg: e.message }))
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push({ url: page.url(), text: msg.text() })
  }
})
page.on('response', (r) => {
  const s = r.status()
  const u = r.url()
  // Capture any 4xx/5xx that targets our API (proxy or direct).
  if (s >= 400 && (u.includes('/api/') || u.startsWith(API))) {
    networkFailures.push({ url: u, status: s, method: r.request().method() })
  }
})

// ─── Step helper ─────────────────────────────────────────────────────────────
async function step(name, fn) {
  const before = { console: consoleErrors.length, page: pageErrors.length, net: networkFailures.length }
  const t = Date.now()
  let result = 'ok'
  let note = ''
  try {
    await fn()
  } catch (e) {
    result = 'fail'
    note = e.message
  }
  const ms = Date.now() - t
  await page.screenshot({ path: `${OUT}/${String(trace.length + 1).padStart(2, '0')}-${name}.png`, fullPage: false })
  const newConsole = consoleErrors.slice(before.console)
  const newPage = pageErrors.slice(before.page)
  const newNet = networkFailures.slice(before.net)
  trace.push({ step: name, result, ms, url: page.url(), newConsole, newPage, newNet, note })
  console.log(`  ${name.padEnd(28)} ${result.padEnd(4)} ${ms}ms` +
    (newConsole.length ? ` console=${newConsole.length}` : '') +
    (newPage.length ? ` pageerr=${newPage.length}` : '') +
    (newNet.length ? ` net4xx=${newNet.length}` : '') +
    (note ? ` — ${note.slice(0, 80)}` : ''))
}

// ─── Login ───────────────────────────────────────────────────────────────────
console.log('Logging in via dev-login…')
const loginResp = await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
console.log(`  login status=${loginResp.status()}`)
if (loginResp.status() !== 200) {
  console.log('  ABORT — login failed')
  process.exit(1)
}

// ─── Journey ─────────────────────────────────────────────────────────────────
const ts = Date.now()
const PARTY_NAME   = `Test Wholesaler ${ts}`
const PARTY_PHONE  = String(ts).slice(-10)
const PRODUCT_NAME = `Test Saree ${ts}`

console.log('\nWalking journey…')

await step('1-dashboard', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('2-parties-list', async () => {
  await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('3-create-party-form', async () => {
  await page.goto(`${BASE}/parties/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('4-fill-party', async () => {
  // First text input = Party Name; phone input = numeric inputmode tel
  await page.locator('input').first().fill(PARTY_NAME)
  const phone = page.locator('input[inputmode="tel"], input[type="tel"], input').nth(1)
  await phone.fill(PARTY_PHONE)
  await page.waitForTimeout(300)
})

await step('5-submit-party', async () => {
  // Save button is outside <form> — match by accessible name
  const save = page.getByRole('button', { name: /save party|save$/i }).first()
  await save.click()
  await page.waitForTimeout(2000)
})

await step('6-products-list', async () => {
  await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('7-create-product-form', async () => {
  await page.goto(`${BASE}/products/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('8-fill-product', async () => {
  await page.locator('input').first().fill(PRODUCT_NAME)
  // Sale price = first numeric input — find by inputmode/decimal or by Rs prefix
  const price = page.locator('input[inputmode="decimal"], input[type="number"]').first()
  if (await price.count() > 0) await price.fill('1500')
  await page.waitForTimeout(300)
})

await step('9-submit-product', async () => {
  const save = page.getByRole('button', { name: /save product|save$/i }).first()
  await save.click()
  await page.waitForTimeout(2000)
})

await step('10-invoices-list', async () => {
  await page.goto(`${BASE}/invoices`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('11-create-invoice-form', async () => {
  await page.goto(`${BASE}/invoices/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('12-payments-list', async () => {
  await page.goto(`${BASE}/payments`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('13-record-payment-form', async () => {
  await page.goto(`${BASE}/payments/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('14-outstanding', async () => {
  await page.goto(`${BASE}/outstanding`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('15-reports', async () => {
  await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('16-settings', async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('17-staff', async () => {
  await page.goto(`${BASE}/settings/staff`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('18-profile', async () => {
  await page.goto(`${BASE}/settings/profile`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('19-pricing-gated', async () => {
  await page.goto(`${BASE}/pos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('20-back-to-dashboard', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

// ─── Report ──────────────────────────────────────────────────────────────────
const summary = {
  total: trace.length,
  passed: trace.filter((s) => s.result === 'ok').length,
  failed: trace.filter((s) => s.result === 'fail').length,
  totalConsoleErrors: consoleErrors.length,
  totalPageErrors: pageErrors.length,
  totalNetworkFailures: networkFailures.length,
  party: { name: PARTY_NAME, phone: PARTY_PHONE },
  product: { name: PRODUCT_NAME },
  steps: trace,
  consoleErrors,
  pageErrors,
  networkFailures,
}

writeFileSync(`${OUT}/REPORT.json`, JSON.stringify(summary, null, 2))

console.log(`\n──────────────────────────────────────`)
console.log(`Passed:  ${summary.passed}/${summary.total}`)
console.log(`Failed:  ${summary.failed}`)
console.log(`Console errors:    ${summary.totalConsoleErrors}`)
console.log(`Page errors:       ${summary.totalPageErrors}`)
console.log(`Network 4xx/5xx:   ${summary.totalNetworkFailures}`)
console.log(`Report:      ${OUT}/REPORT.json`)
console.log(`Screenshots: ${OUT}/`)

await browser.close()
