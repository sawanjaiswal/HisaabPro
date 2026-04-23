/** Serial Number Service — per-unit tracking; status AVAILABLE → SOLD → RETURNED. */
import { prisma } from '../lib/prisma.js'
import { notFoundError, conflictError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type {
  CreateSerialNumberInput,
  BulkCreateSerialNumbersInput,
  UpdateSerialNumberInput,
  ListSerialNumbersQuery,
} from '../schemas/serial-number.schemas.js'

async function requireProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true },
  })
  if (!product) throw notFoundError('Product')
  return product
}

export async function createSerialNumber(
  businessId: string,
  productId: string,
  data: CreateSerialNumberInput
) {
  await requireProduct(businessId, productId)

  const existing = await prisma.serialNumber.findFirst({
    where: { businessId, serialNumber: data.serialNumber },
    select: { id: true },
  })
  if (existing) throw conflictError(`Serial number "${data.serialNumber}" already exists`)

  if (data.batchId) {
    const batch = await prisma.batch.findFirst({
      where: { id: data.batchId, businessId, productId, isDeleted: false },
      select: { id: true },
    })
    if (!batch) throw notFoundError('Batch')
  }
  if (data.godownId) {
    const godown = await prisma.godown.findFirst({
      where: { id: data.godownId, businessId, isDeleted: false },
      select: { id: true },
    })
    if (!godown) throw notFoundError('Godown')
  }

  logger.info('Creating serial number', { businessId, productId, serial: data.serialNumber })

  return prisma.serialNumber.create({
    data: {
      businessId,
      productId,
      serialNumber: data.serialNumber,
      batchId: data.batchId ?? null,
      godownId: data.godownId ?? null,
      notes: data.notes ?? null,
      status: 'AVAILABLE',
    },
    select: serialDetailSelect,
  })
}

export async function bulkCreateSerialNumbers(
  businessId: string,
  productId: string,
  data: BulkCreateSerialNumbersInput
) {
  await requireProduct(businessId, productId)

  const existingSerials = await prisma.serialNumber.findMany({
    where: { businessId, serialNumber: { in: data.serialNumbers } },
    select: { serialNumber: true },
  })
  const existingSet = new Set(existingSerials.map((s) => s.serialNumber))

  const inputSet = new Set<string>()
  const inputDuplicates: string[] = []
  for (const sn of data.serialNumbers) {
    if (inputSet.has(sn)) inputDuplicates.push(sn)
    inputSet.add(sn)
  }

  const errors: Array<{ serial: string; message: string }> = []
  const validSerials: string[] = []

  for (const sn of data.serialNumbers) {
    if (existingSet.has(sn)) {
      errors.push({ serial: sn, message: 'Already exists' })
    } else if (inputDuplicates.includes(sn) && validSerials.includes(sn)) {
      errors.push({ serial: sn, message: 'Duplicate in request' })
    } else {
      validSerials.push(sn)
    }
  }

  if (validSerials.length === 0) return { created: 0, errors }

  if (data.batchId) {
    const batch = await prisma.batch.findFirst({
      where: { id: data.batchId, businessId, productId, isDeleted: false },
      select: { id: true },
    })
    if (!batch) throw notFoundError('Batch')
  }
  if (data.godownId) {
    const godown = await prisma.godown.findFirst({
      where: { id: data.godownId, businessId, isDeleted: false },
      select: { id: true },
    })
    if (!godown) throw notFoundError('Godown')
  }

  logger.info('Bulk creating serial numbers', { businessId, productId, count: validSerials.length })

  const result = await prisma.serialNumber.createMany({
    data: validSerials.map((sn) => ({
      businessId,
      productId,
      serialNumber: sn,
      batchId: data.batchId ?? null,
      godownId: data.godownId ?? null,
      status: 'AVAILABLE',
    })),
  })

  return { created: result.count, errors }
}

export async function listSerialNumbers(
  businessId: string,
  productId: string,
  query: ListSerialNumbersQuery
) {
  await requireProduct(businessId, productId)

  const { cursor, limit, status, search } = query

  const where = {
    businessId,
    productId,
    ...(status ? { status } : {}),
    ...(search ? { serialNumber: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const serials = await prisma.serialNumber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: serialListSelect,
  })

  const hasMore = serials.length > limit
  if (hasMore) serials.pop()

  const total = await prisma.serialNumber.count({ where })

  return {
    serialNumbers: serials,
    total,
    pagination: { nextCursor: hasMore ? serials[serials.length - 1]?.id ?? null : null },
  }
}

export async function getSerialNumber(businessId: string, serialId: string) {
  const serial = await prisma.serialNumber.findFirst({
    where: { id: serialId, businessId },
    select: serialDetailSelect,
  })
  if (!serial) throw notFoundError('Serial number')
  return serial
}

export async function updateSerialNumber(
  businessId: string,
  serialId: string,
  data: UpdateSerialNumberInput
) {
  const serial = await prisma.serialNumber.findFirst({
    where: { id: serialId, businessId },
    select: { id: true },
  })
  if (!serial) throw notFoundError('Serial number')

  logger.info('Updating serial number', { businessId, serialId, status: data.status })

  return prisma.serialNumber.update({
    where: { id: serialId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    select: serialDetailSelect,
  })
}

export async function lookupBySerial(businessId: string, serialNumber: string) {
  const serial = await prisma.serialNumber.findFirst({
    where: { businessId, serialNumber },
    select: {
      ...serialDetailSelect,
      product: { select: { id: true, name: true, sku: true } },
      batch: { select: { id: true, batchNumber: true, expiryDate: true } },
      godown: { select: { id: true, name: true } },
      soldInDocument: {
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          party: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  })
  if (!serial) throw notFoundError('Serial number')
  return serial
}

const serialListSelect = {
  id: true,
  serialNumber: true,
  status: true,
  batchId: true,
  godownId: true,
  soldInDocumentId: true,
  createdAt: true,
} as const

const serialDetailSelect = {
  id: true,
  businessId: true,
  productId: true,
  serialNumber: true,
  status: true,
  batchId: true,
  godownId: true,
  soldInDocumentId: true,
  soldAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const
