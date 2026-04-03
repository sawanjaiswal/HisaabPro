/**
 * Party list & get services.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { ListPartiesQuery } from '../../schemas/party.schemas.js'

export async function listParties(businessId: string, filters: ListPartiesQuery) {
  const {
    page,
    limit,
    search,
    type,
    groupId,
    hasOutstanding,
    isActive,
    sortBy,
    sortOrder,
    tags,
  } = filters

  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.PartyWhereInput = {
    businessId,
    isActive,
  }

  if (type) where.type = type
  if (groupId) where.groupId = groupId

  if (hasOutstanding !== undefined) {
    where.outstandingBalance = hasOutstanding ? { not: 0 } : { equals: 0 }
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Build orderBy
  const orderBy: Prisma.PartyOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  // Parallel: data + count + summary stats + type counts
  const baseWhere: Prisma.PartyWhereInput = { businessId, isActive }
  const [parties, total, receivableAgg, payableAgg, typeCounts] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
        type: true,
        groupId: true,
        tags: true,
        gstin: true,
        creditLimit: true,
        creditLimitMode: true,
        outstandingBalance: true,
        totalBusiness: true,
        lastTransactionAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        group: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.party.count({ where }),
    // Sum of positive outstanding (receivable)
    prisma.party.aggregate({
      where: { ...baseWhere, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    // Sum of negative outstanding (payable)
    prisma.party.aggregate({
      where: { ...baseWhere, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    // Single groupBy replaces 3 separate count queries
    prisma.party.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: true,
    }),
  ])

  const customersCount = typeCounts.find((t) => t.type === 'CUSTOMER')?._count ?? 0
  const suppliersCount = typeCounts.find((t) => t.type === 'SUPPLIER')?._count ?? 0
  const bothCount = typeCounts.find((t) => t.type === 'BOTH')?._count ?? 0

  const totalReceivable = receivableAgg._sum.outstandingBalance ?? 0
  const totalPayable = Math.abs(payableAgg._sum.outstandingBalance ?? 0)

  return {
    parties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalParties: total,
      totalReceivable,
      totalPayable,
      netOutstanding: totalReceivable - totalPayable,
      customersCount,
      suppliersCount,
      bothCount,
    },
  }
}

export async function getParty(businessId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true,
      businessId: true,
      name: true,
      phone: true,
      email: true,
      companyName: true,
      type: true,
      groupId: true,
      tags: true,
      gstin: true,
      pan: true,
      creditLimit: true,
      creditLimitMode: true,
      outstandingBalance: true,
      totalBusiness: true,
      lastTransactionAt: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      group: { select: { id: true, name: true, color: true, description: true } },
      addresses: {
        select: {
          id: true,
          label: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          pincode: true,
          type: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      customFieldValues: {
        select: {
          id: true,
          fieldId: true,
          value: true,
          field: {
            select: {
              name: true,
              fieldType: true,
              showOnInvoice: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { field: { sortOrder: 'asc' } },
      },
      openingBalance: {
        select: {
          id: true,
          amount: true,
          type: true,
          asOfDate: true,
          notes: true,
        },
      },
    },
  })

  if (!party) throw notFoundError('Party')
  return party
}
