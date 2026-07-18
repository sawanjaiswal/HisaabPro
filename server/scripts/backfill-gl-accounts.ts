/**
 * GL chart-of-accounts backfill — seeds the default ledger accounts for every
 * business that is missing them. Companion to the createBusiness fix (new
 * businesses now seed on creation); this catches businesses created before that.
 *
 * Idempotent: seedDefaultAccounts uses skipDuplicates on @@unique([businessId,
 * code]), so re-running is a no-op for already-seeded businesses.
 *
 * Usage:  tsx scripts/backfill-gl-accounts.ts
 *         tsx scripts/backfill-gl-accounts.ts --dry-run
 */
import { prisma } from '../src/lib/prisma.js'
import { seedDefaultAccounts } from '../src/services/accounting/chart-of-accounts.js'

const DRY = process.argv.includes('--dry-run')

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } })
  let seeded = 0
  for (const b of businesses) {
    const count = await prisma.ledgerAccount.count({ where: { businessId: b.id } })
    if (count > 0) continue
    console.log(`${DRY ? '[dry] would seed' : 'seeding'}: ${b.name} (${b.id})`)
    if (!DRY) await seedDefaultAccounts(b.id)
    seeded++
  }
  console.log(`\n${DRY ? 'would seed' : 'seeded'} ${seeded}/${businesses.length} business(es)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
