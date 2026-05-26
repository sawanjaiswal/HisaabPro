#!/usr/bin/env node

/**
 * enforce-audit-coverage.mjs — Audit Coverage SSOT enforcer (G1 closure).
 *
 * Reads `server/src/lib/audit/audit-coverage.ts` AUDIT_COVERED_SERVICES list
 * and verifies each named service file contains at least one
 * `auditLog.create(` or `auditLog.createMany(` invocation (tx.auditLog.create
 * inside a $transaction, or prisma.auditLog.create as a standalone write).
 *
 * Mode (PR1B): REPORT-ONLY. Prints services missing audit-write. Exit 0.
 *               PR7 flips to BLOCKING when each service is wired.
 *
 * Mode (PR7): BLOCKING. Exits 1 if any listed service lacks audit-write.
 *
 * Usage:
 *   node scripts/enforce-audit-coverage.mjs            # PR1B default report-only
 *   node scripts/enforce-audit-coverage.mjs --block    # PR7 future
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §7 + §18 PR7 plan.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SERVER_SRC = join(ROOT, 'server', 'src')
const COVERAGE_FILE = join(SERVER_SRC, 'lib', 'audit', 'audit-coverage.ts')

const BLOCKING = process.argv.includes('--block')

// Accept any identifier holding a prisma-like surface (tx, prisma, db,
// client, ...) so audit-emit wrappers count. Also accept named import
// of `emit*` helpers from `audit-emit` (Phase 7 audit-emit wrappers).
const AUDIT_CALL_RE =
  /(?:\b\w+\.auditLog\.(?:create|createMany)\s*\(|from\s+['"][^'"]*audit-emit[^'"]*['"]|\bemit(?:Uploaded|Parsed|RowDropped|DedupResolved|Committed|Expired|ParseTimeout|Cancelled)\s*\()/

function parseCoverageList() {
  const src = readFileSync(COVERAGE_FILE, 'utf8')
  // Cheap-but-stable extraction: walk every `service: '...'` literal inside
  // AUDIT_COVERED_SERVICES. The TS const-assertion form keeps each entry on
  // one line in the SSOT, so a line-anchored regex suffices.
  const out = []
  for (const line of src.split('\n')) {
    const m = line.match(/service:\s*'([^']+)'/)
    if (m) out.push(m[1])
  }
  return out
}

function main() {
  if (!existsSync(COVERAGE_FILE)) {
    console.error(`enforce-audit-coverage: missing SSOT at ${COVERAGE_FILE}`)
    process.exit(BLOCKING ? 1 : 0)
  }

  const services = parseCoverageList()
  console.log(`🔍 enforce-audit-coverage: ${services.length} services listed in SSOT`)

  const missing = []
  const present = []
  for (const relPath of services) {
    const fullPath = join(SERVER_SRC, relPath)
    if (!existsSync(fullPath)) {
      missing.push({ relPath, reason: 'file-not-found' })
      continue
    }
    const src = readFileSync(fullPath, 'utf8')
    if (AUDIT_CALL_RE.test(src)) {
      present.push(relPath)
    } else {
      missing.push({ relPath, reason: 'no-auditLog.create-call' })
    }
  }

  if (present.length > 0) {
    console.log(`  ✅ ${present.length} service(s) write audit:`)
    for (const p of present) console.log(`     • ${p}`)
  }

  if (missing.length > 0) {
    const banner = BLOCKING ? '❌' : '⚠️ '
    console.log(`  ${banner} ${missing.length} service(s) MISSING audit-write:`)
    for (const m of missing) console.log(`     • ${m.relPath}  [${m.reason}]`)
  }

  if (BLOCKING && missing.length > 0) {
    console.log(`\n❌ enforce-audit-coverage: ${missing.length} blocking violation(s)`)
    process.exit(1)
  }

  // PR1B is report-only: missing entries are expected (PR7 wires them).
  console.log(`\n✅ enforce-audit-coverage: ${BLOCKING ? 'all covered' : 'report-only mode (PR1B); ' + missing.length + ' awaiting PR7 wire-up'}`)
  process.exit(0)
}

main()
