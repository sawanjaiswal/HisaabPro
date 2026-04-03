/**
 * Roles — CRUD for business roles
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { CreateRoleInput, UpdateRoleInput } from '../../schemas/settings.schemas.js'
import { VALID_PERMISSIONS, ensureSystemRoles } from './permissions.js'

export async function listRoles(businessId: string) {
  await ensureSystemRoles(businessId)

  return prisma.role.findMany({
    where: { businessId },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
      _count: { select: { businessUsers: true } },
    },
    orderBy: { priority: 'desc' },
    take: 100,
  })
}

export async function getRole(businessId: string, roleId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
      _count: { select: { businessUsers: true } },
    },
  })
  if (!role) throw notFoundError('Role')
  return role
}

export async function createRole(businessId: string, data: CreateRoleInput) {
  // Validate permission strings against known matrix
  const invalid = data.permissions.filter(p => !VALID_PERMISSIONS.has(p))
  if (invalid.length > 0) {
    throw validationError(`Invalid permissions: ${invalid.join(', ')}`)
  }

  if (data.isDefault) {
    await prisma.role.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.role.create({
    data: {
      businessId,
      name: data.name,
      description: data.description || null,
      permissions: data.permissions,
      isDefault: data.isDefault,
    },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function updateRole(businessId: string, roleId: string, data: UpdateRoleInput) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: { isSystem: true },
  })
  if (!role) throw notFoundError('Role')
  if (role.isSystem) throw validationError('Cannot modify system roles')

  if (data.permissions) {
    const invalid = data.permissions.filter(p => !VALID_PERMISSIONS.has(p))
    if (invalid.length > 0) {
      throw validationError(`Invalid permissions: ${invalid.join(', ')}`)
    }
  }

  if (data.isDefault) {
    await prisma.role.updateMany({
      where: { businessId, isDefault: true, id: { not: roleId } },
      data: { isDefault: false },
    })
  }

  return prisma.role.update({
    where: { id: roleId },
    data,
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function deleteRole(businessId: string, roleId: string, reassignToId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: { isSystem: true },
  })
  if (!role) throw notFoundError('Role')
  if (role.isSystem) throw validationError('Cannot delete system roles')
  if (roleId === reassignToId) throw validationError('Cannot reassign to the same role')

  const reassignTo = await prisma.role.findFirst({
    where: { id: reassignToId, businessId },
    select: { id: true },
  })
  if (!reassignTo) throw notFoundError('Reassign role')

  return prisma.$transaction(async (tx) => {
    const result = await tx.businessUser.updateMany({
      where: { businessId, roleId },
      data: { roleId: reassignToId },
    })

    await tx.role.update({
      where: { id: roleId },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    return { reassignedStaff: result.count }
  })
}
