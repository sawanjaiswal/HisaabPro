/**
 * One-shot migration helper: grant jobs.* permissions to existing system roles.
 * Idempotent — safe to re-run; already-granted permissions are no-ops.
 *
 * Usage: npx ts-node prisma/grant-jobs-permission.ts
 * (or via tsx: npx tsx prisma/grant-jobs-permission.ts)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GRANTS: Record<string, string[]> = {
  Salesman:      ['jobs.view', 'jobs.create', 'jobs.edit'],
  Cashier:       ['jobs.view'],
  'Delivery Boy': ['jobs.view'],
  Accountant:    ['jobs.view'],
}

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true } })
  let updated = 0

  for (const biz of businesses) {
    for (const [roleName, newPerms] of Object.entries(GRANTS)) {
      const role = await prisma.role.findUnique({
        where: { businessId_name: { businessId: biz.id, name: roleName } },
        select: { id: true, permissions: true },
      })
      if (!role) continue

      const merged = Array.from(new Set([...role.permissions, ...newPerms]))
      if (merged.length === role.permissions.length) continue

      await prisma.role.update({
        where: { id: role.id },
        data: { permissions: merged },
      })
      updated++
      console.log(`Updated ${roleName} for business ${biz.id}`)
    }
  }

  console.log(`Done. Updated ${updated} role row(s).`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
