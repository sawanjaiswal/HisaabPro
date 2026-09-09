import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const LOGO_DIR = path.resolve('public/logos')
const ARTIFACT_DIR = path.resolve('/Users/sawanjaiswal/.gemini/antigravity-cli/brain/7917640e-7a50-4c8c-9e21-800957f11207')

if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true })
}

// 1. OPTION A: Modern 'H' + ₹ Rupee / Ledger glyph
const svgOptionAIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gradA1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradA2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="gradAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84CC16"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <filter id="shadowA" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#026F39" flood-opacity="0.25"/>
    </filter>
  </defs>
  
  <!-- Left Pillar of H -->
  <rect x="80" y="70" width="70" height="372" rx="20" fill="url(#gradA1)" filter="url(#shadowA)"/>
  
  <!-- Right Pillar of H with Growth Arrow Top -->
  <path d="M 362 170 L 362 422 C 362 433 353 442 342 442 L 312 442 C 301 442 292 433 292 422 L 292 170 Z" fill="url(#gradA1)" filter="url(#shadowA)"/>
  
  <!-- Top Growth Arrow on Right Pillar -->
  <path d="M 327 70 L 415 170 L 239 170 Z" fill="url(#gradAccent)" filter="url(#shadowA)"/>
  
  <!-- Interlocking ₹ Rupee / Central Crossbar -->
  <rect x="80" y="215" width="282" height="42" rx="10" fill="url(#gradA2)"/>
  <rect x="130" y="275" width="200" height="36" rx="10" fill="url(#gradAccent)"/>
  
  <!-- Rupee diagonal leg -->
  <path d="M 230 257 Q 310 280 345 375 L 305 390 Q 275 315 220 295 Z" fill="url(#gradA1)"/>
  
  <!-- Circular Accent Node -->
  <circle cx="327" cy="115" r="14" fill="#FFFFFF"/>
</svg>`

const svgOptionAFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="gradA1_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradA2_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="gradAccent_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84CC16"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <g transform="translate(60, 40) scale(0.62)">
    <!-- Icon from Option A -->
    <rect x="80" y="70" width="70" height="372" rx="20" fill="url(#gradA1_f)"/>
    <path d="M 362 170 L 362 422 C 362 433 353 442 342 442 L 312 442 C 301 442 292 433 292 422 L 292 170 Z" fill="url(#gradA1_f)"/>
    <path d="M 327 70 L 415 170 L 239 170 Z" fill="url(#gradAccent_f)"/>
    <rect x="80" y="215" width="282" height="42" rx="10" fill="url(#gradA2_f)"/>
    <rect x="130" y="275" width="200" height="36" rx="10" fill="url(#gradAccent_f)"/>
    <path d="M 230 257 Q 310 280 345 375 L 305 390 Q 275 315 220 295 Z" fill="url(#gradA1_f)"/>
    <circle cx="327" cy="115" r="14" fill="#FFFFFF"/>
  </g>

  <!-- Typography -->
  <text x="390" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="106" font-weight="900" fill="#0F172A" letter-spacing="-2">Hisaab<tspan fill="#026F39">Pro</tspan></text>
  <text x="395" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="28" font-weight="700" fill="#64748B" letter-spacing="6">SMART BILLING &amp; LEDGER</text>
  
  <!-- Subtle Badge -->
  <rect x="1000" y="160" width="130" height="42" rx="21" fill="#DCFCE7"/>
  <text x="1065" y="188" font-family="sans-serif" font-size="18" font-weight="800" fill="#15803D" text-anchor="middle" letter-spacing="1">GST READY</text>
</svg>`

// 2. OPTION B: Smart Ledger & Growth Shield
const svgOptionBIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gradB1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradB2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="gradShield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84CC16"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <filter id="shadowB" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#026F39" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Ledger Book Backing -->
  <rect x="90" y="70" width="310" height="370" rx="36" fill="url(#gradB1)" filter="url(#shadowB)"/>
  <rect x="125" y="105" width="240" height="300" rx="20" fill="#FFFFFF" opacity="0.95"/>
  
  <!-- Ledger Rows / Horizontal lines -->
  <rect x="155" y="145" width="130" height="18" rx="9" fill="#E2E8F0"/>
  <rect x="155" y="180" width="90" height="16" rx="8" fill="#E2E8F0"/>
  
  <!-- Upward Trend Chart Line with Arrow -->
  <path d="M 155 330 L 225 260 L 285 295 L 375 160" fill="none" stroke="url(#gradB2)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <polygon points="395,140 350,155 380,185" fill="#059669"/>

  <!-- Shield of Trust Overlay -->
  <g transform="translate(280, 260) scale(0.9)" filter="url(#shadowB)">
    <path d="M 100 10 Q 180 10 180 70 C 180 145 100 190 100 190 C 100 190 20 145 20 70 Q 20 10 100 10 Z" fill="url(#gradShield)"/>
    <!-- Checkmark in shield -->
    <path d="M 65 95 L 90 120 L 140 65" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

const svgOptionBFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="gradB1_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradB2_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="gradShield_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84CC16"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <g transform="translate(60, 40) scale(0.62)">
    <rect x="90" y="70" width="310" height="370" rx="36" fill="url(#gradB1_f)"/>
    <rect x="125" y="105" width="240" height="300" rx="20" fill="#FFFFFF" opacity="0.95"/>
    <rect x="155" y="145" width="130" height="18" rx="9" fill="#E2E8F0"/>
    <rect x="155" y="180" width="90" height="16" rx="8" fill="#E2E8F0"/>
    <path d="M 155 330 L 225 260 L 285 295 L 375 160" fill="none" stroke="url(#gradB2_f)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="395,140 350,155 380,185" fill="#059669"/>
    <g transform="translate(280, 260) scale(0.9)">
      <path d="M 100 10 Q 180 10 180 70 C 180 145 100 190 100 190 C 100 190 20 145 20 70 Q 20 10 100 10 Z" fill="url(#gradShield_f)"/>
      <path d="M 65 95 L 90 120 L 140 65" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>

  <text x="390" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="106" font-weight="900" fill="#0F172A" letter-spacing="-2">Hisaab<tspan fill="#026F39">Pro</tspan></text>
  <text x="395" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="28" font-weight="700" fill="#64748B" letter-spacing="6">ACCOUNTING &amp; INVOICES</text>
</svg>`

// 3. OPTION C: Balance Sheet + Upward Prosperity Peak
const svgOptionCIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gradC1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065F46"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradC2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="gradCArrow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A3E635"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <filter id="shadowC" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#026F39" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Left Pillar with Base and Capital -->
  <path d="M 80 130 C 80 115 95 100 110 100 L 160 100 C 175 100 190 115 190 130 L 190 380 C 190 395 175 410 160 410 L 110 410 C 95 410 80 395 80 380 Z" fill="url(#gradC1)" filter="url(#shadowC)"/>
  
  <!-- Right Pillar -->
  <path d="M 322 130 C 322 115 337 100 352 100 L 402 100 C 417 100 432 115 432 130 L 432 380 C 432 395 417 410 402 410 L 352 410 C 337 410 322 395 322 380 Z" fill="url(#gradC1)" filter="url(#shadowC)"/>

  <!-- Dynamic Chevron Growth Chart Traversing Pillars -->
  <path d="M 50 370 L 195 240 L 290 310 L 435 110" fill="none" stroke="url(#gradCArrow)" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadowC)"/>
  
  <!-- Growth Arrowhead -->
  <polygon points="475,80 405,100 445,160" fill="#10B981" filter="url(#shadowC)"/>
  
  <!-- Center Rupee Symbol Cutout/Badge -->
  <circle cx="256" cy="256" r="42" fill="#FFFFFF" filter="url(#shadowC)"/>
  <text x="256" y="272" font-family="sans-serif" font-size="44" font-weight="900" fill="#026F39" text-anchor="middle">₹</text>
</svg>`

const svgOptionCFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="gradC1_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065F46"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradCArrow_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A3E635"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <g transform="translate(60, 40) scale(0.62)">
    <path d="M 80 130 C 80 115 95 100 110 100 L 160 100 C 175 100 190 115 190 130 L 190 380 C 190 395 175 410 160 410 L 110 410 C 95 410 80 395 80 380 Z" fill="url(#gradC1_f)"/>
    <path d="M 322 130 C 322 115 337 100 352 100 L 402 100 C 417 100 432 115 432 130 L 432 380 C 432 395 417 410 402 410 L 352 410 C 337 410 322 395 322 380 Z" fill="url(#gradC1_f)"/>
    <path d="M 50 370 L 195 240 L 290 310 L 435 110" fill="none" stroke="url(#gradCArrow_f)" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="475,80 405,100 445,160" fill="#10B981"/>
    <circle cx="256" cy="256" r="42" fill="#FFFFFF"/>
    <text x="256" y="272" font-family="sans-serif" font-size="44" font-weight="900" fill="#026F39" text-anchor="middle">₹</text>
  </g>

  <text x="390" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="106" font-weight="900" fill="#0F172A" letter-spacing="-2">Hisaab<tspan fill="#026F39">Pro</tspan></text>
  <text x="395" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="28" font-weight="700" fill="#64748B" letter-spacing="6">GROWTH &amp; CASH FLOW</text>
</svg>`

// 4. OPTION D: Integrated 'HP' Digital Seal
const svgOptionDIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gradD1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradD2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#84CC16"/>
    </linearGradient>
    <filter id="shadowD" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#026F39" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Outer Concentric Ledger Rings -->
  <circle cx="256" cy="256" r="215" fill="none" stroke="url(#gradD1)" stroke-width="26" filter="url(#shadowD)"/>
  <circle cx="256" cy="256" r="175" fill="none" stroke="url(#gradD2)" stroke-width="12" stroke-dasharray="24 16"/>

  <!-- Circular Base -->
  <circle cx="256" cy="256" r="148" fill="#F0FDF4"/>

  <!-- Integrated HP Monogram -->
  <!-- Left leg of H -->
  <rect x="175" y="170" width="34" height="172" rx="14" fill="url(#gradD1)"/>
  <!-- Central crossbar -->
  <rect x="175" y="240" width="105" height="32" rx="10" fill="url(#gradD1)"/>
  <!-- Middle bar (Right of H / Stem of P) -->
  <rect x="250" y="150" width="34" height="212" rx="14" fill="url(#gradD1)"/>
  <!-- Loop of P -->
  <path d="M 270 150 C 330 150 355 180 355 215 C 355 250 330 275 270 275 Z" fill="none" stroke="url(#gradD2)" stroke-width="32" stroke-linecap="round"/>
</svg>`

const svgOptionDFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="gradD1_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#026F39"/>
    </linearGradient>
    <linearGradient id="gradD2_f" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#84CC16"/>
    </linearGradient>
  </defs>

  <g transform="translate(60, 40) scale(0.62)">
    <circle cx="256" cy="256" r="215" fill="none" stroke="url(#gradD1_f)" stroke-width="26"/>
    <circle cx="256" cy="256" r="175" fill="none" stroke="url(#gradD2_f)" stroke-width="12" stroke-dasharray="24 16"/>
    <circle cx="256" cy="256" r="148" fill="#F0FDF4"/>
    <rect x="175" y="170" width="34" height="172" rx="14" fill="url(#gradD1_f)"/>
    <rect x="175" y="240" width="105" height="32" rx="10" fill="url(#gradD1_f)"/>
    <rect x="250" y="150" width="34" height="212" rx="14" fill="url(#gradD1_f)"/>
    <path d="M 270 150 C 330 150 355 180 355 215 C 355 250 330 275 270 275 Z" fill="none" stroke="url(#gradD2_f)" stroke-width="32" stroke-linecap="round"/>
  </g>

  <text x="390" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="106" font-weight="900" fill="#0F172A" letter-spacing="-2">Hisaab<tspan fill="#026F39">Pro</tspan></text>
  <text x="395" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="28" font-weight="700" fill="#64748B" letter-spacing="6">TRUSTED DIGITAL ACCOUNTING</text>
</svg>`

// 5. Rounded App Icon Badge (Option A on Premium Emerald Background)
const svgAppIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="50%" stop-color="#026F39"/>
      <stop offset="100%" stop-color="#024D28"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#BEF264"/>
      <stop offset="100%" stop-color="#22C55E"/>
    </linearGradient>
  </defs>

  <!-- Background Squircle -->
  <rect x="0" y="0" width="512" height="512" rx="115" fill="url(#bgGrad)"/>
  
  <!-- Subtle Grid Accent -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.08"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.06"/>

  <g transform="translate(45, 45) scale(0.82)">
    <!-- Left Pillar of H -->
    <rect x="80" y="70" width="70" height="372" rx="22" fill="#FFFFFF"/>
    
    <!-- Right Pillar of H -->
    <path d="M 362 170 L 362 420 C 362 432 352 442 340 442 L 314 442 C 302 442 292 432 292 420 L 292 170 Z" fill="#FFFFFF"/>
    
    <!-- Top Growth Arrow -->
    <path d="M 327 65 L 420 170 L 234 170 Z" fill="url(#goldGrad)"/>
    
    <!-- Rupee Bars -->
    <rect x="80" y="215" width="282" height="42" rx="12" fill="url(#goldGrad)"/>
    <rect x="130" y="275" width="200" height="36" rx="10" fill="#FFFFFF"/>
    
    <!-- Diagonal Leg -->
    <path d="M 230 257 Q 310 280 345 375 L 305 390 Q 275 315 220 295 Z" fill="#FFFFFF"/>
    <circle cx="327" cy="112" r="14" fill="#064E3B"/>
  </g>
</svg>`

const items = [
  { name: 'hisaabpro-logo-option-a.svg', png: 'hisaabpro-logo-option-a.png', svg: svgOptionAIcon, width: 1024, height: 1024 },
  { name: 'hisaabpro-logo-option-a-full.svg', png: 'hisaabpro-logo-option-a-full.png', svg: svgOptionAFull, width: 1200, height: 400 },
  { name: 'hisaabpro-logo-option-b.svg', png: 'hisaabpro-logo-option-b.png', svg: svgOptionBIcon, width: 1024, height: 1024 },
  { name: 'hisaabpro-logo-option-b-full.svg', png: 'hisaabpro-logo-option-b-full.png', svg: svgOptionBFull, width: 1200, height: 400 },
  { name: 'hisaabpro-logo-option-c.svg', png: 'hisaabpro-logo-option-c.png', svg: svgOptionCIcon, width: 1024, height: 1024 },
  { name: 'hisaabpro-logo-option-c-full.svg', png: 'hisaabpro-logo-option-c-full.png', svg: svgOptionCFull, width: 1200, height: 400 },
  { name: 'hisaabpro-logo-option-d.svg', png: 'hisaabpro-logo-option-d.png', svg: svgOptionDIcon, width: 1024, height: 1024 },
  { name: 'hisaabpro-logo-option-d-full.svg', png: 'hisaabpro-logo-option-d-full.png', svg: svgOptionDFull, width: 1200, height: 400 },
  { name: 'hisaabpro-app-icon.svg', png: 'hisaabpro-app-icon.png', svg: svgAppIcon, width: 1024, height: 1024 },
]

async function generate() {
  console.log('Writing SVGs...')
  for (const item of items) {
    fs.writeFileSync(path.join(LOGO_DIR, item.name), item.svg)
    fs.writeFileSync(path.join(ARTIFACT_DIR, item.name), item.svg)
  }

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage()

  for (const item of items) {
    const pngPath = path.join(LOGO_DIR, item.png)
    const artifactPngPath = path.join(ARTIFACT_DIR, item.png)

    await page.setViewportSize({ width: item.width, height: item.height })
    await page.setContent(`<!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: transparent; display: flex; align-items: center; justify-content: center; width: ${item.width}px; height: ${item.height}px; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${item.svg}
        </body>
      </html>
    `)

    await page.screenshot({ path: pngPath, omitBackground: true })
    fs.copyFileSync(pngPath, artifactPngPath)
    console.log(`Generated: ${item.png} (${item.width}x${item.height})`)
  }

  await browser.close()
  console.log('All PNG and SVG logos successfully generated!')
}

generate().catch((e) => {
  console.error(e)
  process.exit(1)
})
