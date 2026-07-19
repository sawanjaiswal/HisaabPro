#!/usr/bin/env node
/**
 * lint-raw-client.mjs — tenant-isolation CI gate (epic file #11).
 *
 * Blocks two tenant-leak vectors that the Prisma $extends scoping layer
 * CANNOT catch at runtime (SCOPE §Failure Walkthrough B2 & B7):
 *
 *   B2 — Raw-client escape. `__basePrismaUnsafe` is the raw, UNSCOPED Prisma
 *        client. A single `__basePrismaUnsafe.invoice.findMany(...)` in feature
 *        code reads every tenant's rows. The raw client may only be referenced
 *        in a tiny allowlist of platform files (its definition site, the
 *        audit-log cron, the test mock). Anywhere else = build failure.
 *
 *   B7 — New raw SQL. `$queryRaw*` / `$executeRaw*` bypass the extension
 *        entirely. The 86 pre-existing sites are frozen in
 *        raw-sql-audit.allowlist.json (#12). This lint fails if any file
 *        exceeds its sanctioned count, or a new file introduces raw SQL.
 *        Removing raw SQL (count down) is always allowed (ratchet).
 *
 * Zero deps, pure Node. Exit 0 = clean, 1 = violations, 2 = internal error.
 * Wired into CI + .githooks/pre-commit. Reuses scoped-models' DMMF derivation
 * (via @prisma/client) only to NAME the leaking model in the B2 message.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const SERVER_SRC = join(REPO_ROOT, 'server', 'src')

/** Files permitted to touch the raw, unscoped client. Everything else is a B2 leak. */
const RAW_CLIENT_ALLOWLIST = new Set([
  'server/src/lib/prisma.ts', // defines + exports __basePrismaUnsafe, wires the audit sink
  'server/src/scripts/cron/cleanup-unscoped-log.ts', // #18 — prunes the global audit log
  'server/scripts/cron/cleanup-unscoped-log.ts', // #18 alt location
  'server/src/__tests__/setup.ts', // vitest mock stubs the export
])

const RAW_CLIENT_TOKEN = '__basePrismaUnsafe'
// Same alternation grep used to seed the baseline — counts one hit per `$...` site.
const RAW_SQL_RE = /\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)/g

// ── Walk server/src for .ts (skip tests, declaration files, node_modules) ────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

// ── Reuse scoped-models' source of truth (DMMF) to label scoped models ───────
async function loadScopedModelNames() {
  try {
    const { Prisma } = await import('@prisma/client')
    const direct = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'businessId' && f.kind === 'scalar'))
      .map((m) => m.name)
    // Child-scoped model names live in scoped-models.ts (DMMF has no FK-parent set);
    // parse the CHILD_SCOPED map keys so a raw-client hit on a child model is named too.
    let child = []
    try {
      const src = readFileSync(join(SERVER_SRC, 'lib', 'scoped-models.ts'), 'utf8')
      const block = src.slice(src.indexOf('CHILD_SCOPED'))
      child = [...block.matchAll(/\[\s*['"](\w+)['"]\s*,\s*\{\s*fk:/g)].map((m) => m[1])
    } catch {
      /* enrichment only — absence never changes the verdict */
    }
    const names = new Set([...direct, ...child])
    // camelCase delegate → PascalCase model, for `__basePrismaUnsafe.invoice` style hits
    const camelToModel = new Map()
    for (const n of names) camelToModel.set(n.charAt(0).toLowerCase() + n.slice(1), n)
    return camelToModel
  } catch {
    return new Map() // DMMF unavailable (client not generated) → B2 still gates by file
  }
}

const violations = []
const notes = []

// ── Check B2: raw-client escape ──────────────────────────────────────────────
async function checkRawClient(files) {
  const camelToModel = await loadScopedModelNames()
  for (const full of files) {
    const rel = relative(REPO_ROOT, full)
    if (RAW_CLIENT_ALLOWLIST.has(rel)) continue
    const text = readFileSync(full, 'utf8')
    if (!text.includes(RAW_CLIENT_TOKEN)) continue
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      const idx = line.indexOf(RAW_CLIENT_TOKEN)
      if (idx === -1) return
      // Ignore matches inside line/comment text (best-effort): skip pure comment lines.
      const trimmed = line.trim()
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
      const after = line.slice(idx + RAW_CLIENT_TOKEN.length).match(/^\s*\.\s*([a-z][A-Za-z0-9]*)/)
      const model = after && camelToModel.get(after[1])
      violations.push({
        vector: 'B2',
        file: rel,
        line: i + 1,
        msg: model
          ? `raw client accesses tenant-scoped model \`${model}\` — reads/writes across ALL tenants`
          : `raw, unscoped client used outside the platform allowlist`,
        fix: 'Use the scoped `prisma` import. For a sanctioned cross-tenant window, wrap in runUnscoped(reason, fn).',
      })
    })
  }
}

// ── Check B7: raw-SQL ratchet ────────────────────────────────────────────────
function checkRawSql(files) {
  const allowPath = join(HERE, 'raw-sql-audit.allowlist.json')
  const allow = JSON.parse(readFileSync(allowPath, 'utf8')).sites
  const seen = new Set()
  for (const full of files) {
    const rel = relative(REPO_ROOT, full)
    const text = readFileSync(full, 'utf8')
    const count = (text.match(RAW_SQL_RE) || []).length
    if (count === 0) continue
    seen.add(rel)
    const allowed = allow[rel] ?? 0
    if (count > allowed) {
      violations.push({
        vector: 'B7',
        file: rel,
        line: 0,
        msg: allowed === 0
          ? `${count} new raw-SQL site(s) in a file not on the audit baseline`
          : `${count} raw-SQL sites, baseline allows ${allowed} — ${count - allowed} new`,
        fix: 'Raw SQL bypasses tenant scoping. Add a manual `WHERE business_id = $x` predicate, then raise this file\'s count in scripts/scoped/raw-sql-audit.allowlist.json (reviewed).',
      })
    } else if (count < allowed) {
      notes.push(`ratchet: ${rel} now ${count} raw-SQL site(s) (baseline ${allowed}) — lower it in the allowlist.`)
    }
  }
  // Allowlist rows whose files disappeared (moved/deleted) — informational.
  for (const rel of Object.keys(allow)) {
    if (!seen.has(rel)) notes.push(`stale allowlist row: ${rel} (no raw SQL found — remove the row).`)
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
try {
  const files = walk(SERVER_SRC)
  await checkRawClient(files)
  checkRawSql(files)
} catch (err) {
  console.error(`[lint-raw-client] internal error: ${err?.stack || err}`)
  process.exit(2)
}

for (const n of notes) console.log(`[lint-raw-client] ${n}`)

if (violations.length === 0) {
  console.log(`[lint-raw-client] OK — no raw-client escape (B2) or new raw SQL (B7).`)
  process.exit(0)
}

console.error(`\n[lint-raw-client] ${violations.length} tenant-leak violation(s):\n`)
for (const v of violations) {
  const loc = v.line ? `${v.file}:${v.line}` : v.file
  console.error(`  ✗ [${v.vector}] ${loc}`)
  console.error(`      ${v.msg}`)
  console.error(`      → ${v.fix}\n`)
}
process.exit(1)
