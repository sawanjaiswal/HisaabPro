/**
 * E2E database reset — truncates every table in the public schema.
 *
 * Deliberately derives the table list from `information_schema` rather than
 * from a hardcoded array. The integration suite's setup.ts lists 27 tables by
 * hand; the schema has 150 models, so a hardcoded list silently leaves ~120
 * tables dirty and lets one E2E run poison the next. Deriving it cannot drift.
 *
 * Safety: refuses to run unless the target database name ends in `_test` or
 * `_e2e`, and unless NODE_ENV is not production. There is no --force flag —
 * pointing this at a real database should require editing DATABASE_URL, which
 * is a deliberate act, not a typo.
 *
 * Usage: npm run e2e:reset
 */

import { PrismaClient } from '@prisma/client'

const SAFE_DB_SUFFIXES = ['_test', '_e2e']

function assertSafeTarget(url: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('e2e-reset refuses to run with NODE_ENV=production')
  }
  let dbName: string
  try {
    dbName = new URL(url).pathname.replace(/^\//, '')
  } catch {
    throw new Error('DATABASE_URL is not a valid URL')
  }
  if (!SAFE_DB_SUFFIXES.some((s) => dbName.endsWith(s))) {
    throw new Error(
      `Refusing to truncate "${dbName}" — the E2E database name must end in ` +
        `${SAFE_DB_SUFFIXES.join(' or ')}. Point DATABASE_URL at a throwaway DB.`
    )
  }
  return dbName
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const dbName = assertSafeTarget(url)

  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'
    `
    if (rows.length === 0) {
      console.log(`e2e:reset — "${dbName}" has no tables; run migrations first`)
      return
    }

    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
    // One statement + CASCADE + RESTART IDENTITY: FK order is irrelevant and
    // sequences reset, so generated numbers are reproducible across runs.
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
    console.log(`e2e:reset — truncated ${rows.length} tables in "${dbName}"`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(`e2e:reset failed — ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
