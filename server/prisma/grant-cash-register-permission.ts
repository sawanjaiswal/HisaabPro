/**
 * One-shot migration helper: grant cashRegister.* permissions to existing system roles.
 * Idempotent — safe to re-run; already-granted permissions are no-ops.
 *
 * Usage: npx tsx prisma/grant-cash-register-permission.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Owner + Partner auto-include ALL_PERMISSIONS (they use the full matrix),
// so only non-full-access roles need explicit grants.
// Manager also uses ALL_PERMISSIONS minus 3 settings keys — it auto-gets
// cashRegister.* on ensureSystemRoles for new businesses. For existing
// Manager roles already persisted in DB, we patch them here.
const ALL_CR = [
  'cashRegister.view',
  'cashRegister.create',
  'cashRegister.edit',
  'cashRegister.delete',
] as const

const GRANTS: Record<string, string[]> = {
  Owner: [...ALL_CR],
  Partner: [...ALL_CR],
  Manager: [...ALL_CR],
  Cashier: ['cashRegister.view', 'cashRegister.create'],
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
