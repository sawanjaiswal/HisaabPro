/**
 * Real-human-user journey for HisaabPro — port 5174 (Vite) + 4000 (API).
 * Captures screenshots, console errors, network 4xx/5xx, page errors.
 */
import { chromium, devices } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/tmp/qa-journey'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:5174'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  colorScheme: 'light',
  ignoreHTTPSErrors: true,
})

const trace = []
const consoleErrors = []
const networkFailures = []
const pageErrors = []

const page = await ctx.newPage()
page.on('pageerror', (e) => pageErrors.push({ url: page.url(), msg: e.message, stack: (e.stack || '').split('\n').slice(0, 4).join(' | ') }))
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 500) })
  }
})
page.on('response', (r) => {
  const s = r.status()
  const u = r.url()
  if (s >= 400 && u.includes('/api/')) {
    networkFailures.push({ url: u.replace(BASE, ''), status: s, method: r.request().method() })
  }
})

async function step(name, fn) {
  const before = { console: consoleErrors.length, page: pageErrors.length, net: networkFailures.length }
  const t = Date.now()
  let result = 'ok'
  let note = ''
  try {
    await fn()
  } catch (e) {
    result = 'fail'
    note = e.message.slice(0, 200)
  }
  const ms = Date.now() - t
  try {
    await page.screenshot({ path: `${OUT}/${String(trace.length + 1).padStart(2, '0')}-${name}.png`, fullPage: false })
  } catch {}
  const newConsole = consoleErrors.slice(before.console)
  const newPage = pageErrors.slice(before.page)
  const newNet = networkFailures.slice(before.net)
  trace.push({ step: name, result, ms, url: page.url(), newConsole, newPage, newNet, note })
  const flags = []
  if (newConsole.length) flags.push(`console=${newConsole.length}`)
  if (newPage.length) flags.push(`pageerr=${newPage.length}`)
  if (newNet.length) flags.push(`net=${newNet.length}`)
  console.log(`  ${name.padEnd(30)} ${result.padEnd(4)} ${ms}ms ${flags.join(' ')}${note ? ` — ${note}` : ''}`)
}

// Login (cookies persist via context request)
console.log('Logging in…')
const loginResp = await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
console.log(`  login status=${loginResp.status()}`)
if (loginResp.status() !== 200) {
  console.log('  ABORT — login failed')
  process.exit(1)
}

const ts = Date.now()
const PARTY_NAME = `QA Wholesaler ${ts}`
const PARTY_PHONE = String(ts).slice(-10)
const PRODUCT_NAME = `QA Saree ${ts}`

console.log('\nJourney…')
await step('01-dashboard', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
})

await step('02-parties-list', async () => {
  await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('03-party-new-form', async () => {
  await page.goto(`${BASE}/parties/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('04-party-fill', async () => {
  await page.locator('input').first().fill(PARTY_NAME)
  const phone = page.locator('input[inputmode="tel"], input[type="tel"]').first()
  if (await phone.count() > 0) await phone.fill(PARTY_PHONE)
  await page.waitForTimeout(400)
})

await step('05-party-submit', async () => {
  const save = page.getByRole('button', { name: /save party|save$|create/i }).first()
  await save.click({ timeout: 4000 })
  await page.waitForTimeout(2200)
})

await step('06-products-list', async () => {
  await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('07-product-new-form', async () => {
  await page.goto(`${BASE}/products/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('08-product-fill', async () => {
  await page.locator('input').first().fill(PRODUCT_NAME)
  const price = page.locator('input[inputmode="decimal"], input[type="number"]').first()
  if (await price.count() > 0) await price.fill('1500')
  await page.waitForTimeout(400)
})

await step('09-product-submit', async () => {
  const save = page.getByRole('button', { name: /save product|save$|create/i }).first()
  await save.click({ timeout: 4000 })
  await page.waitForTimeout(2200)
})

await step('10-invoices-list', async () => {
  await page.goto(`${BASE}/invoices`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('11-invoice-new', async () => {
  await page.goto(`${BASE}/invoices/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
})

await step('12-payments-list', async () => {
  await page.goto(`${BASE}/payments`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('13-payment-new', async () => {
  await page.goto(`${BASE}/payments/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('14-outstanding', async () => {
  await page.goto(`${BASE}/outstanding`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('15-reports', async () => {
  await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('16-settings', async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('17-profile', async () => {
  await page.goto(`${BASE}/settings/profile`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('18-staff', async () => {
  await page.goto(`${BASE}/settings/staff`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('19-pos', async () => {
  await page.goto(`${BASE}/pos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
})

await step('20-expenses', async () => {
  await page.goto(`${BASE}/expenses`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

await step('21-back-dashboard', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
})

const summary = {
  total: trace.length,
  passed: trace.filter((s) => s.result === 'ok').length,
  failed: trace.filter((s) => s.result === 'fail').length,
  totalConsoleErrors: consoleErrors.length,
  totalPageErrors: pageErrors.length,
  totalNetworkFailures: networkFailures.length,
  steps: trace,
  consoleErrors,
  pageErrors,
  networkFailures,
}

writeFileSync(`${OUT}/REPORT.json`, JSON.stringify(summary, null, 2))

console.log(`\n══════════════════════════════════════`)
console.log(`Passed:              ${summary.passed}/${summary.total}`)
console.log(`Failed:              ${summary.failed}`)
console.log(`Console errors:      ${summary.totalConsoleErrors}`)
console.log(`Page errors:         ${summary.totalPageErrors}`)
console.log(`Network 4xx/5xx:     ${summary.totalNetworkFailures}`)
console.log(`Report:              ${OUT}/REPORT.json`)
console.log(`Screenshots:         ${OUT}/`)

await browser.close()
