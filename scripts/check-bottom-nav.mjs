import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 425, height: 748 } });
const page = await ctx.newPage();

const msgs = [];
page.on('pageerror', e => msgs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') msgs.push('CONSOLE: ' + m.text()); });

// Log in via API
const loginRes = await ctx.request.post('http://localhost:5002/api/auth/dev-login', {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
});
console.log('login status:', loginRes.status());

await page.goto('http://localhost:5002/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const nav = document.querySelector('.bottom-nav-modern');
  const img = document.querySelector('.bottom-nav-modern__bg');
  const fab = document.querySelector('.bottom-nav-modern__fab');
  const items = document.querySelectorAll('.bottom-nav-modern__item');
  const url = window.location.href;
  if (!nav) return { found: false, url, bodyFirst100: document.body.innerText.slice(0, 200) };
  const navRect = nav.getBoundingClientRect();
  const imgRect = img?.getBoundingClientRect() ?? null;
  const fabRect = fab?.getBoundingClientRect() ?? null;
  return {
    found: true, url,
    navRect: { x: navRect.x, y: navRect.y, w: navRect.width, h: navRect.height },
    imgRect,
    imgSrc: img?.getAttribute('src'),
    imgComplete: img?.complete,
    imgNatural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
    fabRect,
    itemsCount: items.length,
  };
});
console.log('INFO:', JSON.stringify(info, null, 2));
console.log('MSGS:', msgs);

await page.screenshot({ path: '/tmp/bottom-nav-check.png', fullPage: false });
console.log('screenshot: /tmp/bottom-nav-check.png');
await browser.close();
