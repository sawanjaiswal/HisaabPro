/**
 * Document Service — convertDocument
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { CreateDocumentInput, ConvertDocumentInput } from '../../schemas/document.schemas.js'
import { ALLOWED_CONVERSIONS } from './helpers.js'
import { createDocument } from './create.js'

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
      sourceDocumentId: undefined,
    },
  })

  // Link the new doc back to source
  await prisma.document.update({
    where: { id: (newDoc as { id: string }).id },
    data: { sourceDocumentId: documentId },
  })

  return newDoc
}
