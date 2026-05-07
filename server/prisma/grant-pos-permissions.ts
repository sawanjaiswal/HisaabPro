/**
 * One-shot migration helper: grant pos.* permissions to existing system roles.
 * Idempotent — safe to re-run; already-granted permissions are no-ops.
 *
 * Usage: npx tsx prisma/grant-pos-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ALL_POS = ['pos.read', 'pos.create', 'pos.void'] as const

// Owner + Partner use ALL_PERMISSIONS via ensureSystemRoles — backfill for existing rows.
// Manager also uses ALL_PERMISSIONS minus a few settings keys — gets all 3 pos.*.
// Cashier: read + create only (no void).
const GRANTS: Record<string, string[]> = {
  Owner:   [...ALL_POS],
  Partner: [...ALL_POS],
  Manager: [...ALL_POS],
  Cashier: ['pos.read', 'pos.create'],
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
