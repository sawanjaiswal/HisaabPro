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

// 1. Walk ancestors of .bottom-nav-modern, find anything that creates a containing block for `position: fixed`
const report = await page.evaluate(() => {
  const nav = document.querySelector('.bottom-nav-modern');
  if (!nav) return { found: false };

  const props = ['transform', 'perspective', 'filter', 'backdropFilter', 'contain', 'willChange'];
  const chain = [];
  let el = nav.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const offenders = {};
    for (const p of props) {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'auto' && !v.startsWith('normal')) offenders[p] = v;
    }
    chain.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className?.baseVal ?? el.className,
      position: cs.position,
      offenders: Object.keys(offenders).length ? offenders : null,
    });
    el = el.parentElement;
  }

  // Scroll probe
  const before = nav.getBoundingClientRect();
  window.scrollTo(0, 200);
  const after = nav.getBoundingClientRect();
  window.scrollTo(0, 0);

  return {
    chain,
    scroll: {
      before: { y: before.y, bottom: before.bottom },
      after: { y: after.y, bottom: after.bottom },
      sticksAtBottom: Math.abs(after.bottom - window.innerHeight) < 1,
    },
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
