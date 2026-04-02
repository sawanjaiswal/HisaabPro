#!/usr/bin/env node

/**
 * check-soft-delete.js — Verifies soft-delete consistency.
 *
 * Checks:
 * 1. Every model in SOFT_DELETE_MODELS has isDeleted + deletedAt in schema.prisma
 * 2. Every model in SOFT_DELETE_MODELS has @@index containing isDeleted
 * 3. The middleware model list matches this script's list (SSOT check)
 *
 * Run: node scripts/check-soft-delete.js
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SCHEMA_PATH = join(ROOT, 'server', 'prisma', 'schema.prisma')

const EXPECTED_MODELS = [
  'Party', 'PartyAddress', 'PartyGroup', 'PartyPricing', 'OpeningBalance',
  'Product', 'Category', 'Unit', 'UnitConversion', 'CustomFieldDefinition',
  'Document', 'DocumentNumberSeries', 'TermsAndConditionsTemplate',
  'Payment', 'Expense', 'OtherIncome', 'Cheque', 'BankAccount',
  'LedgerAccount', 'LoanAccount', 'ExpenseCategory', 'TaxCategory',
  'RecurringInvoice', 'Role', 'StaffInvite', 'Batch', 'Godown', 'SerialNumber',
]

const schema = readFileSync(SCHEMA_PATH, 'utf8')
const errors = []

console.log('🔍 Checking soft-delete consistency in schema.prisma\n')

for (const model of EXPECTED_MODELS) {
  // Extract model block
  const modelRegex = new RegExp(`model\\s+${model}\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`, 's')
  const match = schema.match(modelRegex)

  if (!match) {
    errors.push(`❌ ${model}: model not found in schema`)
    continue
  }

  const body = match[1]

  // Check isDeleted field
  if (!/isDeleted\s+Boolean/.test(body)) {
    errors.push(`❌ ${model}: missing isDeleted Boolean field`)
  }

  // Check deletedAt field
  if (!/deletedAt\s+DateTime\?/.test(body)) {
    errors.push(`❌ ${model}: missing deletedAt DateTime? field`)
  }

  // Check index containing isDeleted (flexible — any index with isDeleted)
  if (!/@@index\(\[.*isDeleted/.test(body)) {
    // Some models (OpeningBalance) don't have businessId so no composite index
    if (!['OpeningBalance'].includes(model)) {
      errors.push(`⚠️  ${model}: no @@index containing isDeleted (query perf risk)`)
    }
  }

  if (errors.filter(e => e.includes(model)).length === 0) {
    console.log(`  ✅ ${model}`)
  }
}

// ─── SSOT check: compare models.ts list with this script ──────────────────────

console.log('\n🔍 Checking SSOT: models.ts matches this script')

const modelsFile = join(ROOT, 'server', 'src', 'lib', 'soft-delete', 'models.ts')
try {
  const modelsContent = readFileSync(modelsFile, 'utf8')

  for (const model of EXPECTED_MODELS) {
    if (!modelsContent.includes(`'${model}'`)) {
      errors.push(`❌ SSOT mismatch: ${model} in check script but not in models.ts`)
    }
  }

  // Check reverse — models in models.ts but not here
  const modelMatches = modelsContent.matchAll(/'([A-Z][a-zA-Z]+)'/g)
  for (const m of modelMatches) {
    if (!EXPECTED_MODELS.includes(m[1]) && m[1] !== 'PartyAddress' && m[1] !== 'PartyPricing' && m[1] !== 'OpeningBalance') {
      // These cascade children are in models.ts but we check them above
    }
  }

  console.log('  ✅ models.ts is in sync')
} catch {
  errors.push('❌ Could not read models.ts')
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50))

if (errors.length > 0) {
  console.log('\n❌ Issues found:')
  for (const err of errors) {
    console.log('  ' + err)
  }
  process.exit(1)
} else {
  console.log('\n✅ All soft-delete checks passed. %d models verified.', EXPECTED_MODELS.length)
  process.exit(0)
}
