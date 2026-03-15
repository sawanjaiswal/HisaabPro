/**
 * Document Service — CRUD, conversion, recycle bin, settings
 * All stock/outstanding side effects happen atomically within transactions.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, reverseForInvoice } from './stock.service.js'
import { generateNextNumber } from './document-number.service.js'
import { calculateDocumentTotals, calculateChargeAmount } from './document-calc.js'
import logger from '../lib/logger.js'
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  ListDocumentsQuery,
  ConvertDocumentInput,
} from '../schemas/document.schemas.js'

// === Allowed conversion map ===
const ALLOWED_CONVERSIONS: Record<string, string[]> = {
  ESTIMATE: ['SALE_ORDER', 'SALE_INVOICE'],
  PROFORMA: ['SALE_INVOICE'],
  SALE_ORDER: ['SALE_INVOICE', 'DELIVERY_CHALLAN'],
  PURCHASE_ORDER: ['PURCHASE_INVOICE'],
  DELIVERY_CHALLAN: ['SALE_INVOICE'],
}

// Types that affect stock
const STOCK_DECREASE_TYPES = new Set(['SALE_INVOICE', 'DELIVERY_CHALLAN'])
const STOCK_INCREASE_TYPES = new Set(['PURCHASE_INVOICE'])

// Types that affect outstanding
const AFFECTS_OUTSTANDING = new Set(['SALE_INVOICE', 'PURCHASE_INVOICE'])

// === Shared select for list/detail ===

const DOCUMENT_LIST_SELECT = {
  id: true,
  type: true,
  status: true,
  documentNumber: true,
  documentDate: true,
  dueDate: true,
  subtotal: true,
  totalDiscount: true,
  totalAdditionalCharges: true,
  roundOff: true,
  grandTotal: true,
  totalProfit: true,
  paidAmount: true,
  balanceDue: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: { id: true, name: true, phone: true },
  },
  _count: {
    select: { lineItems: true },
  },
} as const

const DOCUMENT_DETAIL_SELECT = {
  id: true,
  type: true,
  status: true,
  documentNumber: true,
  sequenceNumber: true,
  financialYear: true,
  documentDate: true,
  dueDate: true,
  paymentTerms: true,
  shippingAddressId: true,
  subtotal: true,
  totalDiscount: true,
  totalAdditionalCharges: true,
  roundOff: true,
  grandTotal: true,
  totalCost: true,
  totalProfit: true,
  profitPercent: true,
  paidAmount: true,
  balanceDue: true,
  notes: true,
  termsAndConditions: true,
  includeSignature: true,
  vehicleNumber: true,
  driverName: true,
  transportNotes: true,
  sourceDocumentId: true,
  clientId: true,
  deletedAt: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: {
      id: true, name: true, phone: true, email: true, gstin: true,
      outstandingBalance: true,
      addresses: {
        select: {
          id: true, line1: true, line2: true, city: true,
          state: true, pincode: true, type: true, isDefault: true,
        },
      },
    },
  },
  lineItems: {
    select: {
      id: true, sortOrder: true, quantity: true, rate: true,
      discountType: true, discountValue: true, discountAmount: true,
      lineTotal: true, purchasePrice: true, profit: true, profitPercent: true,
      stockBefore: true, stockAfter: true,
      product: {
        select: {
          id: true, name: true, sku: true, currentStock: true,
          unit: { select: { symbol: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  additionalCharges: {
    select: {
      id: true, name: true, type: true, value: true, amount: true, sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  sourceDocument: {
    select: { id: true, type: true, documentNumber: true },
  },
  convertedTo: {
    select: { id: true, type: true, documentNumber: true },
  },
  shareLogs: {
    select: {
      id: true, channel: true, format: true, sentAt: true,
      recipientPhone: true, recipientEmail: true, fileUrl: true,
      fileSize: true, message: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: 'desc' as const },
    take: 20,
  },
  creator: { select: { id: true, name: true } },
} as const

// === Helpers ===

function requireDocument(doc: unknown) {
  if (!doc) throw notFoundError('Document')
  return doc
}

/** Get the round-off setting for a business */
async function getRoundOffSetting(businessId: string): Promise<string> {
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
    select: { roundOffTo: true },
  })
  return settings?.roundOffTo || 'NEAREST_1'
}

/** Apply outstanding balance change to party */
async function updateOutstanding(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  partyId: string,
  amount: number, // positive = receivable (sale), negative = payable (purchase)
) {
  await tx.party.update({
    where: { id: partyId },
    data: {
      outstandingBalance: { increment: amount },
      totalBusiness: { increment: Math.abs(amount) },
      lastTransactionAt: new Date(),
    },
  })
}

// === CRUD ===

export async function createDocument(
  businessId: string,
  userId: string,
  data: CreateDocumentInput
) {
  // Validate party belongs to business
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Fetch product data for calculations
  const productIds = data.lineItems.map(li => li.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, purchasePrice: true, currentStock: true },
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  // Verify all products exist
  for (const li of data.lineItems) {
    if (!productMap.has(li.productId)) {
      throw notFoundError(`Product ${li.productId}`)
    }
  }

  const roundOffSetting = await getRoundOffSetting(businessId)

  // Build calculation inputs
  const calcItems = data.lineItems.map(li => {
    const product = productMap.get(li.productId)!
    return {
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      purchasePrice: product.purchasePrice || 0,
    }
  })
  const calcCharges = data.additionalCharges.map(c => ({
    type: c.type,
    value: c.value,
  }))

  const totals = calculateDocumentTotals(calcItems, calcCharges, roundOffSetting)
  const isSaving = data.status === 'SAVED'

  return prisma.$transaction(async (tx) => {
    // Generate document number only when SAVING (not DRAFT)
    let numberData: { documentNumber: string; sequenceNumber: number; financialYear: string } | null = null
    if (isSaving) {
      numberData = await generateNextNumber(tx, businessId, data.type, new Date(data.documentDate))
    }

    // Create document
    const doc = await tx.document.create({
      data: {
        businessId,
        type: data.type,
        status: data.status,
        documentNumber: numberData?.documentNumber || null,
        sequenceNumber: numberData?.sequenceNumber || null,
        financialYear: numberData?.financialYear || null,
        partyId: data.partyId,
        shippingAddressId: data.shippingAddressId || null,
        documentDate: new Date(data.documentDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        paymentTerms: data.paymentTerms || null,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalAdditionalCharges: totals.totalAdditionalCharges,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        profitPercent: totals.profitPercent,
        balanceDue: totals.grandTotal, // initially full amount is due
        notes: data.notes || null,
        termsAndConditions: data.termsAndConditions || null,
        includeSignature: data.includeSignature,
        vehicleNumber: data.transportDetails?.vehicleNumber || null,
        driverName: data.transportDetails?.driverName || null,
        transportNotes: data.transportDetails?.transportNotes || null,
        createdBy: userId,
        clientId: data.clientId || null,
      },
    })

    // Create line items
    const lineItemData = data.lineItems.map((li, i) => {
      const product = productMap.get(li.productId)!
      const calc = totals.lineResults[i]
      return {
        documentId: doc.id,
        productId: li.productId,
        sortOrder: i,
        quantity: li.quantity,
        rate: li.rate,
        discountType: li.discountType,
        discountValue: li.discountValue,
        discountAmount: calc.discountAmount,
        lineTotal: calc.lineTotal,
        purchasePrice: product.purchasePrice || 0,
        profit: calc.profit,
        profitPercent: calc.profitPercent,
        stockBefore: product.currentStock,
        stockAfter: product.currentStock, // updated below if stock affected
      }
    })
    await tx.documentLineItem.createMany({ data: lineItemData })

    // Create additional charges
    if (data.additionalCharges.length > 0) {
      const chargeData = data.additionalCharges.map((c, i) => ({
        documentId: doc.id,
        name: c.name,
        type: c.type,
        value: c.value,
        amount: calculateChargeAmount(totals.subtotal, c.type, c.value),
        sortOrder: i,
      }))
      await tx.documentAdditionalCharge.createMany({ data: chargeData })
    }

    // Side effects only when SAVING
    if (isSaving) {
      // Stock effects
      if (STOCK_DECREASE_TYPES.has(data.type)) {
        await deductForSaleInvoice(tx, {
          businessId,
          invoiceId: doc.id,
          invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId, // base unit
          })),
          userId,
        })
      } else if (STOCK_INCREASE_TYPES.has(data.type)) {
        await addForPurchaseInvoice(tx, {
          businessId,
          invoiceId: doc.id,
          invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId,
          })),
          userId,
        })
      }

      // Outstanding effects
      if (AFFECTS_OUTSTANDING.has(data.type)) {
        const outstandingDelta = data.type === 'SALE_INVOICE'
          ? totals.grandTotal   // receivable
          : -totals.grandTotal  // payable
        await updateOutstanding(tx, data.partyId, outstandingDelta)
      }
    }

    // Fetch complete document for response
    return tx.document.findUniqueOrThrow({
      where: { id: doc.id },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })
}

export async function getDocument(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: { not: 'DELETED' } },
    select: DOCUMENT_DETAIL_SELECT,
  })
  return requireDocument(doc)
}

export async function listDocuments(businessId: string, query: ListDocumentsQuery) {
  const { type, status, partyId, fromDate, toDate, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    type,
    status: status
      ? { in: status.split(',').map(s => s.trim()) }
      : { in: ['SAVED', 'SHARED'] }, // default: exclude DRAFT and DELETED
  }
  if (partyId) where.partyId = partyId
  if (fromDate || toDate) {
    where.documentDate = {
      ...(fromDate && { gte: new Date(fromDate) }),
      ...(toDate && { lte: new Date(toDate) }),
    }
  }
  if (search) {
    where.OR = [
      { documentNumber: { contains: search, mode: 'insensitive' } },
      { party: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [documents, total, aggregates] = await Promise.all([
    prisma.document.findMany({
      where,
      select: DOCUMENT_LIST_SELECT,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.document.count({ where }),
    prisma.document.aggregate({
      where,
      _sum: { grandTotal: true, paidAmount: true, balanceDue: true },
    }),
  ])

  return {
    documents: documents.map(d => ({
      ...d,
      lineItemCount: d._count.lineItems,
      _count: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalAmount: aggregates._sum.grandTotal || 0,
      totalPaid: aggregates._sum.paidAmount || 0,
      totalDue: aggregates._sum.balanceDue || 0,
    },
  }
}

export async function updateDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: UpdateDocumentInput
) {
  const existing = await prisma.document.findFirst({
    where: { id: documentId, businessId },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      lineItems: { select: { productId: true, quantity: true } },
    },
  })
  if (!existing) throw notFoundError('Document')
  if (existing.status === 'CONVERTED') throw validationError('Cannot edit a converted document')
  if (existing.status === 'DELETED') throw validationError('Cannot edit a deleted document')

  const wasSaved = existing.status === 'SAVED' || existing.status === 'SHARED'
  const willBeSaved = data.status === 'SAVED' || (wasSaved && !data.status)

  return prisma.$transaction(async (tx) => {
    // If status was SAVED and we're updating, reverse side effects first
    if (wasSaved && (STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type))) {
      await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
    }
    if (wasSaved && AFFECTS_OUTSTANDING.has(existing.type)) {
      const reverseDelta = existing.type === 'SALE_INVOICE'
        ? -existing.grandTotal
        : existing.grandTotal
      await updateOutstanding(tx, existing.partyId, reverseDelta)
    }

    // Recalculate if line items changed
    let totals = null
    if (data.lineItems) {
      const productIds = data.lineItems.map(li => li.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, businessId },
        select: { id: true, purchasePrice: true, currentStock: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))

      for (const li of data.lineItems) {
        if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
      }

      const roundOffSetting = await getRoundOffSetting(businessId)
      const calcItems = data.lineItems.map(li => ({
        quantity: li.quantity,
        rate: li.rate,
        discountType: li.discountType,
        discountValue: li.discountValue,
        purchasePrice: productMap.get(li.productId)!.purchasePrice || 0,
      }))
      const calcCharges = (data.additionalCharges || []).map(c => ({ type: c.type, value: c.value }))
      totals = calculateDocumentTotals(calcItems, calcCharges, roundOffSetting)

      // Replace line items
      await tx.documentLineItem.deleteMany({ where: { documentId } })
      const lineItemData = data.lineItems.map((li, i) => {
        const product = productMap.get(li.productId)!
        const calc = totals!.lineResults[i]
        return {
          documentId,
          productId: li.productId,
          sortOrder: i,
          quantity: li.quantity,
          rate: li.rate,
          discountType: li.discountType,
          discountValue: li.discountValue,
          discountAmount: calc.discountAmount,
          lineTotal: calc.lineTotal,
          purchasePrice: product.purchasePrice || 0,
          profit: calc.profit,
          profitPercent: calc.profitPercent,
          stockBefore: product.currentStock,
          stockAfter: product.currentStock,
        }
      })
      await tx.documentLineItem.createMany({ data: lineItemData })

      // Replace charges
      if (data.additionalCharges) {
        await tx.documentAdditionalCharge.deleteMany({ where: { documentId } })
        if (data.additionalCharges.length > 0) {
          const chargeData = data.additionalCharges.map((c, i) => ({
            documentId,
            name: c.name,
            type: c.type,
            value: c.value,
            amount: calculateChargeAmount(totals!.subtotal, c.type, c.value),
            sortOrder: i,
          }))
          await tx.documentAdditionalCharge.createMany({ data: chargeData })
        }
      }
    }

    // Generate number if transitioning DRAFT → SAVED
    let numberData = null
    if (!wasSaved && willBeSaved) {
      const docDate = data.documentDate ? new Date(data.documentDate) : new Date()
      numberData = await generateNextNumber(tx, businessId, existing.type, docDate)
    }

    // Update document
    const updateData: Record<string, unknown> = {
      updatedBy: userId,
    }
    if (data.status) updateData.status = data.status
    if (data.partyId) updateData.partyId = data.partyId
    if (data.documentDate) updateData.documentDate = new Date(data.documentDate)
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms
    if (data.shippingAddressId !== undefined) updateData.shippingAddressId = data.shippingAddressId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions
    if (data.includeSignature !== undefined) updateData.includeSignature = data.includeSignature
    if (data.transportDetails !== undefined) {
      updateData.vehicleNumber = data.transportDetails?.vehicleNumber || null
      updateData.driverName = data.transportDetails?.driverName || null
      updateData.transportNotes = data.transportDetails?.transportNotes || null
    }
    if (numberData) {
      updateData.documentNumber = numberData.documentNumber
      updateData.sequenceNumber = numberData.sequenceNumber
      updateData.financialYear = numberData.financialYear
    }
    if (totals) {
      updateData.subtotal = totals.subtotal
      updateData.totalDiscount = totals.totalDiscount
      updateData.totalAdditionalCharges = totals.totalAdditionalCharges
      updateData.roundOff = totals.roundOff
      updateData.grandTotal = totals.grandTotal
      updateData.totalCost = totals.totalCost
      updateData.totalProfit = totals.totalProfit
      updateData.profitPercent = totals.profitPercent
      updateData.balanceDue = totals.grandTotal // reset balance (payments will re-attach)
    }

    await tx.document.update({
      where: { id: documentId },
      data: updateData,
    })

    // Re-apply side effects if saving
    const effectivePartyId = data.partyId || existing.partyId
    const effectiveGrandTotal = totals?.grandTotal ?? existing.grandTotal

    if (willBeSaved) {
      const lineItems = data.lineItems || existing.lineItems
      if (STOCK_DECREASE_TYPES.has(existing.type)) {
        const docNum = numberData?.documentNumber || ''
        await deductForSaleInvoice(tx, {
          businessId,
          invoiceId: documentId,
          invoiceNumber: docNum,
          items: lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId,
          })),
          userId,
        })
      } else if (STOCK_INCREASE_TYPES.has(existing.type)) {
        const docNum = numberData?.documentNumber || ''
        await addForPurchaseInvoice(tx, {
          businessId,
          invoiceId: documentId,
          invoiceNumber: docNum,
          items: lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId,
          })),
          userId,
        })
      }

      if (AFFECTS_OUTSTANDING.has(existing.type)) {
        const outstandingDelta = existing.type === 'SALE_INVOICE'
          ? effectiveGrandTotal
          : -effectiveGrandTotal
        await updateOutstanding(tx, effectivePartyId, outstandingDelta)
      }
    }

    return tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })
}

export async function deleteDocument(businessId: string, documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: { not: 'DELETED' } },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      lineItems: { select: { productId: true, quantity: true } },
    },
  })
  if (!doc) throw notFoundError('Document')
  if (doc.status === 'CONVERTED') throw validationError('Cannot delete a converted document')

  const wasSaved = doc.status === 'SAVED' || doc.status === 'SHARED'

  // Get retention days
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
    select: { recycleBinRetentionDays: true },
  })
  const retentionDays = settings?.recycleBinRetentionDays || 30
  const permanentDeleteAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

  return prisma.$transaction(async (tx) => {
    // Reverse side effects
    if (wasSaved) {
      if (STOCK_DECREASE_TYPES.has(doc.type) || STOCK_INCREASE_TYPES.has(doc.type)) {
        await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
      }
      if (AFFECTS_OUTSTANDING.has(doc.type)) {
        const reverseDelta = doc.type === 'SALE_INVOICE'
          ? -doc.grandTotal
          : doc.grandTotal
        await updateOutstanding(tx, doc.partyId, reverseDelta)
      }
    }

    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId,
        permanentDeleteAt,
      },
      select: { id: true, status: true, deletedAt: true, permanentDeleteAt: true },
    })

    return updated
  })
}

// === Conversion ===

export async function convertDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: ConvertDocumentInput
) {
  const source = await prisma.document.findFirst({
    where: { id: documentId, businessId },
    select: {
      id: true, type: true, status: true, partyId: true, documentDate: true,
      paymentTerms: true, shippingAddressId: true, notes: true,
      termsAndConditions: true, includeSignature: true,
      vehicleNumber: true, driverName: true, transportNotes: true,
      lineItems: {
        select: {
          productId: true, quantity: true, rate: true,
          discountType: true, discountValue: true,
        },
      },
      additionalCharges: {
        select: { name: true, type: true, value: true },
      },
      convertedTo: { select: { id: true } },
    },
  })
  if (!source) throw notFoundError('Document')
  if (source.status === 'DRAFT') throw validationError('Cannot convert a draft document')
  if (source.status === 'DELETED') throw validationError('Cannot convert a deleted document')
  if (source.convertedTo) throw validationError('Document has already been converted')

  const allowed = ALLOWED_CONVERSIONS[source.type]
  if (!allowed || !allowed.includes(data.targetType)) {
    throw validationError(`Cannot convert ${source.type} to ${data.targetType}`)
  }

  // Create new document as DRAFT (pre-filled from source)
  const newDoc = await createDocument(businessId, userId, {
    type: data.targetType,
    status: 'DRAFT',
    partyId: source.partyId,
    documentDate: new Date().toISOString().split('T')[0],
    paymentTerms: source.paymentTerms as CreateDocumentInput['paymentTerms'],
    shippingAddressId: source.shippingAddressId,
    notes: source.notes,
    termsAndConditions: source.termsAndConditions,
    includeSignature: source.includeSignature,
    lineItems: source.lineItems.map(li => ({
      productId: li.productId,
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType as 'AMOUNT' | 'PERCENTAGE',
      discountValue: li.discountValue,
    })),
    additionalCharges: source.additionalCharges.map(c => ({
      name: c.name,
      type: c.type as 'FIXED' | 'PERCENTAGE',
      value: c.value,
    })),
    transportDetails: data.targetType === 'DELIVERY_CHALLAN' ? {
      vehicleNumber: source.vehicleNumber,
      driverName: source.driverName,
      transportNotes: source.transportNotes,
    } : null,
  })

  // Mark source as CONVERTED and link
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'CONVERTED',
      sourceDocumentId: undefined, // keep as-is
    },
  })

  // Link the new doc back to source
  await prisma.document.update({
    where: { id: (newDoc as { id: string }).id },
    data: { sourceDocumentId: documentId },
  })

  return newDoc
}

// === Recycle Bin ===

export async function listRecycleBin(
  businessId: string,
  query: { type?: string; page: number; limit: number }
) {
  const where: Record<string, unknown> = {
    businessId,
    status: 'DELETED',
  }
  if (query.type) where.type = query.type

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: {
        ...DOCUMENT_LIST_SELECT,
        deletedAt: true,
        permanentDeleteAt: true,
      },
      orderBy: { deletedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.document.count({ where }),
  ])

  return {
    documents: documents.map(d => ({
      ...d,
      lineItemCount: d._count.lineItems,
      _count: undefined,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  }
}

export async function restoreDocument(businessId: string, documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: 'DELETED' },
    select: {
      id: true, type: true, partyId: true, grandTotal: true,
      lineItems: { select: { productId: true, quantity: true } },
      documentNumber: true,
    },
  })
  if (!doc) throw notFoundError('Document')

  return prisma.$transaction(async (tx) => {
    // Restore to SAVED status
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'SAVED',
        deletedAt: null,
        deletedBy: null,
        permanentDeleteAt: null,
        updatedBy: userId,
      },
    })

    // Re-apply stock effects
    if (STOCK_DECREASE_TYPES.has(doc.type)) {
      await deductForSaleInvoice(tx, {
        businessId,
        invoiceId: documentId,
        invoiceNumber: doc.documentNumber || '',
        items: doc.lineItems.map(li => ({
          productId: li.productId,
          quantity: li.quantity,
          unitId: li.productId,
        })),
        userId,
      })
    } else if (STOCK_INCREASE_TYPES.has(doc.type)) {
      await addForPurchaseInvoice(tx, {
        businessId,
        invoiceId: documentId,
        invoiceNumber: doc.documentNumber || '',
        items: doc.lineItems.map(li => ({
          productId: li.productId,
          quantity: li.quantity,
          unitId: li.productId,
        })),
        userId,
      })
    }

    // Re-apply outstanding
    if (AFFECTS_OUTSTANDING.has(doc.type)) {
      const outstandingDelta = doc.type === 'SALE_INVOICE'
        ? doc.grandTotal
        : -doc.grandTotal
      await updateOutstanding(tx, doc.partyId, outstandingDelta)
    }

    return tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })
}

export async function permanentDeleteDocument(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: 'DELETED' },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  await prisma.document.delete({ where: { id: documentId } })
}

export async function emptyRecycleBin(businessId: string) {
  const result = await prisma.document.deleteMany({
    where: { businessId, status: 'DELETED' },
  })
  return { deletedCount: result.count }
}

/** Cleanup expired recycle bin items — for cron job */
export async function cleanupExpiredDocuments() {
  const result = await prisma.document.deleteMany({
    where: {
      status: 'DELETED',
      permanentDeleteAt: { lte: new Date() },
    },
  })
  logger.info('Recycle bin cleanup', { deleted: result.count })
  return result.count
}
