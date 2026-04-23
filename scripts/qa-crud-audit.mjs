/** CRUD audit — exercises add / edit / delete for parties, products, invoices
 *  via the UI and the JSON API, capturing 4xx/5xx, console errors, and any
 *  navigation/state failures. Outputs a markdown report to /tmp/qa-crud/. */

import { chromium, devices } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5002'
const OUT = '/tmp/qa-crud'
mkdirSync(OUT, { recursive: true })

const stamp = Date.now().toString(36).slice(-5)
const findings = []
const networkErrors = []
const consoleErrors = []
const pageErrors = []

function log(level, area, msg, extra = {}) {
  const entry = { level, area, msg, ...extra, ts: new Date().toISOString() }
  findings.push(entry)
  const tag = level === 'pass' ? '✓' : level === 'warn' ? '⚠' : '✗'
  console.log(`${tag} [${area}] ${msg}${extra.detail ? ' — ' + extra.detail : ''}`)
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {})
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

// Authenticate (dev-login sets httpOnly cookies on the context)
const auth = await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})
if (!auth.ok()) { log('fail', 'auth', `dev-login ${auth.status()}`); process.exit(1) }
log('pass', 'auth', `dev-login ok`)

// Grab CSRF token (double-submit cookie pattern — token sent in body & cookie,
// must be echoed via X-CSRF-Token header on every mutating request).
const csrfRes = await ctx.request.get(`${BASE}/api/auth/csrf-token`)
const csrfBody = await csrfRes.json().catch(() => ({}))
const csrfToken = csrfBody?.data?.token || csrfBody?.token || csrfRes.headers()['x-csrf-token']
if (!csrfToken) log('warn', 'auth', `no csrf token retrieved (status ${csrfRes.status()})`)
const baseHeaders = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
// Server's replayProtection middleware (documents/payments) needs fresh nonce+ts
// on every call — generate per-call via apiHeaders().
const apiHeadersFn = () => ({
  ...baseHeaders,
  'X-Request-Nonce': crypto.randomUUID(),
  'X-Request-Timestamp': Date.now().toString(),
})
const apiHeaders = apiHeadersFn()  // legacy; per-call fresh ones used below

const page = await ctx.newPage()

page.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
    consoleErrors.push({ url: page.url(), text: m.text() })
  }
})
page.on('pageerror', e => { pageErrors.push({ url: page.url(), text: e.message }) })
page.on('response', r => {
  const u = r.url()
  if (!u.includes('/api/')) return
  if (r.status() >= 400) networkErrors.push({ url: u, status: r.status(), method: r.request().method() })
})

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// =========================================================================
// PARTIES — create / edit / delete
// =========================================================================
const partyName = `QA Party ${stamp}`
const partyNameEdited = `${partyName} EDITED`

try {
  // CREATE
  await page.goto(`${BASE}/parties/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const nameInput = page.locator('#party-name')
  await nameInput.waitFor({ state: 'visible', timeout: 8000 })
  await nameInput.fill(partyName)
  // Use a stamp-derived phone so reruns don't collide on the unique-phone constraint
  const phoneDigits = `9${(Math.abs(parseInt(stamp, 36)) % 1_000_000_000).toString().padStart(9, '0')}`
  const phoneInput = page.locator('#party-phone')
  if (await phoneInput.count()) await phoneInput.fill(phoneDigits)
  await shot(page, 'party-create-form')
  // Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()
  await submitBtn.click()
  await page.waitForTimeout(2000)
  // Verify by hitting list and looking for the name
  await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const visible = await page.locator(`text="${partyName}"`).first().isVisible().catch(() => false)
  if (visible) log('pass', 'party.create', `created "${partyName}"`)
  else log('fail', 'party.create', `created party not visible in list`)
  await shot(page, 'party-list-after-create')

  // EDIT — find the party and tap into it
  if (visible) {
    await page.locator(`text="${partyName}"`).first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'party-detail-before-edit')
    // Look for an Edit affordance
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit"), [aria-label*="edit" i]').first()
    if (await editBtn.count()) {
      await editBtn.click()
      await page.waitForTimeout(1500)
      const editName = page.locator('#party-name')
      await editName.waitFor({ state: 'visible', timeout: 8000 })
      await editName.fill(partyNameEdited)
      await shot(page, 'party-edit-form')
      const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first()
      await saveBtn.click()
      await page.waitForTimeout(2000)
      await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      const editedVisible = await page.locator(`text="${partyNameEdited}"`).first().isVisible().catch(() => false)
      if (editedVisible) log('pass', 'party.edit', `renamed to "${partyNameEdited}"`)
      else log('fail', 'party.edit', `edited name not in list`)
    } else {
      log('warn', 'party.edit', `no edit button found on detail screen`)
    }

    // DELETE — try API delete (UI delete varies)
    const list = await ctx.request.get(`${BASE}/api/parties?search=${encodeURIComponent(partyNameEdited.length > 0 ? partyNameEdited : partyName)}`)
    const data = await list.json().catch(() => null)
    const hits = data?.data?.parties || []
    const target = hits.find(p => p.name === partyNameEdited || p.name === partyName)
    if (target?.id) {
      const del = await ctx.request.delete(`${BASE}/api/parties/${target.id}`, { headers: apiHeadersFn() })
      if (del.ok()) log('pass', 'party.delete', `deleted id=${target.id}`)
      else log('fail', 'party.delete', `delete returned ${del.status()}`)
    } else {
      log('warn', 'party.delete', `couldn't find party id via API to delete`)
    }
  }
} catch (e) {
  log('fail', 'party', `unhandled error: ${e.message}`)
}

// =========================================================================
// PRODUCTS — create / edit / delete
// =========================================================================
const productName = `QA Product ${stamp}`
const productNameEdited = `${productName} EDITED`

try {
  await page.goto(`${BASE}/products/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await shot(page, 'product-create-form')
  const pname = page.locator('#product-name')
  await pname.waitFor({ state: 'visible', timeout: 8000 })
  await pname.fill(productName)
  const priceInput = page.locator('#product-sale-price')
  if (await priceInput.count()) await priceInput.fill('100')
  const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()
  await submitBtn.click()
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const pvisible = await page.locator(`text="${productName}"`).first().isVisible().catch(() => false)
  if (pvisible) log('pass', 'product.create', `created "${productName}"`)
  else log('fail', 'product.create', `created product not visible in list`)
  await shot(page, 'product-list-after-create')

  if (pvisible) {
    await page.locator(`text="${productName}"`).first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'product-detail-before-edit')
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit"), [aria-label*="edit" i]').first()
    if (await editBtn.count()) {
      await editBtn.click()
      await page.waitForTimeout(1500)
      const editName = page.locator('#product-name')
      await editName.waitFor({ state: 'visible', timeout: 8000 })
      await editName.fill(productNameEdited)
      const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first()
      await saveBtn.click()
      await page.waitForTimeout(2000)
      await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      const editedVisible = await page.locator(`text="${productNameEdited}"`).first().isVisible().catch(() => false)
      if (editedVisible) log('pass', 'product.edit', `renamed to "${productNameEdited}"`)
      else log('fail', 'product.edit', `edited name not in list`)
    } else {
      log('warn', 'product.edit', `no edit button on detail screen`)
    }

    const list = await ctx.request.get(`${BASE}/api/products?search=${encodeURIComponent(productNameEdited)}`)
    const data = await list.json().catch(() => null)
    const hits = data?.data?.products || []
    const target = hits.find(p => p.name === productNameEdited || p.name === productName)
    if (target?.id) {
      const del = await ctx.request.delete(`${BASE}/api/products/${target.id}`, { headers: apiHeadersFn() })
      if (del.ok()) log('pass', 'product.delete', `deleted id=${target.id}`)
      else log('fail', 'product.delete', `delete returned ${del.status()}`)
    } else {
      log('warn', 'product.delete', `couldn't find product id via API to delete`)
    }
  }
} catch (e) {
  log('fail', 'product', `unhandled error: ${e.message}`)
}

// =========================================================================
// INVOICES — create / edit / delete (requires a party + product)
// =========================================================================
let helperPartyId, helperProductId, createdInvoiceId
try {
  // Pick the first available unit so product creation has a valid unitId
  const unitsRes = await ctx.request.get(`${BASE}/api/units`)
  const unitsJson = await unitsRes.json().catch(() => null)
  const unitId = unitsJson?.data?.[0]?.id

  // Seed helpers via API (faster than UI). Server wraps in { party } / { product }.
  // Phone derived from stamp so reruns get unique numbers (db has unique-phone constraint).
  const helperPhone = `8${(Math.abs(parseInt(stamp, 36)) % 1_000_000_000).toString().padStart(9, '0')}`
  const partyRes = await ctx.request.post(`${BASE}/api/parties`, {
    data: { name: `INV Helper Party ${stamp}`, phone: helperPhone, type: 'CUSTOMER' },
    headers: apiHeadersFn(),
  })
  const partyJson = await partyRes.json().catch(() => null)
  helperPartyId = partyJson?.data?.party?.id
  if (!helperPartyId) log('warn', 'invoice.setup', `couldn't seed helper party (status ${partyRes.status()})`)

  const prodRes = await ctx.request.post(`${BASE}/api/products`, {
    // openingStock so stock validation doesn't block the invoice submit
    data: { name: `INV Helper Product ${stamp}`, salePrice: 100, unitId, openingStock: 100 },
    headers: apiHeadersFn(),
  })
  const prodJson = await prodRes.json().catch(() => null)
  helperProductId = prodJson?.data?.product?.id
  if (!helperProductId) log('warn', 'invoice.setup', `couldn't seed helper product (status ${prodRes.status()}) — body: ${JSON.stringify(prodJson).slice(0,200)}`)

  // CREATE invoice via UI
  await page.goto(`${BASE}/invoices/new?type=SALE`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await shot(page, 'invoice-create-form')
  // 1) Pick the party — PartySearchInput becomes a selected card on click
  const partySearch = page.locator('input[placeholder*="arty" i], input[placeholder*="ustomer" i], input[id*="party-search" i]').first()
  if (await partySearch.count()) {
    await partySearch.click()
    await partySearch.fill(`INV Helper Party ${stamp}`)
    await page.waitForTimeout(900)
    const candidate = page.locator(`text="INV Helper Party ${stamp}"`).first()
    if (await candidate.count()) await candidate.click()
  }
  await page.waitForTimeout(400)
  // 2) Toggle product search panel (the "Add Item" button)
  const addItemBtn = page.locator('button.add-item-btn, button:has-text("Add Item"), button[aria-label*="add line item" i]').first()
  if (await addItemBtn.count()) {
    await addItemBtn.click()
    await page.waitForTimeout(500)
  }
  // 3) Search and select the helper product. The dropdown row is the *product name*
  // and a separate "+ Add" button — clicking the name does nothing, only the
  // Add button registers a line item.
  const productSearch = page.locator('#product-search-input, input[placeholder*="roduct" i], input[aria-label*="search product" i]').first()
  if (await productSearch.count()) {
    await productSearch.click()
    await productSearch.fill(`INV Helper Product ${stamp}`)
    await page.waitForTimeout(900)
    // Try several locators for the add button (label, role, class)
    const addBtn = page.locator('button:has-text("Add"):not(.add-item-btn), [aria-label*="add product" i], button.product-row-add').first()
    if (await addBtn.count()) {
      await addBtn.click()
    } else {
      // Fallback: click the product card
      const pcandidate = page.locator(`text="INV Helper Product ${stamp}"`).first()
      if (await pcandidate.count()) await pcandidate.click()
    }
  }
  await page.waitForTimeout(800)
  await shot(page, 'invoice-create-form-filled')
  // InvoiceTotalsBar has two buttons: "Save Draft" (secondary) and "Save" (primary).
  // We want the primary one — text-only "Save", btn-primary class — because:
  //  - "Save Draft" submits status=DRAFT and stays on /invoices/new (no navigation)
  //  - "Save" submits status=SAVED and navigates to /invoices on success
  const submitBtn = page.locator('button.btn-primary:has-text("Save"), button[aria-label*="save invoice" i]').first()
  if (await submitBtn.count()) {
    await submitBtn.click()
    await page.waitForTimeout(2500)
    // Successful create navigates to /invoices (list). The detail-id form
    // (/invoices/:id) is only reachable from the list, so look up the latest
    // SALE_INVOICE via API to grab its id for the edit/delete steps below.
    const after = page.url()
    const stillOnNew = after.includes('/invoices/new')
    if (!stillOnNew) {
      const list = await ctx.request.get(`${BASE}/api/documents?type=SALE_INVOICE&limit=5&sortBy=createdAt&sortOrder=desc`)
      const data = await list.json().catch(() => null)
      const docs = data?.data?.documents || data?.data || []
      const created = docs.find?.(d => d.partyId === helperPartyId) || docs[0]
      createdInvoiceId = created?.id
      log('pass', 'invoice.create', `created — navigated to ${after}${createdInvoiceId ? ` (id=${createdInvoiceId})` : ''}`)
    } else {
      log('fail', 'invoice.create', `submit didn't navigate off /invoices/new (still ${after})`)
    }
  } else {
    log('warn', 'invoice.create', `no submit button found`)
  }
  await shot(page, 'invoice-after-create')

  // EDIT invoice via UI
  if (createdInvoiceId) {
    await page.goto(`${BASE}/invoices/${createdInvoiceId}/edit`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await shot(page, 'invoice-edit-form')
    const editSubmit = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first()
    if (await editSubmit.count()) {
      await editSubmit.click()
      await page.waitForTimeout(2500)
      const after = page.url()
      if (!after.includes('/edit') && /\/invoices\//.test(after)) {
        log('pass', 'invoice.edit', `saved — navigated to ${after}`)
      } else {
        log('warn', 'invoice.edit', `edit submit didn't navigate (still ${after})`)
      }
    } else {
      log('warn', 'invoice.edit', `no save button on edit screen`)
    }
  }

  // DELETE invoice via API
  if (createdInvoiceId) {
    const del = await ctx.request.delete(`${BASE}/api/documents/${createdInvoiceId}`, { headers: apiHeadersFn() })
    if (del.ok()) log('pass', 'invoice.delete', `deleted id=${createdInvoiceId}`)
    else log('fail', 'invoice.delete', `delete returned ${del.status()}`)
  }

  // Cleanup helpers
  if (helperPartyId) await ctx.request.delete(`${BASE}/api/parties/${helperPartyId}`, { headers: apiHeadersFn() })
  if (helperProductId) await ctx.request.delete(`${BASE}/api/products/${helperProductId}`, { headers: apiHeadersFn() })
} catch (e) {
  log('fail', 'invoice', `unhandled error: ${e.message}`)
}

await browser.close()

// =========================================================================
// REPORT
// =========================================================================
const report = []
report.push(`# CRUD Audit — ${new Date().toISOString().slice(0, 10)}\n`)
report.push(`Run: stamp=${stamp}\n`)
report.push(`## Findings (${findings.length})\n`)
const byArea = {}
for (const f of findings) (byArea[f.area] ??= []).push(f)
for (const [area, items] of Object.entries(byArea)) {
  report.push(`### ${area}\n`)
  for (const f of items) {
    const tag = f.level === 'pass' ? '✓' : f.level === 'warn' ? '⚠' : '✗'
    report.push(`- ${tag} **${f.level}** — ${f.msg}${f.detail ? '\n  - ' + f.detail : ''}`)
  }
  report.push('')
}
if (networkErrors.length) {
  report.push(`## API errors (${networkErrors.length})\n`)
  for (const e of networkErrors) report.push(`- \`${e.method} ${e.status}\` — ${e.url}`)
  report.push('')
}
if (consoleErrors.length) {
  report.push(`## Console errors (${consoleErrors.length})\n`)
  for (const e of consoleErrors.slice(0, 30)) report.push(`- \`${e.url}\` — ${e.text.slice(0, 200)}`)
  report.push('')
}
if (pageErrors.length) {
  report.push(`## Page errors (${pageErrors.length})\n`)
  for (const e of pageErrors.slice(0, 30)) report.push(`- \`${e.url}\` — ${e.text.slice(0, 200)}`)
  report.push('')
}
const failCount = findings.filter(f => f.level === 'fail').length
const warnCount = findings.filter(f => f.level === 'warn').length
const passCount = findings.filter(f => f.level === 'pass').length
report.push(`## Summary\n`)
report.push(`- Pass: ${passCount}`)
report.push(`- Warn: ${warnCount}`)
report.push(`- Fail: ${failCount}`)
report.push(`- API errors: ${networkErrors.length}`)
report.push(`- Console errors: ${consoleErrors.length}`)
report.push(`- Page errors: ${pageErrors.length}`)

writeFileSync(`${OUT}/REPORT.md`, report.join('\n'))
console.log(`\nReport: ${OUT}/REPORT.md`)
console.log(`Pass=${passCount} Warn=${warnCount} Fail=${failCount} API=${networkErrors.length} Console=${consoleErrors.length} PageErr=${pageErrors.length}`)
process.exit(failCount > 0 ? 1 : 0)
