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
 *
 * Exit code 0 = pass, 1 = fail with details.
 * Run: node scripts/enforce.js [--fix]
 */

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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

for (const file of allFiles) {
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

for (const file of serverFiles) {
  if (file.includes('recycle-bin.service')) continue
  if (file.includes('soft-delete')) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match: prisma.party.delete( or tx.party.delete(
    // The middleware intercepts these, but we want to flag awareness
    for (const model of SOFT_DELETE_MODELS) {
      const key = model.charAt(0).toLowerCase() + model.slice(1)
      const pattern = new RegExp(`\\.(${key})\\.delete\\(`)
      if (pattern.test(line)) {
        // This is actually OK — middleware intercepts it.
        // But we flag it as a warning for code review awareness.
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
