/**
 * Headed mobile-view usability walkthrough.
 * Visible Chromium @ iPhone-13 viewport. Walks routes, captures screenshots + console errors,
 * writes /tmp/usability/REPORT.md with findings.
 *
 *   node scripts/usability-walkthrough.mjs
 */

import { chromium, devices } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/tmp/usability';
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5002';
const DEVICE = devices['iPhone 13'];
const VIEWPORT_LABEL = '390x844 (iPhone 13)';

const ROUTES = [
  // --- Phase 1: Core ---
  { phase: 'Core',     name: 'Dashboard',          path: '/dashboard' },
  { phase: 'Core',     name: 'Invoices list',      path: '/invoices' },
  { phase: 'Core',     name: 'Invoice create',     path: '/invoices/new?type=SALE' },
  { phase: 'Core',     name: 'Parties list',       path: '/parties' },
  { phase: 'Core',     name: 'Party new',          path: '/parties/new' },
  { phase: 'Core',     name: 'Products list',      path: '/products' },
  { phase: 'Core',     name: 'Product new',        path: '/products/new' },
  { phase: 'Core',     name: 'Settings',           path: '/settings' },
  { phase: 'Core',     name: 'More menu',          path: '/more' },

  // --- Phase 2: Intermediate ---
  { phase: 'Intermed', name: 'Payments list',      path: '/payments' },
  { phase: 'Intermed', name: 'Payment new',        path: '/payments/new' },
  { phase: 'Intermed', name: 'Outstanding',        path: '/outstanding' },
  { phase: 'Intermed', name: 'Reports landing',    path: '/reports' },
  { phase: 'Intermed', name: 'Sales report',       path: '/reports/sales' },
  { phase: 'Intermed', name: 'Day book',           path: '/reports/day-book' },
  { phase: 'Intermed', name: 'Expenses',           path: '/expenses' },
  { phase: 'Intermed', name: 'Bank accounts',      path: '/bank-accounts' },
  { phase: 'Intermed', name: 'Cheques',            path: '/cheques' },

  // --- Phase 3: Advanced ---
  { phase: 'Advanced', name: 'POS',                path: '/pos' },
  { phase: 'Advanced', name: 'Recurring',          path: '/recurring' },
  { phase: 'Advanced', name: 'Bill scan',          path: '/bill-scan' },
  { phase: 'Advanced', name: 'Loans',              path: '/loans' },
  { phase: 'Advanced', name: 'Other income',       path: '/other-income' },
  { phase: 'Advanced', name: 'Stock verification', path: '/stock-verification' },
  { phase: 'Advanced', name: 'Godowns',            path: '/godowns' },
  { phase: 'Advanced', name: 'Serial lookup',      path: '/serial-lookup' },
  { phase: 'Advanced', name: 'Chart of accounts',  path: '/accounting/chart-of-accounts' },
  { phase: 'Advanced', name: 'Journal entries',    path: '/accounting/journal-entries' },
  { phase: 'Advanced', name: 'Trial balance',      path: '/reports/trial-balance' },
  { phase: 'Advanced', name: 'P&L',                path: '/reports/profit-loss' },
  { phase: 'Advanced', name: 'Balance sheet',      path: '/reports/balance-sheet' },
  { phase: 'Advanced', name: 'Cash flow',          path: '/reports/cash-flow' },
  { phase: 'Advanced', name: 'Aging report',       path: '/reports/aging' },
  { phase: 'Advanced', name: 'GST returns',        path: '/reports/gst-returns' },
  { phase: 'Advanced', name: 'GST reconciliation', path: '/gst/reconciliation' },
  { phase: 'Advanced', name: 'Tax rates',          path: '/settings/tax-rates' },
  { phase: 'Advanced', name: 'Templates',          path: '/settings/templates' },
  { phase: 'Advanced', name: 'Audit log',          path: '/settings/audit-log' },
  { phase: 'Advanced', name: 'Roles',              path: '/settings/roles' },
  { phase: 'Advanced', name: 'Staff',              path: '/settings/staff' },
];

const browser = await chromium.launch({ headless: false, slowMo: 80 });
const ctx = await browser.newContext({
  ...DEVICE,
  // Force light mode for consistent screenshots
  colorScheme: 'light',
});

console.log('Logging in via dev-login…');
await ctx.request.post(`${BASE}/api/auth/dev-login`, {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
});

const page = await ctx.newPage();

const results = [];
const consoleErrorsByRoute = new Map();
const networkFailsByRoute = new Map();

let currentRoute = 'init';
page.on('console', (m) => {
  if (m.type() === 'error') {
    const arr = consoleErrorsByRoute.get(currentRoute) ?? [];
    arr.push(m.text().slice(0, 240));
    consoleErrorsByRoute.set(currentRoute, arr);
  }
});
page.on('pageerror', (e) => {
  const arr = consoleErrorsByRoute.get(currentRoute) ?? [];
  arr.push(`PAGEERROR: ${e.message.slice(0, 240)}`);
  consoleErrorsByRoute.set(currentRoute, arr);
});
page.on('response', (r) => {
  const url = r.url();
  if (!url.includes('/api/')) return;
  if (r.status() >= 400) {
    const arr = networkFailsByRoute.get(currentRoute) ?? [];
    arr.push(`${r.status()} ${r.request().method()} ${url.replace(BASE, '')}`);
    networkFailsByRoute.set(currentRoute, arr);
  }
});

for (const route of ROUTES) {
  currentRoute = route.name;
  const start = Date.now();
  let status = 'ok';
  let finalUrl = '';
  let visibleText = '';
  let error = '';

  try {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Poll for any visible content for up to 8s
    let attached = false;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      const bodyText = (await page.evaluate(() => document.body.innerText || '')).trim();
      if (bodyText.length > 20) { attached = true; break; }
    }
    if (!attached) status = 'blank';
    finalUrl = page.url().replace(BASE, '');
    visibleText = (await page.evaluate(() => (document.body.innerText || '').slice(0, 300))).replace(/\s+/g, ' ').trim();
    if (finalUrl !== route.path && !finalUrl.startsWith(route.path.split('?')[0])) {
      status = `redirected→${finalUrl}`;
    }
  } catch (e) {
    status = 'error';
    error = e.message.slice(0, 200);
  }
  const ms = Date.now() - start;

  const safe = route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const shotPath = `${OUT}/${String(results.length + 1).padStart(2, '0')}-${safe}.png`;
  try { await page.screenshot({ path: shotPath, fullPage: false }); } catch {}

  results.push({ ...route, status, ms, finalUrl, visibleText, error, shot: shotPath });
  console.log(`[${route.phase}] ${route.name.padEnd(22)} ${status.padEnd(15)} ${ms}ms`);
}

// --- write report ---
const errorRoutes = results.filter((r) => r.status !== 'ok');
const slowRoutes = results.filter((r) => r.ms > 4000);

const lines = [];
lines.push(`# HisaabPro — Mobile Usability Walkthrough`);
lines.push(``);
lines.push(`**Viewport:** ${VIEWPORT_LABEL}  `);
lines.push(`**Routes visited:** ${results.length}  `);
lines.push(`**Routes with issues:** ${errorRoutes.length}  `);
lines.push(`**Slow routes (>4s):** ${slowRoutes.length}`);
lines.push(``);
lines.push(`## Issues`);
lines.push(``);
if (errorRoutes.length === 0) lines.push(`_None._`);
for (const r of errorRoutes) {
  lines.push(`### ${r.name} — ${r.status}`);
  lines.push(`- **Path:** \`${r.path}\` → \`${r.finalUrl}\``);
  if (r.error) lines.push(`- **Error:** ${r.error}`);
  const cerr = consoleErrorsByRoute.get(r.name);
  if (cerr?.length) lines.push(`- **Console:** ${cerr.slice(0, 3).join(' | ')}`);
  const nerr = networkFailsByRoute.get(r.name);
  if (nerr?.length) lines.push(`- **API:** ${nerr.slice(0, 3).join(' | ')}`);
  lines.push(`- **Screenshot:** \`${r.shot}\``);
  lines.push(``);
}
lines.push(`## All routes`);
lines.push(``);
lines.push(`| Phase | Route | Status | Time | Console errs | API errs |`);
lines.push(`|---|---|---|---|---|---|`);
for (const r of results) {
  const ce = (consoleErrorsByRoute.get(r.name) || []).length;
  const ne = (networkFailsByRoute.get(r.name) || []).length;
  lines.push(`| ${r.phase} | ${r.name} | ${r.status} | ${r.ms}ms | ${ce} | ${ne} |`);
}
lines.push(``);
lines.push(`## Console errors (all routes)`);
lines.push(``);
for (const [route, errs] of consoleErrorsByRoute) {
  if (!errs.length) continue;
  lines.push(`**${route}:**`);
  for (const e of errs) lines.push(`- ${e}`);
  lines.push(``);
}
lines.push(`## Network failures (all routes)`);
lines.push(``);
for (const [route, errs] of networkFailsByRoute) {
  if (!errs.length) continue;
  lines.push(`**${route}:**`);
  for (const e of errs) lines.push(`- ${e}`);
  lines.push(``);
}

writeFileSync(`${OUT}/REPORT.md`, lines.join('\n'));
console.log(`\nReport: ${OUT}/REPORT.md`);
console.log(`Screenshots: ${OUT}/`);

await page.waitForTimeout(2000);
await browser.close();
