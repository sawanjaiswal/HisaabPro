/**
 * Scoped-Prisma shadow canary — fixture seed (Wave A · Stage 1).
 *
 * The canary is the positive control for tenant isolation: every 15 minutes the
 * shadow harness runs the real injection core over two synthetic Party rows and
 * asserts scoping returns exactly `[SELF]`. This script seeds those two rows so
 * the control has something to read. See `docs/RUNBOOK_scoped-shadow.md §7`.
 *
 * Idempotent — safe to re-run. Uses the base client on purpose: it writes into
 * TWO businesses, which a scoped client would (correctly) forbid.
 *
 * Run:   npx tsx prisma/seed.shadow-canary.ts
 * Then:  set SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID to the id it prints, restart.
 */

import { PrismaClient } from '@prisma/client'
import {
  SHADOW_CANARY_MODEL,
  SHADOW_CANARY_SELF_ID,
  SHADOW_CANARY_FOREIGN_ID,
} from '../src/lib/prisma-shadow.constants.js'

const prisma = new PrismaClient()

// Two stable, synthetic tenants. Neither holds real data — that is the whole
// point (§7 / §9.3 control 4): a canary pointed at a real business would persist
// that tenant's row ids into the divergence table forever.
const CANARY_BUSINESS_ID = 'shadow-canary-business'
const FOREIGN_BUSINESS_ID = 'shadow-canary-foreign-business'

async function upsertBusiness(id: string, name: string) {
  await prisma.business.upsert({
    where: { id },
    update: {},
    create: { id, name, isActive: false },
  })
}

async function upsertParty(id: string, businessId: string, name: string) {
  await prisma.party.upsert({
    where: { id },
    update: { businessId, isActive: true, isDeleted: false },
    create: { id, businessId, name, type: 'CUSTOMER' },
  })
}

async function main() {
  if (SHADOW_CANARY_MODEL !== 'Party') {
    throw new Error(
      `Canary model is ${SHADOW_CANARY_MODEL}, not Party — this seed is out of date with the constants SSOT.`,
    )
  }

  console.log('Seeding scoped-Prisma shadow canary fixture…')

  await upsertBusiness(CANARY_BUSINESS_ID, 'Shadow Canary (synthetic)')
  await upsertBusiness(FOREIGN_BUSINESS_ID, 'Shadow Canary Foreign (synthetic)')

  await upsertParty(SHADOW_CANARY_SELF_ID, CANARY_BUSINESS_ID, 'Canary Self')
  await upsertParty(SHADOW_CANARY_FOREIGN_ID, FOREIGN_BUSINESS_ID, 'Canary Foreign')

  // Verify the fixture is in the exact shape the canary cron asserts on.
  const self = await prisma.party.findUnique({ where: { id: SHADOW_CANARY_SELF_ID } })
  const foreign = await prisma.party.findUnique({ where: { id: SHADOW_CANARY_FOREIGN_ID } })

  if (!self || self.businessId !== CANARY_BUSINESS_ID) {
    throw new Error('SELF row missing or in the wrong business after seed.')
  }
  // FOREIGN must live in a DIFFERENT business, or scoping has nothing to filter out.
  if (!foreign || foreign.businessId === CANARY_BUSINESS_ID) {
    throw new Error('FOREIGN row missing or wrongly placed in the canary business.')
  }

  console.log('\n  Fixture seeded and verified:')
  console.log(`    SELF    ${SHADOW_CANARY_SELF_ID}  ->  business ${CANARY_BUSINESS_ID}`)
  console.log(`    FOREIGN ${SHADOW_CANARY_FOREIGN_ID}  ->  business ${FOREIGN_BUSINESS_ID}`)
  console.log('\n  Set this env var and restart to arm the canary:')
  console.log(`    SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID=${CANARY_BUSINESS_ID}\n`)
}

main()
  .catch((e) => {
    console.error('Canary fixture seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
