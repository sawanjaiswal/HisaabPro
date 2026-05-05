/**
 * Permissions — PERMISSION_MATRIX, system roles, ensureSystemRoles
 * Matrix and role data live in permissions-data.ts (keeps each file ≤ 250 lines).
 */
import { prisma } from '../../lib/prisma.js'
import {
  PERMISSION_MATRIX,
  ALL_PERMISSIONS,
  VALID_PERMISSIONS,
  SYSTEM_ROLES,
} from './permissions-data.js'

export { PERMISSION_MATRIX, ALL_PERMISSIONS, VALID_PERMISSIONS, SYSTEM_ROLES }

export function getPermissionMatrix() {
  return { modules: PERMISSION_MATRIX }
}

export async function ensureSystemRoles(businessId: string) {
  const existing = await prisma.role.count({ where: { businessId, isSystem: true } })
  if (existing >= SYSTEM_ROLES.length) return

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { businessId_name: { businessId, name: role.name } },
      create: {
        businessId,
        name: role.name,
        isSystem: true,
        isDefault: role.isDefault ?? false,
        priority: role.priority,
        permissions: role.permissions,
      },
      update: {},
    })
  }
}
