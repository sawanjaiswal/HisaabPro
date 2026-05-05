/**
 * Custom Order Service — convertCustomOrderToInvoice
 * Reuses createDocument + recordPayment (no duplication). Mirrors Phase 3 pattern.
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, conflictError, notFoundError } from '../../lib/errors.js'
import { createDocument } from '../document/create.js'
import { ensureServicePlaceholder } from '../product/placeholders.js'
import { createPayment } from '../payment.service.js'

/** Map lowercase advance method to PAYMENT_MODES enum values. */
const METHOD_TO_MODE: Record<string, string> = {
  cash: 'CASH',
  upi: 'UPI',
  bank: 'BANK_TRANSFER',
  cheque: 'CHEQUE',
  card: 'CREDIT_CARD',
  other: 'OTHER',
}

/** Format a spec object as a compact one-liner appended to description. */
function formatSpecOneLiner(spec: Record<string, unknown>): string {
  const parts = Object.entries(spec)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      if (typeof v === 'object') return `${k}: {...}`
      return `${k}: ${v}`
    })
  if (parts.length === 0) return ''
  return ` (${parts.join(', ')})`
}

export async function convertCustomOrderToInvoice(
  businessId: string,
  orderId: string,
  userId: string
) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: {
      id: true,
      status: true,
      partyId: true,
      invoiceId: true,
      orderNumber: true,
      discountPaise: true,
      items: {
        select: {
          productId: true,
          description: true,
          quantity: true,
          ratePaise: true,
          discountPaise: true,
          spec: true,
        },
      },
      advances: {
        select: {
          id: true,
          amountPaise: true,
          method: true,
          reference: true,
          receivedAt: true,
          paymentId: true,
        },
      },
    },
  })
  if (!order) throw notFoundError('CustomOrder')

  // Already invoiced — replay-safe: surface the conflict so client can redirect
  if (order.invoiceId) {
    throw conflictError('Order is already invoiced (ALREADY_INVOICED)')
  }

  if (order.status === 'CANCELLED') {
    throw validationError('Cannot invoice a cancelled order')
  }
  if (order.status !== 'READY' && order.status !== 'DELIVERED') {
    throw validationError('Order must be READY or DELIVERED before invoicing')
  }

  // Resolve service placeholder for items without a productId
  const needsPlaceholder = order.items.some(it => !it.productId)
  const servicePlaceholderId = needsPlaceholder
    ? await ensureServicePlaceholder(businessId)
    : null

  const lineItems = order.items.map(it => ({
    productId: it.productId ?? servicePlaceholderId!,
    quantity: parseFloat(it.quantity.toString()),
    rate: it.ratePaise,
    discountType: 'AMOUNT' as const,
    discountValue: it.discountPaise,
    description: it.description + (it.spec ? formatSpecOneLiner(it.spec as Record<string, unknown>) : ''),
  }))

  // 1. Create the SALE_INVOICE — all heavy lifting in createDocument
  const invoice = await createDocument(businessId, userId, {
    type: 'SALE_INVOICE',
    status: 'SAVED',
    partyId: order.partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems,
    additionalCharges: [],
    includeSignature: false,
    notes: `Generated from Custom Order ${order.orderNumber ?? order.id}`,
    termsAndConditions: null,
  })

  const invoiceId = (invoice as unknown as { id: string }).id

  // 2. Replay each advance as a Payment row — keeps ledger + outstanding correct
  for (const adv of order.advances) {
    const mode = (METHOD_TO_MODE[adv.method] ?? 'OTHER') as
      'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'NEFT_RTGS_IMPS' | 'CREDIT_CARD' | 'OTHER'
    const payment = await createPayment(businessId, userId, {
      type: 'PAYMENT_IN',
      partyId: order.partyId,
      amount: adv.amountPaise,
      date: adv.receivedAt.toISOString().split('T')[0],
      mode,
      referenceNumber: adv.reference ?? undefined,
      allocations: [{ invoiceId, amount: adv.amountPaise }],
    })
    const paymentId = (payment as unknown as { id: string }).id
    await prisma.customOrderAdvance.update({
      where: { id: adv.id },
      data: { paymentId },
    })
  }

  // 3. Link both directions and move state — P2002 on unique = concurrent convert
  try {
    await prisma.customOrder.update({
      where: { id: orderId },
      data: { invoiceId, status: 'INVOICED', updatedBy: userId },
    })
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: string }).code === 'P2002'
    ) {
      throw conflictError('Order is already invoiced (ALREADY_INVOICED)')
    }
    throw err
  }

  return invoice
}
