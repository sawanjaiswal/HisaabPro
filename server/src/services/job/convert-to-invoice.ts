/**
 * Job Service — convertJobToInvoice
 * Reuses createDocument from services/document/create.ts (no duplication).
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, conflictError } from '../../lib/errors.js'
import { notFoundError } from '../../lib/errors.js'
import { createDocument } from '../document/create.js'
import { ensureServicePlaceholder } from '../product/placeholders.js'

export async function convertJobToInvoice(
  businessId: string,
  jobId: string,
  userId: string
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: false },
    select: {
      id: true,
      status: true,
      partyId: true,
      invoiceId: true,
      jobNumber: true,
      items: {
        select: {
          productId: true,
          description: true,
          quantity: true,
          ratePaise: true,
          discountPaise: true,
        },
      },
    },
  })
  if (!job) throw notFoundError('Job')

  // Already invoiced — replay-safe: return existing invoice
  if (job.invoiceId) {
    const existing = await prisma.document.findUnique({
      where: { id: job.invoiceId },
    })
    if (existing) throw conflictError('Job is already invoiced (ALREADY_INVOICED)')
  }

  if (job.status === 'CANCELLED') {
    throw validationError('Cannot invoice a cancelled job')
  }
  if (job.status !== 'COMPLETED') {
    throw validationError('Job must be COMPLETED before invoicing')
  }

  // Resolve service placeholder for items without a productId
  const servicePlaceholderId = job.items.some(it => !it.productId)
    ? await ensureServicePlaceholder(businessId)
    : null

  const lineItems = job.items.map(it => ({
    productId: it.productId ?? servicePlaceholderId!,
    quantity: parseFloat(it.quantity.toString()),
    rate: it.ratePaise,
    discountType: 'AMOUNT' as const,
    discountValue: it.discountPaise,
  }))

  const invoice = await createDocument(businessId, userId, {
    type: 'SALE_INVOICE',
    status: 'SAVED',
    partyId: job.partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems,
    additionalCharges: [],
    includeSignature: false,
    notes: `Generated from Job ${job.jobNumber ?? job.id}`,
    termsAndConditions: null,
  })

  const invoiceId = (invoice as unknown as { id: string }).id

  // Link job to invoice — P2002 on unique means concurrent convert raced us
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: { invoiceId, status: 'INVOICED', updatedBy: userId },
    })
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: string }).code === 'P2002'
    ) {
      throw conflictError('Job is already invoiced (ALREADY_INVOICED)')
    }
    throw err
  }

  return invoice
}
