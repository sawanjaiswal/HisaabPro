/** Trace what fires GET /api/payments/outstanding (no /list) */
import { chromium, devices } from '@playwright/test'

const BASE = 'http://localhost:5002'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
})

const page = await ctx.newPage()

// Capture all requests with stack
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
const reqMeta = new Map()
cdp.on('Network.requestWillBeSent', (e) => {
  reqMeta.set(e.requestId, { url: e.request.url, initiator: e.initiator })
})
cdp.on('Network.responseReceived', (e) => {
  if (e.response.status >= 400) {
    const m = reqMeta.get(e.requestId)
    console.log(`--- ${e.response.status} ${e.response.url}`)
    console.log('   initiator:', m?.initiator?.type)
    if (m?.initiator?.stack?.callFrames) {
      for (const f of m.initiator.stack.callFrames.slice(0, 6)) {
        console.log(`     at ${f.functionName || '<anon>'} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
      }
    }
  }
})

await page.goto(`${BASE}/payments/outstanding`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

await browser.close()
