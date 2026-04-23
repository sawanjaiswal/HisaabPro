/**
 * Document quick-sale + validate-stock sub-router
 * POST /validate-stock · POST /quick-sale
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { requirePermission } from '../../middleware/permission.js'
import { requirePlan } from '../../middleware/subscription-gate.js'
import { sendSuccess } from '../../lib/response.js'
import { validateStockSchema } from '../../schemas/document.schemas.js'
import { quickSaleSchema } from '../../schemas/product.schemas.js'
import * as documentService from '../../services/document.service.js'
import { validateStockForInvoice } from '../../services/stock.service.js'
import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

const router = Router()

/** POST /api/documents/validate-stock — Pre-save stock availability check */
router.post(
  '/validate-stock',
  requirePermission('invoicing.view'),
  validate(validateStockSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { items } = req.body as { items: Array<{ productId: string; quantity: number; unitId: string }> }
    const result = await validateStockForInvoice(businessId, items)
    sendSuccess(res, result)
  })
)

/** POST /api/documents/quick-sale — Feature #110: POS one-shot sale + payment */
router.post(
  '/quick-sale',
  requirePlan('BUSINESS'),
  requirePermission('invoicing.create'),
  idempotencyCheck(),
  validate(quickSaleSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { items, paymentMode, amountPaid, partyId } = req.body as {
      items: Array<{ productId: string; quantity: number; price?: number }>
      paymentMode: string
      amountPaid: number
      partyId?: string
    }

    // Resolve party — use supplied or find/create walk-in customer
    let resolvedPartyId: string
    if (partyId) {
      const party = await prisma.party.findFirst({
        where: { id: partyId, businessId, isActive: true },
        select: { id: true },
      })
      if (!party) throw notFoundError('Party')
      resolvedPartyId = party.id
    } else {
      const walkinParty = await prisma.party.upsert({
        where: { businessId_phone: { businessId, phone: 'WALKIN' } },
        create: {
          businessId,
          name: 'Walk-in Customer',
          phone: 'WALKIN',
          type: 'CUSTOMER',
        },
        update: {},
        select: { id: true },
      })
      resolvedPartyId = walkinParty.id
    }

    // Resolve product prices for line items
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId, status: 'ACTIVE' },
      select: { id: true, salePrice: true, name: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) throw notFoundError(`Product ${item.productId}`)
      return {
        productId: item.productId,
        quantity: item.quantity,
        rate: item.price ?? product.salePrice,
        discountType: 'AMOUNT' as const,
        discountValue: 0,
      }
    })

    // Create invoice (SAVED = auto generates number + deducts stock)
    const today = new Date().toISOString().split('T')[0]
    const invoice = await documentService.createDocument(businessId, userId, {
      type: 'SALE_INVOICE',
      status: 'SAVED',
      partyId: resolvedPartyId,
      documentDate: today,
      lineItems,
      additionalCharges: [],
      includeSignature: false,
    })

    const invoiceData = invoice as { id: string; grandTotal: number; balanceDue: number }

    const payment = await prisma.$transaction(async (tx) => {
      const pmt = await tx.payment.create({
        data: {
          businessId,
          type: 'PAYMENT_IN',
          partyId: resolvedPartyId,
          amount: amountPaid,
          date: new Date(),
          mode: paymentMode,
          createdBy: userId,
        },
        select: { id: true, amount: true, mode: true, date: true },
      })

      const allocationAmt = Math.min(amountPaid, invoiceData.grandTotal)
      if (allocationAmt > 0) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: pmt.id,
            invoiceId: invoiceData.id,
            amount: allocationAmt,
          },
        })

        await tx.document.update({
          where: { id: invoiceData.id },
          data: {
            paidAmount: allocationAmt,
            balanceDue: Math.max(0, invoiceData.grandTotal - allocationAmt),
          },
        })
      }

      return pmt
    })

    const changeAmount = Math.max(0, amountPaid - invoiceData.grandTotal)

    sendSuccess(res, {
      invoice: {
        id: invoiceData.id,
        grandTotal: invoiceData.grandTotal,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        mode: payment.mode,
        changeAmount,
      },
    }, 201)
  })
)

export default router
