#!/usr/bin/env node

/**
 * enforce-primitives.mjs — Mechanical gate for component-primitive adoption.
 *
 * See docs/audit/DESIGN_AUDIT_SUMMARY.md (P0) for the rationale. The design
 * audit found ~640 files of raw-HTML deviation accrued precisely because
 * enforce.js had no check banning raw interactive primitives. This ratchet
 * grandfathers the existing debt and blocks NEW raw primitives in feature code,
 * so the "Premium Standardization" epic's gains become permanent instead of
 * decaying as new pages reinvent buttons/inputs.
 *
 * Checks (each RATCHETED — current count must be <= baseline):
 *   1. rawButton   — <button> in feature code   → use <Button>
 *   2. rawInput    — <input> in feature code     → use <Input> (rupee-field exception aside)
 *   3. rawSelect   — <select> in feature code    → use <Select> (P1)
 *   4. rawTextarea — <textarea> in feature code  → use <Textarea>/<Input>
 *   5. nativeConfirm — window.confirm / alert()   → use <ConfirmDialog> / useToast()
 *   6. missingEmptyState — list-rendering page lacking <EmptyState>
 *   7. missingErrorState — data-fetching page lacking <ErrorState>
 *
 * Baseline lives at .claude/primitives-baseline.json. Pre-commit fails when
 * current_count > baseline. Pass --ratchet to lower the baseline after a
 * migration (commit the new baseline along with the fix).
 *
 * Exit 0 = clean (count <= baseline), 1 = regression.
 * Run: node scripts/enforce-primitives.mjs            # check
 *      node scripts/enforce-primitives.mjs --ratchet  # update baseline
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const FRONTEND_SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, '.claude', 'primitives-baseline.json')
const RATCHET = process.argv.includes('--ratchet')

// Marketing / PDF / template surfaces are intentionally hand-built (they don't
// share the in-app design system) — mirror enforce.js's MARKETING_UI exemption.
// The ui-primitive directory itself MUST render raw HTML (it's the substrate).
const EXEMPT_RE = [
  /\/features\/landing\//,
  /\/components\/ui\//, // primitives themselves render raw <button>/<input> by definition
  /invoice-templates/,
  /\/pdf\//,
  /template/i,
  /__tests__|\.test\.|\.spec\./,
  /\.stories\./,
]

// confirm()/alert() are banned even inside ui/ — there is no legit raw use.
const CONFIRM_EXEMPT_RE = [/\/features\/landing\//, /__tests__|\.test\.|\.spec\./]

const PATTERNS = {
  rawButton: { re: /<button[\s>]/g, exempt: EXEMPT_RE },
  rawInput: { re: /<input[\s>]/g, exempt: EXEMPT_RE },
  rawSelect: { re: /<select[\s>]/g, exempt: EXEMPT_RE },
  rawTextarea: { re: /<textarea[\s>]/g, exempt: EXEMPT_RE },
  nativeConfirm: { re: /window\.confirm\s*\(|(?<![.\w])alert\s*\(/g, exempt: CONFIRM_EXEMPT_RE },
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, acc)
    } else if (entry.name.endsWith('.tsx')) {
      acc.push(full)
    }
  }
  return acc
}

const files = walk(FRONTEND_SRC)
const violations = {
  rawButton: [], rawInput: [], rawSelect: [], rawTextarea: [], nativeConfirm: [],
  missingEmptyState: [], missingErrorState: [],
}

// File-level checks only fire on feature pages (the in-app UI). Marketing /
// PDF / template surfaces are exempt — they don't share the 4-state pattern.
// Only page files — `Page.tsx` endings. Sub-components and rows render inside
// these pages and inherit their 4-state coverage.
const FEATURE_PAGE_RE = /\/features\/[^/]+\/(?:[^/]+\/)?[A-Z][A-Za-z0-9]*Page\.tsx$/
const STATE_EXEMPT_RE = [
  /\/features\/landing\//,
  /invoice-templates/,
  /\/pdf\//,
  /template/i,
  /__tests__|\.test\.|\.spec\./,
  /\.stories\./,
  // Form / setup / wizard pages render .map() over options or editable form
  // rows, not data lists — they have no "empty" state to begin with.
  /\/(?:Create|Edit|Record|Forgot)[A-Z][A-Za-z0-9]*Page\.tsx$/,
  /[A-Z][A-Za-z0-9]*(?:Form|Wizard|Settings|Controls|Onboarding|Edit)Page\.tsx$/,
  /\/(?:VerifyOtp|BusinessType)Page\.tsx$/,
]
// Renders a list-of-JSX: `.map(... => <Tag` or `.map(... => (` (with JSX inside).
const RENDERS_LIST_RE = /\.map\s*\(\s*\(?[^)]*\)?\s*=>\s*(?:<|\()/
// Page delegates its empty state to a *Empty subcomponent (PriceListEmpty,
// StockSummaryEmpty, CartEmpty, LedgerEmpty, etc. — themselves verified to
// render <EmptyState> by waves 4-5).
const DELEGATES_EMPTY_RE = /<[A-Z][A-Za-z0-9]*Empty\b/
// Has a fetch/query/loading lifecycle that could legitimately error.
const HAS_QUERY_RE = /useQuery|useInfiniteQuery|isError|onError|catch\s*\(/

for (const full of files) {
  const rel = relative(ROOT, full)
  const src = readFileSync(full, 'utf8')
  for (const [key, { re, exempt }] of Object.entries(PATTERNS)) {
    if (exempt.some((r) => r.test(rel))) continue
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      const local = new RegExp(re.source, 'g')
      if (local.test(line)) violations[key].push(`${rel}:${i + 1}`)
    })
  }
  // File-level 4-state coverage (feature pages only).
  if (FEATURE_PAGE_RE.test(rel) && !STATE_EXEMPT_RE.some((r) => r.test(rel))) {
    if (
      RENDERS_LIST_RE.test(src) &&
      !/EmptyState\b/.test(src) &&
      !DELEGATES_EMPTY_RE.test(src)
    ) {
      violations.missingEmptyState.push(rel)
    }
    if (HAS_QUERY_RE.test(src) && !/ErrorState\b/.test(src)) {
      violations.missingErrorState.push(rel)
    }
  }
}

const counts = Object.fromEntries(Object.entries(violations).map(([k, v]) => [k, v.length]))

let baseline = Object.fromEntries(Object.keys(counts).map((k) => [k, Infinity]))
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* fall through */ }
}

if (RATCHET) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n')
  console.log('primitives-enforce: baseline updated →', counts)
  process.exit(0)
}

const regressions = []
for (const key of Object.keys(counts)) {
  if (counts[key] > (baseline[key] ?? 0)) {
    regressions.push({ key, current: counts[key], allowed: baseline[key] ?? 0 })
  }
}

if (regressions.length === 0) {
  const summary = Object.keys(counts)
    .map((k) => `${k}=${counts[k]}/${baseline[k] ?? '∞'}`)
    .join(' ')
  console.log(`primitives-enforce: clean (${files.length} .tsx scanned, ${summary})`)
  for (const key of Object.keys(counts)) {
    if (counts[key] < (baseline[key] ?? 0)) {
      console.log(`  ↓ ${key}: ${baseline[key]} → ${counts[key]}. Run with --ratchet to lower the baseline.`)
    }
  }
  process.exit(0)
}

console.error('\nprimitives-enforce: REGRESSION — new raw primitives exceed baseline\n')
for (const reg of regressions) {
  console.error(`  ✗ ${reg.key}: ${reg.current} > ${reg.allowed} (allowed)`)
  for (const v of violations[reg.key]) console.error(`      ${v}`)
}
console.error(
  '\nUse the design-system primitive instead of raw HTML:\n' +
  '  <button>   → <Button variant=… >   (@/components/ui/Button)\n' +
  '  <input>    → <Input>               (@/components/ui/Input)\n' +
  '  <select>   → <Select>              (P1)\n' +
  '  <textarea> → <Textarea>/<Input>\n' +
  '  window.confirm/alert → <ConfirmDialog> / useToast()\n' +
  '  list .map(...) → render <EmptyState> when array is empty\n' +
  '  useQuery / fetch → render <ErrorState onRetry={...} /> on failure\n' +
  '\nIf you genuinely fixed primitives (count dropped), run:\n' +
  '  node scripts/enforce-primitives.mjs --ratchet\n'
)
process.exit(1)
