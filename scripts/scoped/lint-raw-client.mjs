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
 *        in a tiny allowlist of platform files (today: its definition site
 *        alone). Anywhere else = build failure.
 *
 *   B7 — New raw SQL. `$queryRaw*` / `$executeRaw*` bypass the extension
 *        entirely. The pre-existing sites are frozen in
 *        raw-sql-audit.allowlist.json (#12). This lint fails if any file
 *        exceeds its sanctioned count, or a new file introduces raw SQL.
 *        Removing raw SQL (count down) is always allowed (ratchet).
 *
 * Zero deps, pure Node. Exit 0 = clean, 1 = violations, 2 = internal error.
 * Wired into CI + .githooks/pre-commit. Reuses scoped-models' DMMF derivation
 * (via @prisma/client) only to NAME the leaking model in the B2 message.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const SERVER_SRC = join(REPO_ROOT, 'server', 'src')

/**
 * Directories excluded from the walk. Everything else in the repo is linted.
 *
 * M-4a: the walk root used to be `server/src` alone, which left `scripts/`,
 * `server/scripts/` and `server/prisma/` unlinted — the exact directories where
 * an unscoped-client helper is most likely to be written and least likely to be
 * reviewed. One allowlist row (`server/scripts/cron/cleanup-unscoped-log.ts`)
 * even named a path outside the old root, so it was dead from the day it landed
 * and nothing said so.
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  '__tests__',
  '.git',
  'dist',
  'build',
  'coverage',
  'android',
  'ios',
  '.next',
  'migrations',
])

/** Files permitted to touch the raw, unscoped client. Everything else is a B2 leak. */
const RAW_CLIENT_ALLOWLIST = new Set([
  'server/src/lib/prisma.ts', // defines + exports __basePrismaUnsafe, wires the audit sink
  // Two rows removed once B2 stale-reporting could see them:
  //   `cleanup-unscoped-log.ts` — the file is not in the repo at all. It is
  //     specced in SCOPE §retention and named in a schema.prisma comment as the
  //     thing that trims `UnscopedAccessLog`, and it was never written. The
  //     allowlist row was the only artefact that made it look present.
  //   `server/src/__tests__/setup.ts` — real, and it does hold the token, but
  //     `__tests__` is in IGNORED_DIRS, so the row could never be consulted.
  //     Re-add it in the same commit that starts walking test files.
])

/**
 * B-5 — handing the raw client to someone else.
 *
 * An allowlisted file may legitimately hold the unscoped client; passing it OUT
 * as an argument is a different act, and it is invisible to the rule above on
 * both sides. The receiver never contains the token (the client arrives as a
 * parameter), so it is skipped at :93; the sender is allowlisted, so it is
 * skipped at :91. `prisma-shadow.sink.ts` is exactly this shape — an allowlist
 * row for it would be a dead row documenting an intent this tool does not check.
 *
 * Each handoff is keyed `<file>:<receiving symbol>` and carries a reviewed
 * tenant-safety note. An un-noted handoff is a violation, so the escape is
 * visible at the composition root where a reviewer can judge it.
 */
const RAW_CLIENT_HANDOFF_ALLOWLIST = new Map([
  // (populated as reviewed handoffs land — see ARCHITECTURE §7.6)
])

const RAW_CLIENT_TOKEN = '__basePrismaUnsafe'
/** Identifiers that ARE the unscoped client under another name. */
const RAW_CLIENT_ALIASES = [RAW_CLIENT_TOKEN, 'clients.base']
// Same alternation grep used to seed the baseline — counts one hit per `$...` site.
const RAW_SQL_RE = /\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)/g

// ── Walk the repo for .ts (skip tests, declaration files, ignored dirs) ──────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue
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
    // Resolve from server/, not the repo root. The bare specifier resolved
    // against THIS file's location, where @prisma/client is not installed, so
    // every run took the catch below and returned an empty map — silently. The
    // verdict was unaffected (B2 gates by file), but every finding printed the
    // generic message instead of naming the tenant-scoped model it touched, and
    // nothing distinguished "no model matched" from "the lookup never ran".
    const { Prisma } = await import(
      pathToFileURL(join(REPO_ROOT, 'server', 'node_modules', '@prisma', 'client', 'default.js')).href
    )
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
  } catch (err) {
    // B2 still gates by file, so the verdict is safe — but say so out loud
    // rather than degrading to generic messages with no explanation.
    console.warn(`[lint-raw-client] model labels unavailable (${err.message}) — findings will not name the model.`)
    return new Map()
  }
}

const violations = []
const notes = []

// ── Check B2: raw-client escape ──────────────────────────────────────────────
/** Best-effort: a comment line carries no runtime meaning. */
function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

/**
 * B-5 — flag the raw client being passed OUT of an allowlisted file as an
 * argument. Call sites only (N-3).
 *
 * Rev 3 also proposed flagging any function that ACCEPTS a PrismaClient-shaped
 * parameter in a non-allowlisted file. Security measured it: 56 of 1 094
 * `server/src` files reference `ExtendedPrismaClient`/`TransactionClient` and
 * every one receives the *scoped* client. Fifty-six false positives on day one
 * gets an allowlist bulk-filled, which leaves B2 weaker than before the rule
 * existed. False-positive rate is a control-integrity property, not a usability
 * nicety. The call-site rule is precise and sufficient alone.
 */
function checkRawClientHandoff(rel, text) {
  const seen = []
  text.split('\n').forEach((line, i) => {
    if (isCommentLine(line)) return
    for (const alias of RAW_CLIENT_ALIASES) {
      const idx = line.indexOf(alias)
      if (idx === -1) continue
      // An argument position: `f(alias`, `f({ db: alias`, `{ db: alias }`.
      const before = line.slice(0, idx)
      const isArgument = /[({,:]\s*$/.test(before) && /\(/.test(before)
      if (!isArgument) continue

      const receiver = before.match(/([A-Za-z0-9_$.]+)\s*\(/)
      const key = `${rel}:${receiver ? receiver[1] : 'unknown'}`
      if (RAW_CLIENT_HANDOFF_ALLOWLIST.has(key)) return
      seen.push({ line: i + 1, key })
    }
  })

  for (const s of seen) {
    violations.push({
      vector: 'B2',
      file: rel,
      line: s.line,
      msg: `the raw, unscoped client is passed out of this file as an argument (${s.key})`,
      fix: `The receiver holds an unscoped client without containing the token, so neither side is checked. Add "${s.key}" to RAW_CLIENT_HANDOFF_ALLOWLIST with a reviewed tenant-safety note.`,
    })
  }
}

async function checkRawClient(files) {
  const camelToModel = await loadScopedModelNames()
  const allowlistSeen = new Set()

  for (const full of files) {
    const rel = relative(REPO_ROOT, full)
    const text = readFileSync(full, 'utf8')

    if (RAW_CLIENT_ALLOWLIST.has(rel)) {
      allowlistSeen.add(rel)
      checkRawClientHandoff(rel, text)
      continue
    }

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

  // B2 stale-row reporting. The B7 ratchet has reported dead allowlist rows
  // since it shipped (:143-145); B2 had no equivalent, which is why the
  // `server/scripts/cron/cleanup-unscoped-log.ts` row — a path outside the old
  // walk root — sat dead and unnoticed. Same treatment, so the next one is loud.
  for (const rel of RAW_CLIENT_ALLOWLIST) {
    if (!allowlistSeen.has(rel)) {
      notes.push(`stale raw-client allowlist row: ${rel} (file not walked or missing — remove the row).`)
    }
  }
  for (const key of RAW_CLIENT_HANDOFF_ALLOWLIST.keys()) {
    const [rel] = key.split(':')
    if (!allowlistSeen.has(rel)) {
      notes.push(`stale handoff allowlist row: ${key} (source file not walked — remove the row).`)
    }
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
    // Count runtime sites only. A whole-file `match()` also counts the tokens
    // inside prose — the doc comment on `prisma-shadow.stats.ts` says "no
    // `$queryRaw`/`$executeRaw`" and scored 2 against itself. A ratchet that
    // fires on a comment ASSERTING the rule trains reviewers to reword docs
    // instead of reading findings, which is how a real B7 gets waved through.
    const count = text
      .split('\n')
      .filter((line) => !isCommentLine(line))
      .reduce((n, line) => n + (line.match(RAW_SQL_RE) || []).length, 0)
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
  const files = walk(REPO_ROOT)
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
