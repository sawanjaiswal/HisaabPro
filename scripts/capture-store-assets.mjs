import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'store-assets');
mkdirSync(outDir, { recursive: true });

const htmlPath = `file://${join(__dirname, 'generate-store-assets.html')}`;

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'networkidle' });

  // Wait for font to load
  await page.waitForTimeout(2000);

  // 1. App Icon 512x512
  const icon = await page.locator('#app-icon');
  await icon.screenshot({ path: join(outDir, 'app-icon-512.png') });
  console.log('Captured: app-icon-512.png (512x512)');

  // 2. Feature Graphic 1024x500
  const fg = await page.locator('#feature-graphic');
  await fg.screenshot({ path: join(outDir, 'feature-graphic-1024x500.png') });
  console.log('Captured: feature-graphic-1024x500.png (1024x500)');

  await browser.close();
  console.log(`\nAll assets saved to: ${outDir}/`);
}

capture().catch(console.error);
