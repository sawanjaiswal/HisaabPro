/**
 * Party group services.
 */

import { prisma } from '../../lib/prisma.js'
import { conflictError } from '../../lib/errors.js'
import type { CreateGroupInput, UpdateGroupInput } from '../../schemas/party.schemas.js'
import { requireGroup } from './helpers.js'

export async function createGroup(businessId: string, data: CreateGroupInput) {
  try {
    return await prisma.partyGroup.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        color: data.color,
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        description: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Group "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function listGroups(businessId: string) {
  const groups = await prisma.partyGroup.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { parties: true } },
    },
    take: 100,
  })

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    partyCount: g._count.parties,
  }))
}

export async function updateGroup(
  businessId: string,
  groupId: string,
  data: UpdateGroupInput
) {
  await requireGroup(businessId, groupId)

  try {
    return await prisma.partyGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Group name "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function deleteGroup(
  businessId: string,
  groupId: string,
  reassignTo?: string
) {
  await requireGroup(businessId, groupId)

  if (reassignTo) {
    await requireGroup(businessId, reassignTo)
  }

  await prisma.$transaction(async (tx) => {
    await tx.party.updateMany({
      where: { businessId, groupId },
      data: { groupId: reassignTo ?? null },
    })

    await tx.partyGroup.delete({ where: { id: groupId } })
  })

  return { deleted: true }
}
