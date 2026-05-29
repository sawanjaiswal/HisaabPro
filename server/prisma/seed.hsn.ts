/**
 * HSN/SAC seed (#76) — curated subset.
 *
 * Idempotent upsert keyed on `code` (PK). Safe to re-run, and non-destructive
 * when the full ~12K master is loaded later — upsert only touches the curated
 * codes and never deletes rows. `uqc` is intentionally NOT written here so the
 * chapter→UQC backfill in seed.gst.uqc.ts (and any manual override) wins.
 *
 * Rates are GST slab in BASIS POINTS (1800 = 18%) — see hsn-curated.ts.
 *
 * Run: npx tsx prisma/seed.hsn.ts   (or `npm run db:seed:hsn`)
 */

import { PrismaClient } from '@prisma/client'
import { CURATED_HSN_CODES } from './data/hsn-curated.js'

const prisma = new PrismaClient()

async function seed(): Promise<void> {
  console.log(`HSN seed — upserting ${CURATED_HSN_CODES.length} curated codes...`)

  let created = 0
  let updated = 0

  for (const hsn of CURATED_HSN_CODES) {
    const data = {
      description: hsn.description,
      chapter: hsn.chapter,
      defaultRate: hsn.defaultRate,
      cessApplicable: hsn.cessApplicable ?? false,
      cessRate: hsn.cessRate ?? 0,
    }

    const existing = await prisma.hsnCode.findUnique({
      where: { code: hsn.code },
      select: { code: true },
    })

    await prisma.hsnCode.upsert({
      where: { code: hsn.code },
      create: { code: hsn.code, ...data },
      update: data, // uqc untouched — owned by seed.gst.uqc.ts
    })

    if (existing) updated++
    else created++
  }

  console.log(`HSN seed — done. created=${created} updated=${updated}`)
}

seed()
  .catch((err) => {
    console.error('HSN seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
