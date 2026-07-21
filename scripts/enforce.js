#!/usr/bin/env node

/**
 * enforce.js — Hard enforcement gates for HisaabPro.
 *
 * Checks:
 * 1. File length: no file > 250 lines
 * 2. TypeScript: tsc --noEmit must pass
 * 3. Soft-delete safety: no raw DELETE on protected models
 * 4. No console.log in production code (allow in tests/scripts)
 * 5. No prisma.model.delete() calls (middleware handles it, but catch bypasses)
 * 6. Offline patterns (ratcheted vs baseline)
 * 7. Section padding=0 + section-group gap=24px
 * 8. No raw hex inside CSS gradient functions
 * 9. Platform shell — no env(safe-area-inset-*) refs
 * 10. Platform shell — no raw fixed-bottom outside primitive allowlist
 * 11. Platform shell — no deprecated Android Window APIs
 *
 * Exit code 0 = pass, 1 = fail with details.
 * Run: node scripts/enforce.js [--fix]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SERVER_SRC = join(ROOT, 'server', 'src')
const FRONTEND_SRC = join(ROOT, 'src')
const MAX_LINES = 250

const errors = []
const warnings = []

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, extensions = ['.ts', '.tsx']) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue
        results.push(...walkDir(fullPath, extensions))
      } else if (extensions.includes(extname(entry.name))) {
        results.push(fullPath)
      }
    }
  } catch { /* directory doesn't exist */ }
  return results
}

function rel(filePath) {
  return relative(ROOT, filePath)
}

// ─── Check 1: File Length ─────────────────────────────────────────────────────

console.log('🔍 Check 1: File length (max %d lines)', MAX_LINES)

const allFiles = [...walkDir(SERVER_SRC), ...walkDir(FRONTEND_SRC)]
let oversized = 0

// File-length exemptions (structural — not violations):
//  - Translation dictionaries (flat key-value, splitting adds no value)
//  - Test files (describe/it blocks are inherently long; split by suite when needed)
//  - Landing / marketing UI (long-form content pages, already scoped out of design gate)
const LENGTH_EXEMPT_RE = [
  /\/lib\/translations\./,
  /\/__tests__\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\/features\/landing\//,
  /\/components\/ui\/(accordion|bento-grid|cta-section|feature|hero-|testimonial|pricing-|footer-|social-proof|invoice-templates|saa-s-template|scaled-mockup|section-with-mockup|sticky-mobile-cta|cybernetic|database-rest-api|radial-orbital|carousel|gallery-section|before-after|separator|magicui)/,
  /\/lib\/playstore-mock\./, // in-memory mock dataset for closed-testing builds
  /\/notifications\/notification-templates\.data\./, // flat title/body table per event×locale
  /\/settings\/permissions-data\./, // flat permission catalog
  /\/src\/App\.tsx$/, // root routing file — grows with every new route PR; split by feature router instead
]

for (const file of allFiles) {
  if (LENGTH_EXEMPT_RE.some((re) => re.test(file))) continue
  const content = readFileSync(file, 'utf8')
  const lineCount = content.split('\n').length
  if (lineCount > MAX_LINES) {
    errors.push(`OVERSIZED: ${rel(file)} (${lineCount} lines > ${MAX_LINES})`)
    oversized++
  }
}

if (oversized === 0) {
  console.log('  ✅ All %d files under %d lines', allFiles.length, MAX_LINES)
} else {
  console.log('  ❌ %d files exceed %d lines', oversized, MAX_LINES)
}

// ─── Check 2: TypeScript ──────────────────────────────────────────────────────

console.log('🔍 Check 2: TypeScript compilation')

try {
  execSync('npx tsc --noEmit', { cwd: join(ROOT, 'server'), stdio: 'pipe' })
  console.log('  ✅ Server TypeScript clean')
} catch (err) {
  const output = err.stdout?.toString() || err.stderr?.toString() || 'Unknown error'
  errors.push(`TSC FAILED (server):\n${output.slice(0, 500)}`)
  console.log('  ❌ Server TypeScript errors')
}

// ─── Check 3: No raw DELETE on soft-delete models ─────────────────────────────

console.log('🔍 Check 3: No raw DELETE SQL on soft-delete models')

const SOFT_DELETE_MODELS = [
  'Party', 'PartyAddress', 'PartyGroup', 'PartyPricing', 'OpeningBalance',
  'Product', 'Category', 'Unit', 'UnitConversion', 'CustomFieldDefinition',
  'Document', 'DocumentNumberSeries', 'TermsAndConditionsTemplate',
  'Payment', 'Expense', 'OtherIncome', 'Cheque', 'BankAccount',
  'LedgerAccount', 'LoanAccount', 'ExpenseCategory', 'TaxCategory',
  'RecurringInvoice', 'Role', 'StaffInvite', 'Batch', 'Godown', 'SerialNumber',
]

const serverFiles = walkDir(SERVER_SRC)
let rawDeleteCount = 0

for (const file of serverFiles) {
  // Skip the recycle-bin service (it does intentional permanent deletes)
  if (file.includes('recycle-bin.service')) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for raw DELETE SQL targeting soft-delete tables
    for (const model of SOFT_DELETE_MODELS) {
      const pattern = new RegExp(`DELETE\\s+FROM\\s+["']?${model}["']?`, 'i')
      if (pattern.test(line)) {
        errors.push(
          `RAW DELETE: ${rel(file)}:${i + 1} — DELETE FROM ${model} (use soft delete)`,
        )
        rawDeleteCount++
      }
    }
  }
}

if (rawDeleteCount === 0) {
  console.log('  ✅ No raw DELETE statements on protected models')
} else {
  console.log('  ❌ %d raw DELETE violations', rawDeleteCount)
}

// ─── Check 4: No console.log in production code ──────────────────────────────

console.log('🔍 Check 4: No console.log in production code')

let consoleCount = 0

for (const file of serverFiles) {
  // Skip test files and scripts
  if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    if (/console\.(log|debug)\(/.test(lines[i]) && !lines[i].trim().startsWith('//')) {
      warnings.push(`CONSOLE: ${rel(file)}:${i + 1} — use logger instead of console.log`)
      consoleCount++
    }
  }
}

if (consoleCount === 0) {
  console.log('  ✅ No console.log in production code')
} else {
  console.log('  ⚠️  %d console.log found (warnings)', consoleCount)
}

// ─── Check 5: Prisma hard delete guard ────────────────────────────────────────

console.log('🔍 Check 5: No direct prisma.model.delete() bypasses')

let prismaDeleteCount = 0

// Audited escape-hatch files — intentional hard deletes (recycle-bin,
// `force` flag branches, safe-when-no-deps, transactional replace).
const HARD_DELETE_EXEMPT = [
  'recycle-bin.service',
  'soft-delete',
  'document/recycle',
  'document-settings.service',
  'party/custom-fields',
  'party/groups',
  'party/update-delete',
  'recurring/crud',
  'unit/conversion.service',
]

for (const file of serverFiles) {
  if (HARD_DELETE_EXEMPT.some((p) => file.includes(p))) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const model of SOFT_DELETE_MODELS) {
      const key = model.charAt(0).toLowerCase() + model.slice(1)
      const pattern = new RegExp(`\\.(${key})\\.delete\\(`)
      if (pattern.test(line)) {
        warnings.push(
          `PRISMA DELETE: ${rel(file)}:${i + 1} — .${key}.delete() (middleware intercepts, but verify intent)`,
        )
        prismaDeleteCount++
      }
    }
  }
}

if (prismaDeleteCount === 0) {
  console.log('  ✅ No direct prisma.delete() on protected models')
} else {
  console.log('  ⚠️  %d prisma.delete() calls found (middleware intercepts, review intent)', prismaDeleteCount)
}

// ─── Check 6: Offline patterns (ratcheted) ───────────────────────────────────

console.log('🔍 Check 6: Offline patterns (no regression vs baseline)')

try {
  execSync('node scripts/enforce-offline.mjs', { cwd: ROOT, stdio: 'inherit' })
  console.log('  ✅ Offline-pattern baseline holds')
} catch {
  errors.push(
    'OFFLINE_REGRESSION: scripts/enforce-offline.mjs flagged new violations. ' +
    'See output above and .claude/rules/OFFLINE_RULES.md.',
  )
}

// ─── Check 6a2: Component-primitive adoption (ratcheted) ─────────────────────
// Design audit (docs/audit/DESIGN_AUDIT_SUMMARY.md, P0): raw <button>/<input>/
// <select>/<textarea> and window.confirm/alert in feature code accrued because
// nothing banned them. This ratchet grandfathers existing debt and blocks NEW
// raw primitives — use @/components/ui/{Button,Input,Select,Textarea} instead.
console.log('🔍 Check 6a2: Component-primitive adoption (no regression vs baseline)')
try {
  execSync('node scripts/enforce-primitives.mjs', { cwd: ROOT, stdio: 'inherit' })
  console.log('  ✅ Component-primitive baseline holds')
} catch {
  errors.push(
    'PRIMITIVE_REGRESSION: scripts/enforce-primitives.mjs flagged new raw HTML primitives. ' +
    'See output above and docs/audit/DESIGN_AUDIT_SUMMARY.md (P0).',
  )
}

// ─── Check 6b: Audit coverage SSOT (BLOCKING — PR7 flipped from report-only)
// Every service listed in server/src/lib/audit/audit-coverage.ts must contain a
// `tx.auditLog.create(` or `prisma.auditLog.create(` call (PR7 backfill landed).
// See ARCHITECTURE_PHASE6_STAFF_HR §7 + §18.4.
console.log('🔍 Check 6b: Audit coverage SSOT (blocking)')
try {
  execSync('node scripts/enforce-audit-coverage.mjs --block', { cwd: ROOT, stdio: 'inherit' })
  console.log('  ✅ Audit-coverage SSOT: all services write audit')
} catch {
  errors.push('AUDIT_COVERAGE_VIOLATION: scripts/enforce-audit-coverage.mjs --block reported missing audit-writes.')
}

// ─── Check 6c: ban Promise.all inside commit-payments/** ─────────────────────
//
// Phase 7 · 7.1D PR-D4. The payments commit ladder is strictly sequential
// inside the surrounding $transaction: every row touches Document.balanceDue
// via Σ(Allocation.amount) ≤ outstanding, and the over-allocation guard
// re-aggregates allocations per row. Running rows in parallel (Promise.all
// on `tx`) would (a) hand the same tx client to concurrent awaiters which
// Prisma forbids, and (b) race the Σ-overflow check across rows so the
// last-write-wins pattern silently overshoots Document.balanceDue. Keep
// the ladder sequential; if a perf win is needed it lives at the chunk
// boundary (multiple chunks in parallel), not at the row boundary.
console.log('🔍 Check 6c: ban Promise.all in commit-payments/**')
{
  const COMMIT_PAYMENTS_DIR = join(SERVER_SRC, 'services', 'import', 'commit-payments')
  let promiseAllViolations = 0
  if (existsSync(COMMIT_PAYMENTS_DIR)) {
    const files = walkDir(COMMIT_PAYMENTS_DIR, ['.ts'])
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // Match `Promise.all(` and `Promise.allSettled(` — same race surface.
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]
        if (/\bPromise\.(all|allSettled)\s*\(/.test(line)) {
          // Allow inside line-comments only ("NEVER Promise.all" docs).
          if (/^\s*\*|^\s*\/\//.test(line)) continue
          errors.push(
            `COMMIT_PAYMENTS_PROMISE_ALL: ${rel(file)}:${i + 1} — Promise.all is banned inside commit-payments/** ` +
              `(Σ-overflow + tx-sequential invariant, PR-D4). Iterate rows sequentially with for-of/await.`,
          )
          promiseAllViolations += 1
        }
      }
    }
  }
  if (promiseAllViolations === 0) {
    console.log('  ✅ commit-payments/** is Promise.all-free')
  } else {
    console.log(`  ❌ ${promiseAllViolations} Promise.all violation(s) in commit-payments/**`)
  }
}

// ─── Check 7: Section layout — padding=0 and gap=24px ────────────────────────
//
// Every UI section container (className matches /-section\b|\bsection-|__section\b/)
// must have vertical padding of 0. Parents stacking sections must use
// `space-y-6` / `gap-6` (= 24px = var(--space-6)). See .claude/skills/hp-design.

console.log('🔍 Check 7: Section padding=0 + section-group gap=24px')

const SECTION_CLASS_RE = /-section\b|\bsection-|__section\b/
const SECTION_PADDING_RE = /\b(?:pt|pb|py)-(?!0\b)\d/
const SECTION_GROUP_RE = /-sections\b|section-group\b|__sections\b/
const SECTION_GROUP_WRONG_GAP_RE = /\b(?:space-y|gap)-(?:0|1|2|3|4|5|8|10|12)\b/
const INLINE_PADDING_Y_RE = /style=\{[^}]*(?:paddingTop|paddingBottom):\s*["']?(?!0\b)\d/

let sectionViolations = 0

for (const file of walkDir(FRONTEND_SRC, ['.tsx'])) {
  if (file.includes('__tests__') || file.endsWith('.test.tsx')) continue
  // Landing / marketing components are exempt (see SESSION_GATE.exemptPathPatterns).
  if (file.includes('/features/landing/')) continue
  if (/\/components\/ui\/(accordion|bento-grid|cta-section|feature|hero-|testimonial|pricing-|footer-|social-proof|invoice-templates|saa-s-template|scaled-mockup|section-with-mockup|sticky-mobile-cta|cybernetic|database-rest-api|radial-orbital|carousel|gallery-section|before-after|separator|magicui)/.test(file)) continue

  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('enforce-ignore')) continue

    const classMatch = line.match(/className=["']([^"']+)["']/)
    if (classMatch) {
      const cls = classMatch[1]
      if (SECTION_CLASS_RE.test(cls) && SECTION_PADDING_RE.test(cls)) {
        warnings.push(`SECTION_PADDING: ${rel(file)}:${i + 1} — section container has non-zero py/pt/pb. Move inner padding to a CHILD element.`)
        sectionViolations++
      }
      if (SECTION_GROUP_RE.test(cls) && SECTION_GROUP_WRONG_GAP_RE.test(cls)) {
        warnings.push(`SECTION_GAP: ${rel(file)}:${i + 1} — section group must stack with \`space-y-6\` or \`gap-6\` (24px).`)
        sectionViolations++
      }
    }
    if (INLINE_PADDING_Y_RE.test(line)) {
      warnings.push(`SECTION_INLINE_PADDING_Y: ${rel(file)}:${i + 1} — inline paddingTop/Bottom detected; section elements must be 0.`)
      sectionViolations++
    }
  }
}

if (sectionViolations === 0) {
  console.log('  ✅ Section padding + gap rules clean')
} else {
  console.log(`  ⚠️  ${sectionViolations} section-layout warnings (see below)`)
}

// ─── Check 8: No raw hex inside CSS gradient functions ────────────────────────
//
// Gradients in component CSS must use design tokens. Raw hex bypasses the
// theme system and breaks dark mode. Token files (`tokens-*.css`) and landing
// surfaces are exempt — those define values or are marketing-only.

console.log('🔍 Check 8: No raw hex in CSS gradient functions')

const GRADIENT_HEX_RE = /(linear|radial|conic)-gradient\([^)]*#[0-9a-fA-F]{3,8}/
let gradientHexCount = 0

for (const file of walkDir(FRONTEND_SRC, ['.css'])) {
  if (/\/tokens-/.test(file)) continue
  if (file.includes('/features/landing/')) continue

  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('enforce-ignore')) continue
    if (GRADIENT_HEX_RE.test(lines[i])) {
      errors.push(
        `GRADIENT_HEX: ${rel(file)}:${i + 1} — gradient uses raw hex, use var(--color-*) tokens`,
      )
      gradientHexCount++
    }
  }
}

if (gradientHexCount === 0) {
  console.log('  ✅ No raw hex in CSS gradients')
} else {
  console.log(`  ❌ ${gradientHexCount} gradient(s) with raw hex`)
}

// ─── Check 9: Platform shell — safe-area inset access is primitive-only ──────
//
// Edge-to-edge model: Capacitor injects --safe-area-inset-{top,right,bottom,
// left} on documentElement when viewport-fit=cover is set. ONLY platform
// primitives (header, BottomNav, drawers, side-nav) may consume those vars
// and pad themselves. Feature code lives between the padded primitives and
// must never reference safe-area insets — neither raw env() (which is the
// iOS-native form Capacitor does NOT inject on Android) nor var(--safe-area-
// inset-*). SSOT: .claude/rules/PLATFORM_SHELL.md.

console.log('🔍 Check 9: Safe-area access is primitive-only')

const SAFE_AREA_ENV_RE = /env\(\s*safe-area-inset-/
const SAFE_AREA_VAR_RE = /var\(\s*--safe-area-inset-/

const SAFE_AREA_PRIMITIVE_ALLOWLIST = [
  /\/components\/layout\/BottomNav\.css$/,
  /\/components\/layout\/side-nav\.css$/,
  /\/components\/layout\/public-shell\.css$/, // PublicShell — layout primitive for /p/* surface
  /\/components\/ui\/drawer-content\.css$/,
  /\/components\/ui\/drawer-panel\.css$/,
  /\/components\/ui\/bulk-action-bar\.css$/,
  /\/components\/ui\/bottom-action-bar\.css$/,
  /\/components\/ui\/sticky-mobile-cta\./,
  /\/components\/feedback\//,
  /\/styles\/tokens-/,
  /\/styles\/components-/,
  /\/features\/landing\//,
]

let safeAreaCount = 0

for (const file of [...walkDir(FRONTEND_SRC, ['.css']), ...walkDir(FRONTEND_SRC, ['.tsx', '.ts'])]) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const isPrimitive = SAFE_AREA_PRIMITIVE_ALLOWLIST.some((re) => re.test(file))
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.includes('enforce-ignore')) continue
    // env(safe-area-inset-*) is banned everywhere — Capacitor injects var(),
    // not env(). Using env() on Android yields 0 (silent no-op).
    if (SAFE_AREA_ENV_RE.test(ln)) {
      errors.push(
        `PLATFORM_SHELL_SAFE_AREA_ENV: ${rel(file)}:${i + 1} — env(safe-area-inset-*) banned. Use var(--safe-area-inset-*) inside platform primitives only (see .claude/rules/PLATFORM_SHELL.md).`,
      )
      safeAreaCount++
      continue
    }
    // var(--safe-area-inset-*) only allowed in platform primitives.
    if (SAFE_AREA_VAR_RE.test(ln) && !isPrimitive) {
      errors.push(
        `PLATFORM_SHELL_SAFE_AREA_VAR: ${rel(file)}:${i + 1} — var(--safe-area-inset-*) is primitive-only. Feature code consumes already-padded primitives (see .claude/rules/PLATFORM_SHELL.md).`,
      )
      safeAreaCount++
    }
  }
}

if (safeAreaCount === 0) {
  console.log('  ✅ Safe-area access confined to platform primitives')
} else {
  console.log(`  ❌ ${safeAreaCount} safe-area violation(s)`)
}

// ─── Check 10: Platform shell — fixed-bottom allowlist ────────────────────────
//
// Only the platform-primitive CSS files own the bottom edge of the viewport.
// Feature CSS that reaches for `position: fixed; bottom: 0` is duplicating
// the bottom-bar pattern and should consume <BottomActionBar> / <Drawer>.

console.log('🔍 Check 10: Fixed-bottom only in platform primitives')

const FIXED_BOTTOM_ALLOWLIST = [
  /\/components\/layout\/BottomNav\.css$/,
  /\/components\/layout\/side-nav-rail\.css$/,
  /\/components\/ui\/drawer-panel\.css$/,
  /\/components\/ui\/drawer-content\.css$/,
  /\/components\/ui\/bulk-action-bar\.css$/,
  /\/components\/ui\/bottom-action-bar\.css$/,
  /\/components\/ui\/sticky-mobile-cta\./, // landing-only marketing CTA
  /\/components\/feedback\/sw-update-prompt\.css$/,
  /\/components\/feedback\/feedback-widget\.css$/,
  /\/styles\/components-/,
  /\/features\/landing\//,
]

// Phase 3 is complete: every feature save bar is on <BottomActionBar> and every
// bottom sheet is on <Drawer>. The debt set is empty and stays empty — raw
// fixed-bottom in feature CSS is now a hard error with no grandfathering.
const FIXED_BOTTOM_PHASE3_DEBT = new Set([])

let fixedBottomCount = 0
const allCss = walkDir(FRONTEND_SRC, ['.css'])

for (const file of allCss) {
  if (FIXED_BOTTOM_ALLOWLIST.some((re) => re.test(file))) continue
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  let inBlock = false
  let hasFixed = false
  let hasBottomZero = false
  let blockStart = 0
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.includes('enforce-ignore')) continue
    if (ln.includes('{')) { inBlock = true; hasFixed = false; hasBottomZero = false; blockStart = i + 1 }
    if (inBlock) {
      if (/position:\s*fixed/.test(ln)) hasFixed = true
      if (/^\s*bottom:\s*0/.test(ln)) hasBottomZero = true
    }
    if (ln.includes('}') && inBlock) {
      if (hasFixed && hasBottomZero) {
        const relPath = rel(file)
        const msg = `PLATFORM_SHELL_FIXED_BOTTOM: ${relPath}:${blockStart} — raw 'position:fixed; bottom:0' outside primitive allowlist. Use <BottomActionBar> / <Drawer> (see .claude/rules/PLATFORM_SHELL.md).`
        if (FIXED_BOTTOM_PHASE3_DEBT.has(relPath)) {
          warnings.push(msg + ' [Phase 3 debt — migrating to <BottomActionBar>]')
        } else {
          errors.push(msg)
          fixedBottomCount++
        }
      }
      inBlock = false
    }
  }
}

if (fixedBottomCount === 0) {
  console.log('  ✅ No raw fixed-bottom outside primitives')
} else {
  console.log(`  ❌ ${fixedBottomCount} raw fixed-bottom block(s)`)
}

// ─── Check 11: Platform shell — deprecated Android Window APIs ────────────────
//
// Android 15 deprecates setStatusBarColor / setNavigationBarColor /
// setDecorFitsSystemWindows. Our model never calls them — config + styles only.

console.log('🔍 Check 11: No deprecated Android Window APIs in MainActivity')

const ANDROID_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'java')
const DEPRECATED_RE = /(setStatusBarColor|setNavigationBarColor|setDecorFitsSystemWindows|getStatusBarColor)/
let deprecatedCount = 0

const javaFiles = []
function walkJava(dir) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walkJava(full)
      else if (entry.name.endsWith('.java') || entry.name.endsWith('.kt')) javaFiles.push(full)
    }
  } catch {}
}
walkJava(ANDROID_DIR)

for (const file of javaFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (DEPRECATED_RE.test(lines[i])) {
      errors.push(
        `PLATFORM_SHELL_DEPRECATED_API: ${rel(file)}:${i + 1} — ${lines[i].match(DEPRECATED_RE)[0]} is deprecated in Android 15. Configure via styles.xml + capacitor.config.ts only.`,
      )
      deprecatedCount++
    }
  }
}

if (deprecatedCount === 0) {
  console.log('  ✅ No deprecated Android Window APIs')
} else {
  console.log(`  ❌ ${deprecatedCount} deprecated API call(s)`)
}

// ─── Check 12: Platform shell — sticky/fixed top:0 only in primitives ─────────
//
// Status-bar inset is owned by the .header / .side-nav-header / drawer-top
// primitives. A feature CSS file pinning a custom bar to top:0 (sticky or
// fixed) bypasses --header-safe-inset and renders content under the OS
// status bar on edge-to-edge Android. Mirror of check 10 (fixed-bottom).

console.log('🔍 Check 12: Sticky/fixed top:0 only in platform primitives')

const FIXED_TOP_ALLOWLIST = [
  /\/styles\/components-layout\.css$/,        // .header (base + variants)
  /\/components\/layout\/side-nav\.css$/,     // .side-nav-header
  /\/components\/layout\/side-nav-rail\.css$/, // SideNavRail — persistent left rail at ≥lg
  /\/components\/layout\/public-shell\.css$/, // PublicShell top-bar — public layout primitive
  /\/components\/ui\/drawer-panel\.css$/,     // drawer top edge
  /\/components\/ui\/drawer-content\.css$/,
  /\/components\/feedback\//,                 // feedback modal / SW prompt
  /\/styles\/components-/,                    // shared primitive styles
  /\/features\/landing\//,                    // marketing nav
]

// Phase 4 is complete: every feature page bar is on <Header>, and sticky
// strips below it stack with top: var(--header-height). The debt set is empty
// and stays empty — raw fixed/sticky top:0 in feature CSS is a hard error.
const FIXED_TOP_PHASE4_DEBT = new Set([])

let fixedTopCount = 0

for (const file of allCss) {
  if (FIXED_TOP_ALLOWLIST.some((re) => re.test(file))) continue
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  let inBlock = false
  let hasFixedOrSticky = false
  let hasTopZero = false
  let blockStart = 0
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.includes('enforce-ignore')) continue
    if (ln.includes('{')) { inBlock = true; hasFixedOrSticky = false; hasTopZero = false; blockStart = i + 1 }
    if (inBlock) {
      if (/position:\s*(fixed|sticky)/.test(ln)) hasFixedOrSticky = true
      if (/^\s*top:\s*0(\s|;|$)/.test(ln)) hasTopZero = true
    }
    if (ln.includes('}') && inBlock) {
      if (hasFixedOrSticky && hasTopZero) {
        const relPath = rel(file)
        const msg = `PLATFORM_SHELL_FIXED_TOP: ${relPath}:${blockStart} — raw 'position:fixed|sticky; top:0' outside primitive allowlist. Use the <Header> primitive (consumes --header-safe-inset) or stack with top: var(--header-height) (see .claude/rules/PLATFORM_SHELL.md).`
        if (FIXED_TOP_PHASE4_DEBT.has(relPath)) {
          warnings.push(msg + ' [Phase 4 debt — migrating to <Header> / header-stacked sticky]')
        } else {
          errors.push(msg)
          fixedTopCount++
        }
      }
      inBlock = false
    }
  }
}

if (fixedTopCount === 0) {
  console.log('  ✅ No raw top:0 outside primitives')
} else {
  console.log(`  ❌ ${fixedTopCount} raw top:0 block(s)`)
}

// ─── Check 13: Subscription Writer SSOT — ban direct prisma.subscription.update outside writer ──
//
// SECURITY P1-D: Only subscription.writer*.ts may call prisma.subscription.update/upsert.
// Webhook handlers, route handlers, and other services must go through applySubscriptionEvent().
// Same for prisma.subscriptionEvent.create (immutable ledger).

console.log('🔍 Check 13: Subscription Writer SSOT (no direct prisma.subscription.update outside writer)')

const WRITER_ALLOWLIST = [
  'services/subscription/subscription.writer',
  'services/subscription/subscription-admin.service',
  'services/subscription/checkout-session.service',
  'services/subscription/downgrade.service',
  'services/subscription/ensure-free-subscription',
  'services/subscription/overflow-grace.service',
  'services/subscription/cron-grace-expiry',
  'services/subscription/cron-trial-end',
]

const WRITER_BANNED_PATTERNS = [
  /prisma\.subscription\.update\s*\(/,
  /prisma\.subscription\.upsert\s*\(/,
  /prisma\.subscriptionEvent\.update\s*\(/,
  /prisma\.subscriptionEvent\.delete\s*\(/,
]

let writerViolationCount = 0

for (const file of serverFiles) {
  // Skip the writer allowlist files + test files
  const isAllowlisted = WRITER_ALLOWLIST.some((p) => file.includes(p))
  if (isAllowlisted) continue
  if (file.includes('__tests__') || file.includes('.test.')) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('//')) continue
    for (const pattern of WRITER_BANNED_PATTERNS) {
      if (pattern.test(line)) {
        errors.push(
          `WRITER_SSOT_VIOLATION: ${rel(file)}:${i + 1} — direct Subscription mutation outside writer. Use applySubscriptionEvent() instead.`,
        )
        writerViolationCount++
      }
    }
  }
}

if (writerViolationCount === 0) {
  console.log('  ✅ Subscription Writer SSOT intact')
} else {
  console.log(`  ❌ ${writerViolationCount} Writer SSOT violation(s)`)
}

// ─── Check 13b: Ledger balance writer SSOT ───────────────────────────────────
//
// LedgerAccount.balance is a verified denormalised cache of SUM(POSTED
// JournalLine via balanceDelta). Only the single writer (posting/ledger-deltas)
// may mutate it; every other path (posting, journal-entries, fy-closure,
// reconcile) routes through postLedgerDeltas/repairLedgerBalance. A second
// uncoordinated `balance` writer silently diverges the cache from the journal
// truth with no detector — exactly the SSOT hole this epic closed. chart-of-
// accounts is genesis-only (create/createMany balance:0), which this pattern
// (update/updateMany/upsert) does not match, so it needs no exception.

console.log('🔍 Check 13b: Ledger balance writer SSOT (no ledgerAccount balance writes outside posting/ledger-deltas)')

const BALANCE_WRITER_ALLOWLIST = ['services/accounting/posting/ledger-deltas']
const LEDGER_MUTATION_RE = /\.ledgerAccount\.(update|updateMany|upsert)\s*\(/
const BALANCE_FIELD_RE = /\bbalance\s*:/

let balanceWriterViolationCount = 0

for (const file of serverFiles) {
  if (BALANCE_WRITER_ALLOWLIST.some((p) => file.includes(p))) continue
  if (file.includes('__tests__') || file.includes('.test.')) continue

  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('//')) continue
    if (!LEDGER_MUTATION_RE.test(lines[i])) continue
    // A ledgerAccount mutation — flag only if its `data` touches `balance`.
    const window = lines.slice(i, i + 8).join('\n')
    if (BALANCE_FIELD_RE.test(window)) {
      errors.push(
        `LEDGER_BALANCE_WRITER_VIOLATION: ${rel(file)}:${i + 1} — direct LedgerAccount.balance mutation outside the single writer. Use postLedgerDeltas()/repairLedgerBalance() from services/accounting/posting/ledger-deltas.ts.`,
      )
      balanceWriterViolationCount++
    }
  }
}

if (balanceWriterViolationCount === 0) {
  console.log('  ✅ Ledger balance writer SSOT intact')
} else {
  console.log(`  ❌ ${balanceWriterViolationCount} ledger balance writer violation(s)`)
}

// ─── Check 14: JWT never in logs ─────────────────────────────────────────────
//
// SECURITY P1-G: Entitlement JWT must never appear in logger calls.
// Pattern bans logger.* calls with jwt/token variable names in subscription services.

console.log('🔍 Check 14: JWT not in logger calls (subscription services)')

const JWT_LOG_BAN_RE = /logger\.\w+\s*\(\s*['"`]?\w*['"`]?\s*,?\s*\{[^}]*(token|jwt|signed)[^}]*\}/i
const JWT_LOG_FILES = walkDir(join(SERVER_SRC, 'services', 'subscription'))
let jwtLogCount = 0

for (const file of JWT_LOG_FILES) {
  if (file.includes('__tests__') || file.includes('.test.')) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('enforce-ignore')) continue
    if (JWT_LOG_BAN_RE.test(lines[i])) {
      errors.push(
        `JWT_IN_LOG: ${rel(file)}:${i + 1} — JWT/token value in logger call (P1-G). Never log signed tokens.`,
      )
      jwtLogCount++
    }
  }
}

if (jwtLogCount === 0) {
  console.log('  ✅ No JWT values in subscription service logs')
} else {
  console.log(`  ❌ ${jwtLogCount} JWT-in-log violation(s)`)
}

// ─── Check 15: server-only Party fields not in input Zod schemas (M2 / #91b) ─
//
// Epic D CRM — `lastContactedAt`, `loyaltyPointsCache`, `loyaltyOptOut` are
// ONLY ever written by server-side hooks (share log, reminder dispatch,
// loyalty cache rebuild). They MUST NOT appear in any input Zod schema
// (create/update/patch) for the Party model — Pattern B `.strict()` MUST
// reject them with VALIDATION_ERROR (OWASP A01 mass-assignment).
//
// `followUpAt` IS user-mutable but ONLY via the narrow `partyPatchSchema`.
// It MUST NOT appear in `createPartySchema` or `updatePartySchema`.
//
// Heuristic: locate each `export const <name>Schema = z.object({ ... }).strict()`
// block, capture the keys it declares, and flag any forbidden key that lands
// in a known-input schema name.

console.log('🔍 Check 15: server-only Party fields blocked from input schemas (M2)')

const PARTY_SCHEMA_FILE = join(SERVER_SRC, 'schemas', 'party.schemas.ts')
const FORBIDDEN_ALL = ['lastContactedAt', 'loyaltyPointsCache', 'loyaltyOptOut']
const FORBIDDEN_NON_PATCH = ['followUpAt'] // allowed ONLY in partyPatchSchema
const INPUT_SCHEMA_NAMES = ['createPartySchema', 'updatePartySchema', 'partyPatchSchema']

let serverOnlyLeakCount = 0
try {
  const schemaSrc = readFileSync(PARTY_SCHEMA_FILE, 'utf8')
  // Split into top-level export const blocks; cheap heuristic — we only
  // inspect blocks named in INPUT_SCHEMA_NAMES.
  const blockRe = /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{([\s\S]*?)\}\)\.strict\(\)/g
  let match
  while ((match = blockRe.exec(schemaSrc)) !== null) {
    const [, name, body] = match
    if (!INPUT_SCHEMA_NAMES.includes(name)) continue
    const forbidden = name === 'partyPatchSchema'
      ? FORBIDDEN_ALL
      : [...FORBIDDEN_ALL, ...FORBIDDEN_NON_PATCH]
    for (const key of forbidden) {
      // Match key as a property name at start of line (allowing indent)
      const keyRe = new RegExp(`^\\s*${key}\\s*:`, 'm')
      if (keyRe.test(body)) {
        errors.push(
          `M2_SERVER_ONLY_FIELD_IN_INPUT_SCHEMA: ${rel(PARTY_SCHEMA_FILE)} — '${key}' must not appear in '${name}' (OWASP A01 mass-assignment; server-only field).`,
        )
        serverOnlyLeakCount++
      }
    }
  }
} catch (err) {
  warnings.push(
    `Check 15 could not read ${rel(PARTY_SCHEMA_FILE)} — ${err instanceof Error ? err.message : String(err)}`,
  )
}

if (serverOnlyLeakCount === 0) {
  console.log('  ✅ Input Party schemas reject server-only fields (lastContactedAt / loyaltyPointsCache / loyaltyOptOut; followUpAt patch-only)')
} else {
  console.log(`  ❌ ${serverOnlyLeakCount} server-only field leak(s) in input schema`)
}

// ─── Check 16: require Zod parse before `req.body` use in mutation routes ────
// Mutation handlers (POST/PUT/PATCH) that read `req.body` MUST run a Zod
// `.parse()` or `.safeParse()` (or `validate(...)` middleware) in the same
// route file. This is enforced as a RATCHET — current violations are
// snapshotted under .claude/ratchets/no-unvalidated-body.json and the count
// can only shrink. Set RATCHET_BASELINE=1 to refresh the snapshot.

console.log('\n[check 16] Routes touching req.body must validate via Zod...')

const ROUTES_DIR = join(SERVER_SRC, 'routes')
const ZOD_USE_RE = /\b(?:safeParse|\.parse\s*\(|validate\s*\(|validateBody\s*\(|requireSchema\s*\()/
const REQ_BODY_RE = /\breq\.body\b/
const MUTATION_VERB_RE = /\brouter\s*\.\s*(post|put|patch|delete)\s*\(/i

const unvalidatedBody = []
for (const file of walkDir(ROUTES_DIR)) {
  if (file.includes('__tests__') || file.endsWith('.test.ts')) continue
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch { continue }
  if (!MUTATION_VERB_RE.test(src)) continue
  if (!REQ_BODY_RE.test(src)) continue
  if (ZOD_USE_RE.test(src)) continue
  unvalidatedBody.push(rel(file))
}

const RATCHET_DIR = join(ROOT, '.claude', 'ratchets')
const ratchetFile = join(RATCHET_DIR, 'no-unvalidated-body.json')
let baseline = { count: Number.MAX_SAFE_INTEGER, files: [] }
try { baseline = JSON.parse(readFileSync(ratchetFile, 'utf8')) } catch {}

if (process.env.RATCHET_BASELINE === '1') {
  try { mkdirSync(RATCHET_DIR, { recursive: true }) } catch {}
  writeFileSync(ratchetFile, JSON.stringify({ count: unvalidatedBody.length, files: unvalidatedBody.sort() }, null, 2))
  console.log(`  📌 Baseline refreshed: ${unvalidatedBody.length} unvalidated-body route files`)
} else if (unvalidatedBody.length > baseline.count) {
  errors.push(`Check 16: unvalidated req.body in ${unvalidatedBody.length} route file(s) — baseline is ${baseline.count}. New offenders: ${unvalidatedBody.filter(f => !baseline.files.includes(f)).join(', ')}`)
} else {
  console.log(`  ✅ Unvalidated-body route files: ${unvalidatedBody.length} (baseline ${baseline.count})`)
}

// ─── Check 17: webhook routes must not JSON.stringify(req.body) before verify ─
// Razorpay/Stripe signature verification needs the RAW request body. If a
// webhook route calls JSON.stringify(req.body) before verification, the
// re-serialized form will not match the provider's HMAC and every webhook
// gets rejected — OR (worse) verification is silently bypassed.

console.log('\n[check 17] Webhook routes must not re-stringify req.body before verify...')

const WEBHOOK_FILE_RE = /(webhook|razorpay|stripe)/i
const STRINGIFY_BODY_RE = /JSON\.stringify\s*\(\s*req\.body\b/

const webhookStringifyOffenders = []
for (const file of walkDir(ROUTES_DIR)) {
  if (!WEBHOOK_FILE_RE.test(file)) continue
  if (file.includes('__tests__') || file.endsWith('.test.ts')) continue
  let src
  try { src = readFileSync(file, 'utf8') } catch { continue }
  if (STRINGIFY_BODY_RE.test(src)) {
    webhookStringifyOffenders.push(rel(file))
  }
}

if (webhookStringifyOffenders.length === 0) {
  console.log('  ✅ No webhook route re-stringifies req.body before signature verify')
} else {
  for (const f of webhookStringifyOffenders) {
    errors.push(`Check 17: webhook route ${f} calls JSON.stringify(req.body) — signature verify will fail or be bypassed`)
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60))

if (errors.length > 0) {
  console.log('\n❌ ERRORS (%d) — BLOCKING:', errors.length)
  for (const err of errors) {
    console.log('  • ' + err)
  }
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (%d):', warnings.length)
  for (const warn of warnings) {
    console.log('  • ' + warn)
  }
}

if (errors.length === 0) {
  console.log('\n✅ All enforcement checks passed.')
  process.exit(0)
} else {
  console.log('\n❌ %d blocking error(s). Fix before proceeding.', errors.length)
  process.exit(1)
}
