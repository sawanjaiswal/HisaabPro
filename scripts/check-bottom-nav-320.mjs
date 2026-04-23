import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 748 } });
const page = await ctx.newPage();

await ctx.request.post('http://localhost:5002/api/auth/dev-login', {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
});

await page.goto('http://localhost:5002/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const nav = document.querySelector('.bottom-nav-modern');
  const img = document.querySelector('.bottom-nav-modern__bg');
  const fab = document.querySelector('.bottom-nav-modern__fab');
  if (!nav) return { found: false };
  const r = nav.getBoundingClientRect();
  const ir = img.getBoundingClientRect();
  const fr = fab.getBoundingClientRect();
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    nav: { y: r.y, h: r.height, bottom: r.bottom },
    img: { y: ir.y, h: ir.height, bottom: ir.bottom },
    fab: { y: fr.y, h: fr.height, bottom: fr.bottom },
  };
});
console.log(JSON.stringify(info, null, 2));

await page.screenshot({ path: '/tmp/bottom-nav-320.png', fullPage: false });
console.log('screenshot: /tmp/bottom-nav-320.png');
await browser.close();
