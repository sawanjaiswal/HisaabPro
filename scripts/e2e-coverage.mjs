#!/usr/bin/env node
/**
 * E2E coverage gate.
 *
 * Derives the FULL testable surface from code (never from a hand-written list,
 * which goes stale):
 *   - every FE route in src/config/routes.config.ts
 *   - every Express endpoint under server/src/routes/**
 *
 * Every derived module must be claimed by a suite in e2e/coverage-map.json,
 * and every claimed suite must actually exist in docs/E2E_TEST_PLAN.md.
 *
 * Usage:
 *   node scripts/e2e-coverage.mjs            # gate: exit 1 if anything unmapped
 *   node scripts/e2e-coverage.mjs --init     # print the module list as JSON skeleton
 *   node scripts/e2e-coverage.mjs --matrix   # regenerate docs/E2E_COVERAGE_MATRIX.md
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ROUTES_TS = path.join(ROOT, 'src/config/routes.config.ts')
const SERVER_ROUTES = path.join(ROOT, 'server/src/routes')
const MAP_FILE = path.join(ROOT, 'e2e/coverage-map.json')
const PLAN_FILE = path.join(ROOT, 'docs/E2E_TEST_PLAN.md')
const MATRIX_FILE = path.join(ROOT, 'docs/E2E_COVERAGE_MATRIX.md')

// ─── FE routes ───────────────────────────────────────────────────────────────

export function readFeRoutes() {
  const src = fs.readFileSync(ROUTES_TS, 'utf8')
  return [...src.matchAll(/^ {2}([A-Z0-9_]+):\s*'([^']+)'/gm)].map((m) => ({
    key: m[1],
    routePath: m[2],
    module: feModule(m[2]),
  }))
}

/** Module = first path segment, with settings/* and nested groups split out. */
function feModule(p) {
  const segs = p.split('/').filter(Boolean)
  if (segs.length === 0) return 'landing'
  const head = segs[0]
  if (head === 'settings' && segs[1] && !segs[1].startsWith(':')) return `settings/${segs[1]}`
  if (['reports', 'accounting', 'gst', 'marketing', 'hr', 'sales', 'inventory', 'admin', 'public', 'crm', 'notifications', 'commission']
    .includes(head) && segs[1] && !segs[1].startsWith(':')) {
    return `${head}/${segs[1]}`
  }
  return head
}

// ─── Server endpoints ────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
      out.push(p)
    }
  }
  return out
}

export function readApiEndpoints() {
  const out = []
  for (const file of walk(SERVER_ROUTES)) {
    const src = fs.readFileSync(file, 'utf8')
    const rel = path.relative(ROOT, file)
    // Router instances are not always named `router` — collect every
    // `const X = Router()` / `export const X = Router()` binding in the file.
    const names = new Set(
      [...src.matchAll(/(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*Router\(/g)].map((m) => m[1]),
    )
    if (names.size === 0) names.add('router')
    const verbs = '(?:get|post|put|patch|delete)'
    const re = new RegExp(`\\b(${[...names].join('|')})\\.(${verbs})\\(\\s*['"\`]([^'"\`]+)`, 'g')
    for (const m of [...src.matchAll(re)].map((x) => [x[0], x[2], x[3]])) {
      out.push({
        method: m[1].toUpperCase(),
        endpoint: m[2],
        file: rel,
        module: apiModule(rel),
      })
    }
  }
  return out
}

/** Module = the route file's directory (when grouped) or its basename. */
function apiModule(rel) {
  const parts = rel.replace('server/src/routes/', '').split('/')
  if (parts.length > 1) return `api:${parts[0]}`
  return `api:${parts[0].replace(/\.(routes?)?\.ts$/, '').replace(/\.ts$/, '')}`
}

// ─── Non-HTTP surfaces (background jobs, middleware, data model) ─────────────

const JOBS_DIR = path.join(ROOT, 'server/src/jobs')
const MW_DIR = path.join(ROOT, 'server/src/middleware')
const SCHEMA = path.join(ROOT, 'server/prisma/schema.prisma')

/** Cron / worker entrypoints — they mutate data with no HTTP request behind them. */
export function readJobs() {
  if (!fs.existsSync(JOBS_DIR)) return []
  return fs
    .readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => ({ name: f, module: `job:${f.replace(/\.(cron|job)?\.ts$/, '')}` }))
}

/** Cross-cutting request middleware — the security + correctness spine. */
export function readMiddleware() {
  if (!fs.existsSync(MW_DIR)) return []
  return fs
    .readdirSync(MW_DIR)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => ({ name: f, module: `mw:${f.replace(/\.ts$/, '')}` }))
}

/** Prisma models — the real entity surface the §20 matrix must run against. */
export function readModels() {
  if (!fs.existsSync(SCHEMA)) return []
  const src = fs.readFileSync(SCHEMA, 'utf8')
  return [...src.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)].map((m) => ({
    name: m[1],
    module: `model:${m[1]}`,
  }))
}

// ─── Gate ────────────────────────────────────────────────────────────────────

function loadMap() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`✗ missing ${path.relative(ROOT, MAP_FILE)} — run with --init`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
}

function planSuites() {
  const plan = fs.readFileSync(PLAN_FILE, 'utf8')
  return new Set([...plan.matchAll(/TC-([A-Z0-9]+)-\d+/g)].map((m) => `TC-${m[1]}`))
}

function main() {
  const arg = process.argv[2]
  const fe = readFeRoutes()
  const api = readApiEndpoints()
  const jobs = readJobs()
  const mw = readMiddleware()
  const models = readModels()
  const modules = [
    ...new Set([
      ...fe.map((r) => r.module),
      ...api.map((e) => e.module),
      ...jobs.map((j) => j.module),
      ...mw.map((m) => m.module),
      ...models.map((m) => m.module),
    ]),
  ].sort()

  if (arg === '--init') {
    const skeleton = Object.fromEntries(modules.map((m) => [m, { suite: '', note: 'TODO' }]))
    console.log(JSON.stringify(skeleton, null, 2))
    return
  }

  const map = loadMap()
  const suites = planSuites()

  const unmapped = modules.filter((m) => !map[m] || !map[m].suite)
  const badSuite = modules
    .filter((m) => map[m]?.suite && map[m].suite !== 'OUT_OF_SCOPE')
    .filter((m) => !suites.has(map[m].suite))
  const stale = Object.keys(map).filter((m) => !modules.includes(m))

  console.log(`FE routes:      ${fe.length}`)
  console.log(`API endpoints:  ${api.length}`)
  console.log(`Cron/jobs:      ${jobs.length}`)
  console.log(`Middleware:     ${mw.length}`)
  console.log(`Prisma models:  ${models.length}`)
  console.log(`Modules:        ${modules.length}`)
  console.log(`Mapped:         ${modules.length - unmapped.length}`)
  console.log(`Out of scope:   ${modules.filter((m) => map[m]?.suite === 'OUT_OF_SCOPE').length}`)

  if (arg === '--matrix') {
    writeMatrix(fe, api, map, modules)
    console.log(`\n✓ wrote ${path.relative(ROOT, MATRIX_FILE)}`)
  }

  let failed = false
  if (unmapped.length) {
    failed = true
    console.error(`\n✗ ${unmapped.length} module(s) have NO test suite:`)
    unmapped.forEach((m) => console.error(`    ${m}`))
  }
  if (badSuite.length) {
    failed = true
    console.error(`\n✗ ${badSuite.length} module(s) claim a suite absent from E2E_TEST_PLAN.md:`)
    badSuite.forEach((m) => console.error(`    ${m} → ${map[m].suite}`))
  }
  if (stale.length) {
    failed = true
    console.error(`\n✗ ${stale.length} stale map entr(ies) — module no longer exists:`)
    stale.forEach((m) => console.error(`    ${m}`))
  }

  if (failed) process.exit(1)
  console.log('\n✓ every module is claimed by a suite that exists in the plan')
}

// ─── Matrix doc ──────────────────────────────────────────────────────────────

function writeMatrix(fe, api, map, modules) {
  const L = []
  L.push('# E2E Coverage Matrix — GENERATED, do not hand-edit')
  L.push('')
  L.push('> Regenerate: `node scripts/e2e-coverage.mjs --matrix`')
  L.push('> Gate: `node scripts/e2e-coverage.mjs` (exit 1 if any module is unmapped)')
  L.push('>')
  L.push('> Every FE route and every API endpoint in the codebase appears below,')
  L.push('> mapped to the suite in `docs/E2E_TEST_PLAN.md` that tests it.')
  L.push('')
  L.push(`| | Count |`)
  L.push(`|---|---|`)
  L.push(`| FE routes | ${fe.length} |`)
  L.push(`| API endpoints | ${api.length} |`)
  L.push(`| Modules | ${modules.length} |`)
  L.push('')
  L.push('---')
  L.push('')
  L.push('## Frontend routes')
  L.push('')
  L.push('| Module | Suite | Route | Key |')
  L.push('|---|---|---|---|')
  for (const r of fe.slice().sort((a, b) => a.module.localeCompare(b.module) || a.routePath.localeCompare(b.routePath))) {
    L.push(`| ${r.module} | ${map[r.module]?.suite ?? '**UNMAPPED**'} | \`${r.routePath}\` | ${r.key} |`)
  }
  L.push('')
  L.push('## API endpoints')
  L.push('')
  L.push('| Module | Suite | Method | Path | File |')
  L.push('|---|---|---|---|---|')
  for (const e of api.slice().sort((a, b) => a.module.localeCompare(b.module) || a.file.localeCompare(b.file))) {
    L.push(`| ${e.module} | ${map[e.module]?.suite ?? '**UNMAPPED**'} | ${e.method} | \`${e.endpoint}\` | \`${e.file}\` |`)
  }
  L.push('')
  fs.writeFileSync(MATRIX_FILE, L.join('\n'))
}

main()
