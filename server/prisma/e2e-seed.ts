/**
 * E2E fixtures — the tenants `docs/E2E_TEST_PLAN.md` §Fixtures names.
 *
 *   (default)   FIX-ONBOARDED  — user + business + owner membership + GL chart
 *   --gst       FIX-GST        — same, with GST enabled + GSTIN + state code
 *   --seeded    FIX-SEEDED     — FIX-ONBOARDED + units, parties, products
 *
 * Deliberately stops short of seeding invoices/payments. Those carry numbering,
 * tax, stock and double-entry invariants that live in the services; hand-writing
 * rows would create documents no code path could have produced, and a suite that
 * passes against them would prove nothing. Tests create them through the API.
 *
 * FIX-NEW (an unregistered phone) needs no seed — it is the absence of a row.
 *
 * Idempotent: re-running upserts rather than duplicating. Safe after e2e-reset.
 *
 * Usage: npm run e2e:seed [-- --gst] [-- --seeded]
 */

import { PrismaClient } from '@prisma/client'
import { seedDefaultAccounts } from '../src/services/accounting/chart-of-accounts.js'
import { hashPassword } from '../src/lib/password.js'

const prisma = new PrismaClient()

/** Reserved E2E numbers — never issued to a real user; specs hardcode these. */
export const E2E_OWNER_PHONE = '9000000001'
/** Password for every seeded account. Mirrored by e2e/gold/support/constants.ts. */
export const E2E_PASSWORD = 'Test@12345'
export const E2E_STAFF_PHONE = '9000000002'
/** FIX-NEW: guaranteed to have no account. */
export const E2E_UNREGISTERED_PHONE = '9000000099'

const flags = process.argv.slice(2)
const withGst = flags.includes('--gst')
const withData = flags.includes('--seeded')

async function seedTenant() {
  // Hashed with the app's own util so a change to SALT_ROUNDS or the algorithm
  // cannot leave the seed producing a hash the login path refuses.
  const passwordHash = await hashPassword(E2E_PASSWORD)

  const user = await prisma.user.upsert({
    where: { phone: E2E_OWNER_PHONE },
    update: {
      name: 'E2E Owner',
      isActive: true,
      isSuspended: false,
      passwordHash,
      // A prior run's brute-force case may have locked this account. A seed that
      // leaves it locked is a seed that cannot log in.
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    },
    create: { phone: E2E_OWNER_PHONE, name: 'E2E Owner', isActive: true, passwordHash },
  })

  const business = await prisma.business.upsert({
    where: { id: 'e2e-business-001' },
    update: {},
    create: {
      id: 'e2e-business-001',
      name: 'E2E Traders',
      businessType: 'general',
      phone: E2E_OWNER_PHONE,
      state: 'Maharashtra',
      city: 'Mumbai',
      ...(withGst
        ? {
            gstEnabled: true,
            gstin: '27AAACH7409R1ZZ',
            stateCode: '27',
          }
        : {}),
    },
  })

  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: { isActive: true, status: 'ACTIVE' },
    create: { userId: user.id, businessId: business.id, role: 'owner', isActive: true },
  })

  // Double-entry needs its chart before any document can post — reuse the real
  // service so the E2E chart is byte-identical to a production signup's.
  await seedDefaultAccounts(business.id)

  return { user, business }
}

async function seedData(businessId: string) {
  const unit = await prisma.unit.upsert({
    where: { businessId_symbol: { businessId, symbol: 'pcs' } },
    update: {},
    create: { businessId, name: 'Pieces', symbol: 'pcs', category: 'COUNT', decimalAllowed: false },
  })

  // Two parties: one plain B2C customer, one GSTIN-bearing B2B supplier, so
  // intra/inter-state and B2B/B2C branches both have a fixture to run against.
  const parties = [
    { name: 'Raju Kirana Store', phone: '9111100001', type: 'CUSTOMER', stateCode: '27' },
    { name: 'Priya Wholesale', phone: '9111100002', type: 'SUPPLIER', gstin: '29AAACH7409R1Z2', stateCode: '29' },
  ]
  for (const p of parties) {
    const existing = await prisma.party.findFirst({ where: { businessId, name: p.name } })
    if (!existing) await prisma.party.create({ data: { businessId, ...p } })
  }

  const products = [
    { name: 'Basmati Rice 5kg', sku: 'E2E-RICE-5', salePrice: 55000, purchasePrice: 42000, hsnCode: '1006' },
    { name: 'Sunflower Oil 1L', sku: 'E2E-OIL-1', salePrice: 18500, purchasePrice: 15000, hsnCode: '1512' },
  ]
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { businessId, sku: p.sku } })
    if (!existing) {
      await prisma.product.create({ data: { businessId, unitId: unit.id, currentStock: 100, ...p } })
    }
  }

  return { parties: parties.length, products: products.length }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('e2e-seed refuses to run with NODE_ENV=production')
  }

  const { user, business } = await seedTenant()
  const fixture = withData ? 'FIX-SEEDED' : withGst ? 'FIX-GST' : 'FIX-ONBOARDED'
  console.log(`e2e:seed — ${fixture}`)
  console.log(`  owner    ${E2E_OWNER_PHONE} (${user.id})`)
  console.log(`  business ${business.name} (${business.id})${withGst ? ' · GST on' : ''}`)

  if (withData) {
    const counts = await seedData(business.id)
    console.log(`  data     ${counts.parties} parties · ${counts.products} products · 1 unit`)
  }
  console.log(`  FIX-NEW  ${E2E_UNREGISTERED_PHONE} (intentionally has no account)`)
}

main()
  .catch((err) => {
    console.error(`e2e:seed failed — ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
