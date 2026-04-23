/** Route sweep — visits every concrete app route in a real browser,
 *  capturing console errors, page errors (uncaught throws), and 4xx/5xx
 *  API responses. For routes with :id params, picks the first available
 *  party / product / invoice from the API and substitutes.
 *
 *  Output: /tmp/qa-routes/REPORT.md  (+ screenshot per failing route)
 */

import { chromium, devices } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5002'
const OUT = '/tmp/qa-routes'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

// Auth
const auth = await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
if (!auth.ok()) { console.error(`dev-login ${auth.status()}`); process.exit(1) }

// Resolve a sample id for each entity (so /:id routes can be visited)
async function firstId(path, key) {
  const res = await ctx.request.get(`${BASE}${path}`)
  if (!res.ok()) return null
  const json = await res.json().catch(() => null)
  const arr = json?.data?.[key] || json?.data || []
  return Array.isArray(arr) ? arr[0]?.id ?? null : null
}

const partyId = await firstId('/api/parties?limit=1', 'parties')
const productId = await firstId('/api/products?limit=1', 'products')
const invoiceId = await firstId('/api/documents?type=SALE_INVOICE&limit=1', 'documents')
const paymentId = await firstId('/api/payments?limit=1', 'payments')

console.log(`Sample ids → party=${partyId} product=${productId} invoice=${invoiceId} payment=${paymentId}`)

// All concrete routes (substitute :id where we have sample ids)
const ROUTES = [
  '/dashboard',
  '/parties',
  '/parties/new',
  partyId && `/parties/${partyId}`,
  partyId && `/parties/${partyId}/edit`,
  '/parties/import',
  '/products',
  '/products/new',
  productId && `/products/${productId}`,
  productId && `/products/${productId}/edit`,
  '/invoices',
  '/invoices/new',
  invoiceId && `/invoices/${invoiceId}`,
  invoiceId && `/invoices/${invoiceId}/edit`,
  '/payments',
  '/payments/new',
  paymentId && `/payments/${paymentId}`,
  paymentId && `/payments/${paymentId}/edit`,
  '/outstanding',
  '/reports',
  '/reports/sales',
  '/reports/purchases',
  '/reports/stock-summary',
  '/reports/day-book',
  '/reports/payment-history',
  '/reports/tax-summary',
  '/reports/gst-returns',
  '/reports/tds-tcs',
  '/reports/profit-loss',
  '/reports/balance-sheet',
  '/reports/cash-flow',
  '/reports/aging',
  '/reports/profitability',
  '/reports/discounts',
  '/reports/trial-balance',
  partyId && `/reports/party-statement/${partyId}`,
  '/settings',
  '/settings/roles',
  '/settings/roles/new',
  '/settings/staff',
  '/settings/staff/invite',
  '/settings/security',
  '/settings/transaction-controls',
  '/settings/audit-log',
  '/settings/shortcuts',
  '/settings/pin-setup',
  '/settings/gst',
  '/settings/tax-rates',
  '/settings/tax-rates/new',
  '/settings/currency',
  '/settings/templates',
  '/recurring',
  '/gst/reconciliation',
  '/accounting/chart-of-accounts',
  '/accounting/journal-entries',
  '/accounting/fy-closure',
  '/accounting/tally-export',
  '/bank-accounts',
  '/expenses',
  '/other-income',
  '/cheques',
  '/loans',
  '/bill-scan',
].filter(Boolean)

const results = []

for (const route of ROUTES) {
  const page = await ctx.newPage()
  const consoleErrs = []
  const pageErrs = []
  const apiErrs = []

  page.on('console', m => {
    if (m.type() !== 'error') return
    const text = m.text()
    // Filter noisy resource-load failures
    if (text.includes('Failed to load resource')) return
    consoleErrs.push(text.slice(0, 300))
  })
  page.on('pageerror', e => { pageErrs.push(e.message.slice(0, 300)) })
  page.on('response', r => {
    const u = r.url()
    if (!u.includes('/api/')) return
    if (r.status() >= 400) apiErrs.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}`)
  })

  let nav = null
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000) // let async data resolve
    nav = 'ok'
  } catch (e) {
    nav = `nav-fail: ${e.message.slice(0, 120)}`
  }

  const broken = pageErrs.length > 0 || consoleErrs.length > 0 || apiErrs.length > 0 || nav !== 'ok'
  if (broken) {
    const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
    await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: false }).catch(() => {})
  }

  results.push({ route, nav, pageErrs, consoleErrs, apiErrs })
  console.log(`${broken ? '✗' : '✓'} ${route}${broken ? ` (page=${pageErrs.length} console=${consoleErrs.length} api=${apiErrs.length})` : ''}`)
  await page.close()
}

await browser.close()

// Report
const failing = results.filter(r => r.pageErrs.length || r.consoleErrs.length || r.apiErrs.length || r.nav !== 'ok')
const lines = []
lines.push(`# Route Sweep — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n`)
lines.push(`Visited ${results.length} routes — ${failing.length} with errors\n`)
for (const r of failing) {
  lines.push(`## ${r.route}\n`)
  if (r.nav !== 'ok') lines.push(`- nav: ${r.nav}`)
  if (r.pageErrs.length) {
    lines.push(`- page errors:`)
    for (const e of r.pageErrs) lines.push(`  - ${e}`)
  }
  if (r.consoleErrs.length) {
    lines.push(`- console errors:`)
    for (const e of r.consoleErrs.slice(0, 5)) lines.push(`  - ${e}`)
  }
  if (r.apiErrs.length) {
    lines.push(`- api errors:`)
    for (const e of [...new Set(r.apiErrs)].slice(0, 8)) lines.push(`  - ${e}`)
  }
  lines.push('')
}

writeFileSync(`${OUT}/REPORT.md`, lines.join('\n'))
console.log(`\nReport: ${OUT}/REPORT.md`)
console.log(`Total: ${results.length}  Failing: ${failing.length}`)
process.exit(failing.length > 0 ? 1 : 0)
