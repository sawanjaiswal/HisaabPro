import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const ctx = await browser.newContext({ viewport: { width: 425, height: 748 } });
const page = await ctx.newPage();

// Log in via API to seed cookies
const loginRes = await ctx.request.post('http://localhost:5002/api/auth/dev-login', {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
});
console.log('login status:', loginRes.status());

await page.goto('http://localhost:5002/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1500);

// Force the page tall enough to scroll
await page.addStyleTag({ content: 'main, body { min-height: 200vh !important; }' });

// Scroll loop so the user can watch the fixed bottom nav stay stuck
for (let i = 0; i < 6; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), i * 200);
  await page.waitForTimeout(900);
}
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await page.waitForTimeout(1500);

console.log('done — close the browser window when finished');
// Keep the browser open until manually closed
await new Promise(() => {});
