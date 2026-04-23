import { chromium } from '@playwright/test';

const widths = [320, 375, 425];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 748 }, deviceScaleFactor: 2 });

await ctx.request.post('http://localhost:5002/api/auth/dev-login', {
  data: { username: 'admin', password: 'admin123' },
  headers: { 'Content-Type': 'application/json' },
});

const page = await ctx.newPage();

for (const w of widths) {
  await page.setViewportSize({ width: w, height: 748 });
  try {
    await page.goto('http://localhost:5002/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log(`goto error at ${w}px:`, e.message);
  }
  let attached = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const count = await page.locator('.bnav').count();
    if (count > 0) { attached = true; break; }
  }
  if (!attached) {
    console.log(`bnav never attached at ${w}px after 15s. URL=${page.url()}`);
    await page.screenshot({ path: `/tmp/bnav-${w}-FAIL.png`, fullPage: false });
    continue;
  }
  await page.locator('.bnav__fab').first().waitFor({ state: 'attached', timeout: 5000 });
  // Let slide-up + fab pop animations settle (0.3s + 0.4s).
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => {
    const nav = document.querySelector('.bnav');
    const fab = document.querySelector('.bnav__fab');
    const tabs = document.querySelectorAll('.bnav__tab');
    if (!nav || !fab) return { found: false };
    const r = nav.getBoundingClientRect();
    const f = fab.getBoundingClientRect();
    const before = r.bottom;
    window.scrollTo(0, 200);
    const after = nav.getBoundingClientRect().bottom;
    window.scrollTo(0, 0);
    return {
      vp: { w: window.innerWidth, h: window.innerHeight },
      nav: { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom) },
      fab: { y: Math.round(f.y), h: Math.round(f.height), cx: Math.round(f.x + f.width / 2) },
      tabsCount: tabs.length,
      sticky: { before: Math.round(before), after: Math.round(after), ok: Math.abs(after - window.innerHeight) < 2 },
    };
  });

  console.log(`--- ${w}px ---`);
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `/tmp/bnav-${w}.png`, fullPage: false });
}

await ctx.close();
await browser.close();
console.log('\nScreenshots: /tmp/bnav-320.png /tmp/bnav-375.png /tmp/bnav-425.png');
