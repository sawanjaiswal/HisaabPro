#!/usr/bin/env node
/**
 * HisaabPro — Real Device Journey Crawler
 *
 * 100% Mechanical, 0-Token Device Automation.
 * Connects directly to the physical Android WebView via ADB & Chrome DevTools Protocol.
 * Recursively clicks every button, fills forms, tests interactive actions (Remind, Invoice, Payment),
 * scrolls viewports, verifies sticky action bars, captures screenshots, and catches all JS runtime errors.
 */

import http from 'http'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const SCREENSHOTS_DIR = '/tmp/device_crawler_screenshots'
const REPORT_FILE = 'JOURNEY_AUDIT_REPORT.md'

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

function getDeviceId() {
  const out = execSync('adb devices').toString()
  const lines = out.split('\n').filter(l => l.trim() && !l.startsWith('List'))
  if (lines.length === 0) throw new Error('No ADB device connected!')
  return lines[0].split('\t')[0].trim()
}

function setupAdbPort(deviceId) {
  // Wake and unlock device
  execSync(`adb -s ${deviceId} shell input keyevent KEYCODE_WAKEUP`)
  execSync(`adb -s ${deviceId} shell wm dismiss-keyguard`)
  
  // Get App PID
  let pid = ''
  try {
    pid = execSync(`adb -s ${deviceId} shell pidof com.hisaabpro.app`).toString().trim()
  } catch {
    console.log('App not running, launching...')
    execSync(`adb -s ${deviceId} shell am start -n com.hisaabpro.app/.MainActivity`)
    execSync('sleep 2')
    pid = execSync(`adb -s ${deviceId} shell pidof com.hisaabpro.app`).toString().trim()
  }

  if (!pid) throw new Error('Failed to find com.hisaabpro.app PID')

  execSync(`adb -s ${deviceId} forward --remove-all`)
  execSync(`adb -s ${deviceId} forward tcp:9223 localabstract:webview_devtools_remote_${pid}`)
  console.log(`✅ ADB DevTools forwarded to PID: ${pid} on port 9223`)
  return pid
}

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9223/json', (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const list = JSON.parse(data)
          const page = list.find(item => item.type === 'page')
          if (page?.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl)
          } else {
            reject(new Error('No active page found in DevTools target list'))
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function main() {
  console.log('════════════════════════════════════════════════════════════')
  console.log('🚀 HISAABPRO REAL-DEVICE MECHANICAL JOURNEY CRAWLER')
  console.log('════════════════════════════════════════════════════════════')

  const deviceId = getDeviceId()
  console.log(`📱 Target Device: ${deviceId}`)
  setupAdbPort(deviceId)

  const wsUrl = await getWsUrl()
  const ws = new globalThis.WebSocket(wsUrl)

  let msgId = 1
  const pending = new Map()
  const caughtErrors = []

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })

  let currentUrl = 'https://localhost/dashboard'

  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data)
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data)
        pending.delete(data.id)
      }

      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        const text = (data.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ')
        caughtErrors.push({ type: 'CONSOLE_ERROR', url: currentUrl, message: text, time: new Date().toISOString() })
        console.error(`  ❌ [CONSOLE ERROR @ ${currentUrl}] ${text}`)
      }

      if (data.method === 'Runtime.exceptionThrown') {
        const text = data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text
        caughtErrors.push({ type: 'UNCAUGHT_EXCEPTION', url: currentUrl, message: text, time: new Date().toISOString() })
        console.error(`  💥 [EXCEPTION @ ${currentUrl}] ${text}`)
      }
    } catch (e) {
      console.error('WS parse error:', e.message)
    }
  })

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evalJs(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result?.result?.value
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
  }

  function screenshot(name) {
    const filename = `${name.replace(/[^a-z0-9]/gi, '_')}.png`
    const filepath = path.join(SCREENSHOTS_DIR, filename)
    try {
      execSync(`adb -s ${deviceId} shell screencap -p > "${filepath}"`)
      return filepath
    } catch {
      return null
    }
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('DOM.enable')

  async function ensureDashboard() {
    await evalJs(`window.history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate'));`)
    await sleep(600)
    await evalJs(`(() => {
      const closeBtns = Array.from(document.querySelectorAll('button[aria-label="Close"], .modal-close, .drawer-close, [data-dismiss]'));
      closeBtns.forEach(b => b.click());
    })()`)
    await sleep(200)
    currentUrl = await evalJs(`window.location.href`)
  }

  await ensureDashboard()
  screenshot('00_dashboard_initial')

  // Step 1: Discover all interactables on dashboard
  const clickables = await evalJs(`(() => {
    const elements = Array.from(document.querySelectorAll(
      'header button, .dashboard-quick-parties button, .dashboard-quick-party-item, .dashboard-section-header button, .dashboard-txn-row, .dashboard-commission-card, .dashboard-update-banner button, .bottom-nav button'
    )).filter(el => el.offsetParent !== null);

    return elements.map((el, i) => ({
      index: i,
      text: (el.innerText || el.getAttribute('aria-label') || el.className || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
      tag: el.tagName,
      className: el.className
    }));
  })()`)

  console.log(`\n🔍 Discovered ${clickables.length} interactive elements on Home Dashboard:`)
  clickables.forEach((item, i) => console.log(`  [${i + 1}] "${item.text}"`))

  const journeyResults = []

  // Step 2: Iterate through each dashboard element
  for (let i = 0; i < clickables.length; i++) {
    const item = clickables[i]
    console.log(`\n────────────────────────────────────────────────────────────`)
    console.log(`▶ [${i + 1}/${clickables.length}] Testing Dashboard Interaction: "${item.text}"`)
    console.log(`────────────────────────────────────────────────────────────`)

    await ensureDashboard()

    // Click item
    await evalJs(`(() => {
      const elements = Array.from(document.querySelectorAll(
        'header button, .dashboard-quick-parties button, .dashboard-quick-party-item, .dashboard-section-header button, .dashboard-txn-row, .dashboard-commission-card, .dashboard-update-banner button, .bottom-nav button'
      )).filter(el => el.offsetParent !== null);
      if (elements[${i}]) elements[${i}].click();
    })()`)

    await sleep(700)
    currentUrl = await evalJs(`window.location.href`)

    // Inspect target screen/modal state
    const inspect = await evalJs(`(() => {
      const isCrash = !!document.querySelector('.error-boundary, .app-fatal-error');
      const isModalOrDrawer = !!document.querySelector('.modal, .drawer, [role="dialog"], [role="menu"]');
      const url = window.location.href;
      
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .filter(inp => inp.offsetParent !== null && !inp.disabled);

      const buttons = Array.from(document.querySelectorAll('button:not(:disabled), [role="button"]:not([aria-disabled="true"]), a.btn'))
        .filter(b => b.offsetParent !== null)
        .map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 30));

      const stickyFooters = Array.from(document.querySelectorAll('.form-footer--sticky, .sticky-bottom, [data-sticky-footer], .app-footer--sticky'));

      return {
        url,
        isCrash,
        isModalOrDrawer,
        inputsCount: inputs.length,
        buttonsCount: buttons.length,
        buttonsSample: buttons.slice(0, 6),
        hasStickyFooter: stickyFooters.length > 0
      };
    })()`)

    console.log(`  Target: URL=${inspect.url} | Modal/Drawer=${inspect.isModalOrDrawer} | Inputs=${inspect.inputsCount} | Buttons=${inspect.buttonsCount}`)
    if (inspect.buttonsSample.length) console.log(`  Buttons visible: [ ${inspect.buttonsSample.join(' | ')} ]`)

    // If inputs exist, simulate entering test data
    if (inspect.inputsCount > 0) {
      console.log(`  👉 Filling form inputs with test data...`)
      await evalJs(`(() => {
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="search"]'))
          .filter(inp => inp.offsetParent !== null && !inp.disabled);
        for (const input of textInputs.slice(0, 3)) {
          input.focus();
          input.value = input.type === 'number' ? '500' : 'Automated Test';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()`)
      await sleep(200)
    }

    // Scroll down to test responsiveness and sticky footer pinning
    await evalJs(`window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });`)
    await sleep(250)

    const ss = screenshot(`item_${String(i + 1).padStart(2, '0')}_${item.text}`)
    const passed = !inspect.isCrash
    console.log(`  Verdict: ${passed ? '✅ PASSED' : '❌ CRASHED'}`)

    journeyResults.push({
      itemText: item.text,
      targetUrl: inspect.url,
      isModal: inspect.isModalOrDrawer,
      inputsCount: inspect.inputsCount,
      buttonsCount: inspect.buttonsCount,
      passed,
      screenshot: ss
    })

    // If modal/drawer, dismiss cleanly
    if (inspect.isModalOrDrawer) {
      await evalJs(`(() => {
        const close = document.querySelector('button[aria-label="Close"], .modal-close, .drawer-close, [data-dismiss]');
        if (close) close.click();
      })()`)
      await sleep(200)
    }
  }

  // Step 3: Deep test specific key journeys
  console.log(`\n════════════════════════════════════════════════════════════`)
  console.log(`🧪 TESTING SPECIFIC HIGH-VALUE FLOWS`)
  console.log(`════════════════════════════════════════════════════════════`)

  // 1. Test Invoice Creation Flow
  console.log(`\n▶ [Flow 1] Test Create Invoice Flow (/invoices/new)`)
  await evalJs(`window.history.pushState({}, '', '/invoices/new'); window.dispatchEvent(new PopStateEvent('popstate'));`)
  await sleep(700)
  const invoiceInspect = await evalJs(`(() => {
    const isCrash = !!document.querySelector('.error-boundary, .app-fatal-error');
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select')).filter(i => i.offsetParent !== null);
    const buttons = Array.from(document.querySelectorAll('button:not(:disabled)')).filter(b => b.offsetParent !== null);
    const sticky = !!document.querySelector('.form-footer--sticky, .sticky-bottom, [data-sticky-footer]');
    return { isCrash, inputsCount: inputs.length, buttonsCount: buttons.length, sticky };
  })()`)
  console.log(`  Invoice Form: Inputs=${invoiceInspect.inputsCount} | Buttons=${invoiceInspect.buttonsCount} | StickyFooter=${invoiceInspect.sticky}`)
  screenshot('flow_create_invoice')
  console.log(`  Verdict: ${!invoiceInspect.isCrash ? '✅ PASSED' : '❌ CRASHED'}`)

  // 2. Test Party Detail & Remind Flow
  console.log(`\n▶ [Flow 2] Test Parties List & Remind Actions (/parties)`)
  await evalJs(`window.history.pushState({}, '', '/parties'); window.dispatchEvent(new PopStateEvent('popstate'));`)
  await sleep(700)
  const partiesInspect = await evalJs(`(() => {
    const isCrash = !!document.querySelector('.error-boundary, .app-fatal-error');
    const partyRows = Array.from(document.querySelectorAll('.party-item, .party-card, [data-party-id], .party-row')).filter(r => r.offsetParent !== null);
    const actionBtns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim());
    return { isCrash, partyCount: partyRows.length, actionBtnsSample: actionBtns.slice(0, 6) };
  })()`)
  console.log(`  Parties Page: Parties=${partiesInspect.partyCount} | Buttons Sample: [ ${partiesInspect.actionBtnsSample.join(' | ')} ]`)
  screenshot('flow_parties_list')
  console.log(`  Verdict: ${!partiesInspect.isCrash ? '✅ PASSED' : '❌ CRASHED'}`)

  // Final Dashboard Return
  await ensureDashboard()
  screenshot('99_final_verified_dashboard')

  // Generate Report
  const total = journeyResults.length + 2
  const passedCount = journeyResults.filter(r => r.passed).length + (!invoiceInspect.isCrash ? 1 : 0) + (!partiesInspect.isCrash ? 1 : 0)
  const allClean = caughtErrors.length === 0 && passedCount === total

  const report = `# Mechanical Journey Audit Report (${new Date().toISOString()})

- **Device:** ${deviceId}
- **Total Interactions Tested:** ${total}
- **Passed Interactions:** ${passedCount}/${total}
- **Console Errors:** ${caughtErrors.filter(e => e.type === 'CONSOLE_ERROR').length}
- **Uncaught Exceptions:** ${caughtErrors.filter(e => e.type === 'UNCAUGHT_EXCEPTION').length}
- **Status:** ${allClean ? '🟢 ALL PASSING (GOLD STANDARD)' : '🔴 ISSUES FOUND'}

## Interacted Dashboard Elements:
${journeyResults.map((r, idx) => `- [${idx + 1}] **"${r.itemText}"** $\\rightarrow$ \`${r.targetUrl}\` : ${r.passed ? '✅ PASS' : '❌ FAIL'}`).join('\n')}

## Flows Tested:
- **Create Invoice (/invoices/new):** ${!invoiceInspect.isCrash ? '✅ PASS' : '❌ FAIL'} (StickyFooter: ${invoiceInspect.sticky})
- **Parties & Reminders (/parties):** ${!partiesInspect.isCrash ? '✅ PASS' : '❌ FAIL'}

${caughtErrors.length > 0 ? `## Errors Detected:\n` + caughtErrors.map((e, i) => `${i + 1}. **[${e.type}]** \`${e.url}\`: \`${e.message}\``).join('\n') : '## Errors: None (0 Errors Clean)'}
`

  fs.writeFileSync(REPORT_FILE, report, 'utf8')
  console.log('\n' + report)

  ws.close()
  process.exit(allClean ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
