/**
 * Payment Service — CRUD, allocations, outstanding, reminders
 * All amounts in PAISE (integer). Updates party outstanding atomically.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import { sendWhatsApp } from './notification.service.js'
import type {
  CreatePaymentInput,
  UpdatePaymentInput,
  ListPaymentsQuery,
  UpdateAllocationsInput,
  ListOutstandingQuery,
  SendReminderInput,
  SendBulkRemindersInput,
  ListRemindersQuery,
  UpdateReminderConfigInput,
} from '../schemas/payment.schemas.js'

// === Shared selects ===

const PAYMENT_LIST_SELECT = {
  id: true,
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  party: { select: { id: true, name: true, phone: true } },
  _count: { select: { allocations: true } },
  discount: { select: { calculatedAmount: true } },
} as const

const PAYMENT_DETAIL_SELECT = {
  id: true,
  offlineId: true,
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: {
      id: true, name: true, phone: true,
      outstandingBalance: true,
    },
  },
  allocations: {
    select: {
      id: true,
      amount: true,
      invoice: {
        select: { id: true, documentNumber: true, grandTotal: true, balanceDue: true },
      },
    },
  },
  discount: {
    select: {
      id: true, type: true, value: true,
      calculatedAmount: true, reason: true,
    },
  },
  creator: { select: { id: true, name: true } },
} as const

// === CRUD ===

export async function createPayment(
  businessId: string,
  userId: string,
  data: CreatePaymentInput
) {
  // Validate party
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Validate allocations sum <= amount
  const allocTotal = data.allocations.reduce((sum, a) => sum + a.amount, 0)
  if (allocTotal > data.amount) {
    throw validationError('Total allocations exceed payment amount')
  }

  // Validate allocation invoices exist and belong to business
  if (data.allocations.length > 0) {
    const invoiceIds = data.allocations.map(a => a.invoiceId)
    const invoices = await prisma.document.findMany({
      where: { id: { in: invoiceIds }, businessId, status: { in: ['SAVED', 'SHARED'] } },
      select: { id: true },
    })
    const foundIds = new Set(invoices.map(i => i.id))
    for (const a of data.allocations) {
      if (!foundIds.has(a.invoiceId)) throw notFoundError(`Invoice ${a.invoiceId}`)
    }
  }

  // Calculate discount
  let discountAmount = 0
  if (data.discount) {
    discountAmount = data.discount.type === 'PERCENTAGE'
      ? Math.round(data.amount * data.discount.value / 100)
      : Math.round(data.discount.value)
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: data.type,
        partyId: data.partyId,
        amount: data.amount,
        date: new Date(data.date),
        mode: data.mode,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        offlineId: data.offlineId || null,
        createdBy: userId,
      },
    })

    // Create allocations
    if (data.allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: data.allocations.map(a => ({
          paymentId: payment.id,
          invoiceId: a.invoiceId,
          amount: a.amount,
        })),
      })

      // Update invoice balanceDue and paidAmount (parallel — each invoiceId is distinct)
      await Promise.all(data.allocations.map(alloc =>
        tx.document.update({
          where: { id: alloc.invoiceId },
          data: {
            paidAmount: { increment: alloc.amount },
            balanceDue: { decrement: alloc.amount },
          },
        })
      ))
    }

    // Create discount
    if (data.discount) {
      await tx.paymentDiscount.create({
        data: {
          paymentId: payment.id,
          type: data.discount.type,
          value: data.discount.value,
          calculatedAmount: discountAmount,
          reason: data.discount.reason || null,
        },
      })
    }

    // Update party outstanding
    // PAYMENT_IN reduces receivable (outstanding goes down)
    // PAYMENT_OUT reduces payable (outstanding goes up)
    const effectiveAmount = data.amount + discountAmount
    const outstandingDelta = data.type === 'PAYMENT_IN'
      ? -effectiveAmount
      : effectiveAmount
    await tx.party.update({
      where: { id: data.partyId },
      data: {
        outstandingBalance: { increment: outstandingDelta },
        lastTransactionAt: new Date(),
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}

export async function getPayment(businessId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: PAYMENT_DETAIL_SELECT,
  })
  if (!payment) throw notFoundError('Payment')

  return {
    id: payment.id,
    offlineId: payment.offlineId,
    type: payment.type,
    amount: payment.amount,
    date: payment.date instanceof Date ? payment.date.toISOString().slice(0, 10) : payment.date,
    mode: payment.mode,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    partyId: payment.party.id,
    partyName: payment.party.name,
    partyPhone: payment.party.phone,
    partyOutstanding: payment.party.outstandingBalance,
    allocations: payment.allocations.map(a => ({
      id: a.id,
      invoiceId: a.invoice.id,
      invoiceNumber: a.invoice.documentNumber,
      invoiceTotal: a.invoice.grandTotal,
      invoiceDue: a.invoice.balanceDue,
      amount: a.amount,
    })),
    discount: payment.discount,
    createdBy: payment.creator ? { id: payment.creator.id, name: payment.creator.name } : null,
  }
}

export async function listPayments(businessId: string, query: ListPaymentsQuery) {
  const { type, partyId, mode, dateFrom, dateTo, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }
  if (type) where.type = type
  if (partyId) where.partyId = partyId
  if (mode) where.mode = mode
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { party: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const orderByField = sortBy === 'amount' ? 'amount' : sortBy === 'createdAt' ? 'createdAt' : 'date'

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: PAYMENT_LIST_SELECT,
      orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ])

  // Single groupBy replaces two separate aggregate calls
  const typeAgg = await prisma.payment.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
  })
  const totalIn = typeAgg.find(t => t.type === 'PAYMENT_IN')?._sum.amount || 0
  const totalOut = typeAgg.find(t => t.type === 'PAYMENT_OUT')?._sum.amount || 0

  return {
    payments: payments.map(p => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      date: p.date instanceof Date ? p.date.toISOString().slice(0, 10) : p.date,
      mode: p.mode,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
      createdAt: p.createdAt,
      partyId: p.party.id,
      partyName: p.party.name,
      partyPhone: p.party.phone,
      allocationsCount: p._count.allocations,
      hasDiscount: !!p.discount,
      discountAmount: p.discount?.calculatedAmount || 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    },
  }
}

export async function updatePayment(
  businessId: string,
  paymentId: string,
  userId: string,
  data: UpdatePaymentInput
) {
  const existing = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: { id: true, amount: true, partyId: true, type: true },
  })
  if (!existing) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // If amount changed, update party outstanding
    if (data.amount && data.amount !== existing.amount) {
      const amountDelta = data.amount - existing.amount
      const outstandingDelta = existing.type === 'PAYMENT_IN'
        ? -amountDelta
        : amountDelta
      await tx.party.update({
        where: { id: existing.partyId },
        data: { outstandingBalance: { increment: outstandingDelta } },
      })
    }

    const updateData: Record<string, unknown> = { updatedBy: userId }
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.date) updateData.date = new Date(data.date)
    if (data.mode) updateData.mode = data.mode
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber
    if (data.notes !== undefined) updateData.notes = data.notes

    await tx.payment.update({
      where: { id: paymentId },
      data: updateData,
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}

export async function deletePayment(businessId: string, paymentId: string, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: {
      id: true, type: true, partyId: true, amount: true,
      allocations: { select: { invoiceId: true, amount: true } },
      discount: { select: { calculatedAmount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // Reverse allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { decrement: alloc.amount },
          balanceDue: { increment: alloc.amount },
        },
      })
    ))

    // Reverse outstanding
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const reverseDelta = payment.type === 'PAYMENT_IN'
      ? effectiveAmount
      : -effectiveAmount
    await tx.party.update({
      where: { id: payment.partyId },
      data: { outstandingBalance: { increment: reverseDelta } },
    })

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      },
      select: { id: true, deletedAt: true },
    })

    return { id: updated.id, deletedAt: updated.deletedAt }
  })
}

export async function restorePayment(businessId: string, paymentId: string, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: true },
    select: {
      id: true, type: true, partyId: true, amount: true,
      allocations: { select: { invoiceId: true, amount: true } },
      discount: { select: { calculatedAmount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // Re-apply allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { increment: alloc.amount },
          balanceDue: { decrement: alloc.amount },
        },
      })
    ))

    // Re-apply outstanding
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const outstandingDelta = payment.type === 'PAYMENT_IN'
      ? -effectiveAmount
      : effectiveAmount
    await tx.party.update({
      where: { id: payment.partyId },
      data: { outstandingBalance: { increment: outstandingDelta } },
    })

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        isDeleted: false,
        deletedAt: null,
        updatedBy: userId,
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}

// === Allocations ===

export async function updateAllocations(
  businessId: string,
  paymentId: string,
  data: UpdateAllocationsInput
) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: {
      id: true, amount: true,
      allocations: { select: { id: true, invoiceId: true, amount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  const newAllocTotal = data.allocations.reduce((sum, a) => sum + a.amount, 0)
  if (newAllocTotal > payment.amount) {
    throw validationError('Total allocations exceed payment amount')
  }

  return prisma.$transaction(async (tx) => {
    // Reverse existing allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { decrement: alloc.amount },
          balanceDue: { increment: alloc.amount },
        },
      })
    ))
    await tx.paymentAllocation.deleteMany({ where: { paymentId } })

    // Apply new allocations
    if (data.allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: data.allocations.map(a => ({
          paymentId,
          invoiceId: a.invoiceId,
          amount: a.amount,
        })),
      })

      // Update invoice balances (parallel — each invoiceId is distinct)
      await Promise.all(data.allocations.map(alloc =>
        tx.document.update({
          where: { id: alloc.invoiceId },
          data: {
            paidAmount: { increment: alloc.amount },
            balanceDue: { decrement: alloc.amount },
          },
        })
      ))
    }

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}

// === Outstanding ===

export async function listOutstanding(businessId: string, query: ListOutstandingQuery) {
  const { type, overdue: _overdue, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isActive: true,
    outstandingBalance: { not: 0 },
  }

  if (type === 'RECEIVABLE') where.outstandingBalance = { gt: 0 }
  if (type === 'PAYABLE') where.outstandingBalance = { lt: 0 }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderByField = sortBy === 'amount' ? 'outstandingBalance'
    : sortBy === 'name' ? 'name'
    : 'lastTransactionAt'

  const [parties, total] = await Promise.all([
    prisma.party.findMany({
      where,
      select: {
        id: true, name: true, phone: true, type: true,
        outstandingBalance: true,
        lastTransactionAt: true,
        _count: {
          select: {
            documents: {
              where: { status: { in: ['SAVED', 'SHARED'] }, balanceDue: { gt: 0 } },
            },
          },
        },
      },
      orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.party.count({ where }),
  ])

  // Aggregate totals
  const [receivable, payable] = await Promise.all([
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
    }),
  ])

  const totalReceivable = receivable._sum.outstandingBalance || 0
  const totalPayable = Math.abs(payable._sum.outstandingBalance || 0)

  return {
    parties: parties.map(p => ({
      partyId: p.id,
      partyName: p.name,
      partyPhone: p.phone,
      partyType: p.type,
      outstanding: Math.abs(p.outstandingBalance),
      type: p.outstandingBalance > 0 ? 'RECEIVABLE' : 'PAYABLE',
      invoiceCount: p._count.documents,
      lastPaymentDate: p.lastTransactionAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    totals: {
      totalReceivable,
      totalPayable,
      net: totalReceivable - totalPayable,
    },
  }
}

export async function getPartyOutstanding(
  businessId: string,
  partyId: string,
  cursor?: string,
  limit = 20
) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true, name: true, phone: true, outstandingBalance: true,
    },
  })
  if (!party) throw notFoundError('Party')

  // Get outstanding invoices with cursor-based pagination
  const invoices = await prisma.document.findMany({
    where: {
      businessId,
      partyId,
      status: { in: ['SAVED', 'SHARED'] },
      balanceDue: { not: 0 },
    },
    select: {
      id: true, documentNumber: true, documentDate: true,
      dueDate: true, grandTotal: true, paidAmount: true, balanceDue: true, type: true,
    },
    orderBy: { documentDate: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  })

  const hasMore = invoices.length > limit
  const page = hasMore ? invoices.slice(0, limit) : invoices
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined

  return {
    partyId: party.id,
    partyName: party.name,
    outstanding: Math.abs(party.outstandingBalance),
    invoices: page.map(inv => ({
      id: inv.id,
      number: inv.documentNumber,
      date: inv.documentDate,
      dueDate: inv.dueDate,
      total: inv.grandTotal,
      paid: inv.paidAmount,
      due: inv.balanceDue,
      daysOverdue: inv.dueDate
        ? Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
    })),
    pagination: { hasMore, nextCursor },
  }
}

// === Reminders ===

export async function sendReminder(
  businessId: string,
  _userId: string,
  data: SendReminderInput
) {
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId },
    select: { id: true, name: true, phone: true },
  })
  if (!party) throw notFoundError('Party')

  const defaultMessage = `Hi ${party.name}, this is a reminder about your outstanding payment. Please make the payment at your earliest convenience.`
  const message = data.message || defaultMessage

  // Create reminder record with PENDING status, update after delivery attempt
  const reminder = await prisma.paymentReminder.create({
    data: {
      businessId,
      partyId: data.partyId,
      invoiceId: data.invoiceId || null,
      channel: data.channel,
      status: 'PENDING',
      message,
      sentAt: null,
      isAutomatic: false,
    },
    select: {
      id: true, channel: true, status: true, message: true,
      sentAt: true, isAutomatic: true, createdAt: true,
      party: { select: { id: true, name: true } },
    },
  })

  // Attempt actual delivery — never let notification failure crash the route
  try {
    let delivered = false

    if (data.channel === 'WHATSAPP' && party.phone) {
      const result = await sendWhatsApp({
        phone: party.phone,
        templateName: 'payment_reminder',
        templateParams: [party.name, message],
      })
      delivered = result.success
      if (!result.success) {
        logger.warn('Reminder WhatsApp delivery failed', {
          reminderId: reminder.id, error: result.error,
        })
      }
    } else if (data.channel === 'PUSH') {
      // TODO: Look up device tokens for party (requires device token storage)
      logger.info('Push reminder skipped — device token lookup not yet implemented', {
        reminderId: reminder.id,
      })
    }

    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: {
        status: delivered ? 'SENT' : 'FAILED',
        sentAt: delivered ? new Date() : null,
        failureReason: delivered ? null : 'Delivery attempt unsuccessful',
      },
    })

    reminder.status = delivered ? 'SENT' : 'FAILED'
    reminder.sentAt = delivered ? new Date() : null
  } catch (err) {
    logger.error('Reminder notification dispatch error', {
      reminderId: reminder.id,
      error: err instanceof Error ? err.message : err,
    })
    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: { status: 'FAILED', failureReason: 'Notification dispatch error' },
    })
    reminder.status = 'FAILED'
  }

  return reminder
}

export async function sendBulkReminders(
  businessId: string,
  _userId: string,
  data: SendBulkRemindersInput
) {
  const parties = await prisma.party.findMany({
    where: { id: { in: data.partyIds }, businessId },
    select: { id: true, name: true, phone: true },
  })
  const partyMap = new Map(parties.map(p => [p.id, p]))

  // Partition into valid (found) and invalid (not found) party IDs
  const validPartyIds = data.partyIds.filter(id => partyMap.has(id))
  const invalidPartyIds = data.partyIds.filter(id => !partyMap.has(id))

  const now = new Date()

  // Create all reminder records as PENDING
  if (validPartyIds.length > 0) {
    await prisma.paymentReminder.createMany({
      data: validPartyIds.map(partyId => {
        const party = partyMap.get(partyId)!
        return {
          businessId,
          partyId,
          channel: data.channel,
          status: 'PENDING',
          message: data.message || `Hi ${party.name}, this is a reminder about your outstanding payment.`,
          sentAt: null,
          isAutomatic: false,
        }
      }),
    })
  }

  // Attempt delivery for each valid party — fire-and-forget per party, don't block
  const results: Array<{ partyId: string; status: 'sent' | 'failed'; error?: string }> = [
    ...invalidPartyIds.map(partyId => ({ partyId, status: 'failed' as const, error: 'Party not found' })),
  ]

  // Fetch the reminder records we just created to get their IDs
  const reminders = validPartyIds.length > 0
    ? await prisma.paymentReminder.findMany({
        where: { businessId, partyId: { in: validPartyIds }, createdAt: { gte: now } },
        select: { id: true, partyId: true, message: true },
      })
    : []
  const reminderByParty = new Map(reminders.map(r => [r.partyId, r]))

  const deliveryTasks = validPartyIds.map(async (partyId) => {
    const party = partyMap.get(partyId)!
    const reminder = reminderByParty.get(partyId)
    try {
      let delivered = false

      if (data.channel === 'WHATSAPP' && party.phone) {
        const result = await sendWhatsApp({
          phone: party.phone,
          templateName: 'payment_reminder',
          templateParams: [party.name, reminder?.message ?? ''],
        })
        delivered = result.success
      }

      if (reminder) {
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: delivered ? 'SENT' : 'FAILED',
            sentAt: delivered ? new Date() : null,
            failureReason: delivered ? null : 'Delivery unsuccessful',
          },
        })
      }

      results.push({
        partyId,
        status: delivered ? 'sent' : 'failed',
        error: delivered ? undefined : 'Delivery unsuccessful',
      })
    } catch (err) {
      logger.error('Bulk reminder delivery error', {
        partyId,
        error: err instanceof Error ? err.message : err,
      })
      if (reminder) {
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', failureReason: 'Notification dispatch error' },
        }).catch(() => { /* swallow update failure — already logged */ })
      }
      results.push({ partyId, status: 'failed', error: 'Notification dispatch error' })
    }
  })

  await Promise.all(deliveryTasks)

  const sentCount = results.filter(r => r.status === 'sent').length
  const failedCount = results.filter(r => r.status === 'failed').length

  return {
    sent: sentCount,
    failed: failedCount,
    results,
  }
}

export async function listReminders(businessId: string, query: ListRemindersQuery) {
  const { partyId, invoiceId, status, channel, dateFrom, dateTo, page, limit } = query

  const where: Record<string, unknown> = { businessId }
  if (partyId) where.partyId = partyId
  if (invoiceId) where.invoiceId = invoiceId
  if (status) where.status = { in: status.split(',').map(s => s.trim()) }
  if (channel) where.channel = channel
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }

  const [reminders, total] = await Promise.all([
    prisma.paymentReminder.findMany({
      where,
      select: {
        id: true, channel: true, status: true, message: true,
        sentAt: true, failureReason: true, isAutomatic: true, createdAt: true,
        party: { select: { id: true, name: true } },
        invoice: { select: { id: true, documentNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentReminder.count({ where }),
  ])

  return {
    reminders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getReminderConfig(businessId: string) {
  const config = await prisma.reminderConfig.findUnique({
    where: { businessId },
  })
  return config || {
    businessId,
    enabled: true,
    autoRemindEnabled: false,
    frequencyDays: [1, 3, 7],
    maxRemindersPerInvoice: 5,
    defaultChannel: 'WHATSAPP',
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
    whatsappTemplate: null,
    smsTemplate: null,
  }
}

export async function updateReminderConfig(
  businessId: string,
  data: UpdateReminderConfigInput
) {
  return prisma.reminderConfig.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  })
}
