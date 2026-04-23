#!/usr/bin/env node

/**
 * enforce-offline.mjs — Mechanical gate for offline patterns.
 *
 * See .claude/rules/OFFLINE_RULES.md for the rules being enforced.
 *
 * Checks (each is RATCHETED — current count must be <= baseline):
 *  1. Direct fetch() in feature code     — must use api() helper
 *  2. POST/PUT/PATCH/DELETE without
 *     entityType in service files        — queue UI breaks otherwise
 *  3. localStorage.setItem in features   — use IndexedDB / sessionStorage
 *
 * Baseline lives at .claude/offline-baseline.json. Pre-commit fails when
 * current_count > baseline. Pass --ratchet to lower the baseline after
 * fixes (commit the new baseline along with the fix).
 *
 * Exit 0 = clean (count <= baseline), 1 = regression.
 * Run: node scripts/enforce-offline.mjs            # check
 *      node scripts/enforce-offline.mjs --ratchet  # update baseline
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const FRONTEND_SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, '.claude', 'offline-baseline.json')
const RATCHET = process.argv.includes('--ratchet')

const ALLOWED_RAW_FETCH = new Set([
  'src/lib/api.ts',
  'src/hooks/useOnlineStatus.ts',
  'src/serviceWorkerRegistration.ts',
  'src/lib/offline.ts',                     // queue runner — replays via fetch by design
  'src/features/invoices/invoice-share.service.ts', // exportDocument → Blob (binary); api() expects JSON
  'src/features/reports/report.service.ts', // exportReport → Blob CSV download; api() expects JSON
  'src/features/reports/finance.service.ts', // exportTally → plain-text XML; api() expects JSON
])

const SKIP_PATH_FRAGMENTS = ['__tests__', '/test/', '.test.', '.spec.', '/scripts/']

const SERVICE_FILE_RE = /\/features\/[^/]+\/[^/]+\.service\.ts$|\/features\/[^/]+\/[^/]+-crud\.service\.ts$/
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

const LOCAL_STORAGE_ALLOWED = new Set([
  'src/lib/auth.ts',
  'src/lib/translations.ts',
  'src/lib/offline.ts',                 // last-sync wall-clock timestamp only
  'src/context/ThemeContext.tsx',
  'src/context/LocaleContext.tsx',
  'src/context/LanguageContext.tsx',    // language preference — UI, not entity data; cross-tab sync via storage events
  'src/features/settings/calculator-settings.utils.ts', // calculator UI preferences (display/haptics/position)
  'src/components/feedback/useFeedbackWidget.ts',       // feedback FAB drag position — pure UI coord
  'src/hooks/biometric.utils.ts',       // WebAuthn credentialId + enrollment state — auth artefacts (not secrets)
])

function walk(dir, exts = ['.ts', '.tsx']) {
  const out = []
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'android') continue
      out.push(...walk(p, exts))
    } else if (exts.includes(extname(e.name))) {
      out.push(p)
    }
  }
  return out
}

const rel = (p) => relative(ROOT, p)
const shouldSkip = (p) => SKIP_PATH_FRAGMENTS.some((f) => rel(p).includes(f))

const violations = { rawFetch: [], mutationNoEntityType: [], localStorageWrite: [] }
const files = walk(FRONTEND_SRC)

// ─── Rule 1: raw fetch() ─────────────────────────────────────────────────────

for (const file of files) {
  if (shouldSkip(file)) continue
  const r = rel(file)
  if (ALLOWED_RAW_FETCH.has(r)) continue
  const src = readFileSync(file, 'utf8')
  const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const matches = stripped.match(/(^|[^A-Za-z0-9_$.])fetch\s*\(/g)
  if (matches && matches.length > 0) {
    violations.rawFetch.push(`${r} (${matches.length}×)`)
  }
}

// ─── Rule 2: mutations without entityType ────────────────────────────────────

for (const file of files) {
  if (shouldSkip(file)) continue
  if (!SERVICE_FILE_RE.test(rel(file))) continue
  const src = readFileSync(file, 'utf8')
  const apiCallRe = /\bapi\s*[<(]/g
  let m
  while ((m = apiCallRe.exec(src)) !== null) {
    let depth = 0
    let i = m.index + m[0].length - 1
    if (src[i] === '<') {
      while (i < src.length && src[i] !== '(') i++
      if (src[i] !== '(') continue
    }
    const start = i
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) break }
    }
    if (i >= src.length) continue
    const call = src.slice(start, i + 1)
    const upper = call.toUpperCase()
    const hasMutation = MUTATION_METHODS.some((meth) =>
      upper.includes(`'${meth}'`) || upper.includes(`"${meth}"`)
    )
    if (!hasMutation) continue
    if (!/entityType\s*:/.test(call)) {
      const lineNo = src.slice(0, m.index).split('\n').length
      violations.mutationNoEntityType.push(`${rel(file)}:${lineNo}`)
    }
  }
}

// ─── Rule 3: localStorage in features ────────────────────────────────────────

for (const file of files) {
  if (shouldSkip(file)) continue
  const r = rel(file)
  if (LOCAL_STORAGE_ALLOWED.has(r)) continue
  const src = readFileSync(file, 'utf8')
  if (/localStorage\.setItem/.test(src)) {
    violations.localStorageWrite.push(r)
  }
}

// ─── Counts vs baseline ──────────────────────────────────────────────────────

const counts = {
  rawFetch: violations.rawFetch.length,
  mutationNoEntityType: violations.mutationNoEntityType.length,
  localStorageWrite: violations.localStorageWrite.length,
}

let baseline = { rawFetch: Infinity, mutationNoEntityType: Infinity, localStorageWrite: Infinity }
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* fall through */ }
}

if (RATCHET) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n')
  console.log('offline-enforce: baseline updated →', counts)
  process.exit(0)
}

const regressions = []
for (const key of Object.keys(counts)) {
  if (counts[key] > (baseline[key] ?? 0)) {
    regressions.push({ key, current: counts[key], allowed: baseline[key] ?? 0 })
  }
}

if (regressions.length === 0) {
  console.log(
    `offline-enforce: clean (${files.length} files scanned, ` +
    `rawFetch=${counts.rawFetch}/${baseline.rawFetch ?? '∞'} ` +
    `mutationNoEntityType=${counts.mutationNoEntityType}/${baseline.mutationNoEntityType ?? '∞'} ` +
    `localStorageWrite=${counts.localStorageWrite}/${baseline.localStorageWrite ?? '∞'})`
  )
  // Hint: did the count drop? Encourage ratcheting.
  for (const key of Object.keys(counts)) {
    if (counts[key] < (baseline[key] ?? 0)) {
      console.log(`  ↓ ${key}: ${baseline[key]} → ${counts[key]}. Run with --ratchet to lower the baseline.`)
    }
  }
  process.exit(0)
}

console.error(`\noffline-enforce: REGRESSION — new violations exceed baseline\n`)
for (const reg of regressions) {
  console.error(`  ✗ ${reg.key}: ${reg.current} > ${reg.allowed} (allowed)`)
  // Show all current items so the offender is obvious in the diff
  for (const v of violations[reg.key]) console.error(`      ${v}`)
}
console.error(
  `\nNew code must follow offline patterns. See .claude/rules/OFFLINE_RULES.md.\n` +
  `If the new violation is intentional, add an exception in scripts/enforce-offline.mjs.\n`
)
process.exit(1)
