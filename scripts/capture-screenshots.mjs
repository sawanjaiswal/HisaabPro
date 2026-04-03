import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'store-assets', 'screenshots');
mkdirSync(outDir, { recursive: true });

const WIDTH = 1080;
const HEIGHT = 1920;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5002';
const API_URL = process.env.API_URL || 'http://localhost:4000';

const screens = [
  { name: '02-dashboard', path: '/dashboard' },
  { name: '03-parties', path: '/parties' },
  { name: '04-products', path: '/products' },
  { name: '05-invoices', path: '/invoices' },
  { name: '06-payments', path: '/payments' },
  { name: '07-settings', path: '/settings' },
  { name: '08-more', path: '/more' },
];

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // Step 1: Get auth cookies by calling backend directly (bypasses Vite proxy rate limit)
  console.log('Getting auth cookies from backend directly...');
  const apiContext = await browser.newContext();
  const apiPage = await apiContext.newPage();
  const loginResp = await apiPage.request.post(`${API_URL}/api/auth/dev-login`, {
    data: { username: 'admin', password: 'admin123' },
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`  Login status: ${loginResp.status()}`);

  if (loginResp.status() !== 200) {
    console.error('Login failed!', await loginResp.text());
    await browser.close();
    return;
  }

  // Extract cookies from the response
  const cookies = await apiContext.cookies();
  console.log(`  Got ${cookies.length} cookies: ${cookies.map(c => c.name).join(', ')}`);

  // Step 2: Create screenshot context with cookies mapped to frontend domain
  const context = await browser.newContext({
    viewport: { width: Math.round(WIDTH / 3), height: Math.round(HEIGHT / 3) },
    deviceScaleFactor: 3,
  });

  // Map cookies to localhost (frontend)
  const frontendCookies = cookies.map(c => ({
    ...c,
    domain: 'localhost',
    path: c.path || '/',
  }));
  await context.addCookies(frontendCookies);

  // Also set the auth data in localStorage via page evaluation
  const loginData = await loginResp.json();

  const page = await context.newPage();

  // Take login screenshot first (fresh context, no cookies)
  const loginContext = await browser.newContext({
    viewport: { width: Math.round(WIDTH / 3), height: Math.round(HEIGHT / 3) },
    deviceScaleFactor: 3,
  });
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await loginPage.waitForTimeout(2000);
  await loginPage.evaluate(() => {
    document.querySelectorAll('[class*="offline"], [class*="hint"], [class*="fab"], [class*="FAB"], [class*="floating"]').forEach(el => el.style.display = 'none');
  });
  await loginPage.screenshot({ path: join(outDir, '01-login.png'), fullPage: false });
  console.log('Captured: 01-login.png');
  await loginContext.close();

  // Step 3: Navigate to each screen with auth cookies
  // First, set user/business in localStorage
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((data) => {
    localStorage.setItem('hp_user', JSON.stringify(data.data.user));
    localStorage.setItem('hp_businesses', JSON.stringify(data.data.businesses));
    localStorage.setItem('hp_active_business', JSON.stringify(data.data.activeBusiness));
  }, loginData);

  for (const screen of screens) {
    try {
      await page.goto(`${BASE_URL}${screen.path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        document.querySelectorAll('[class*="offline"]').forEach(el => el.style.display = 'none');
      });
      const filePath = join(outDir, `${screen.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Captured: ${screen.name}.png — URL: ${page.url()}`);
    } catch (e) {
      console.log(`Skipped: ${screen.name} — ${e.message.split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log(`\nAll screenshots saved to: ${outDir}/`);
}

capture().catch(console.error);
