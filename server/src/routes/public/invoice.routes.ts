/**
 * Public invoice route — GET /api/p/invoice/:token
 *
 * PR3 #130 — fills in the PR1 placeholder.
 *
 * Security invariants:
 *  - resolvePublicToken('INVOICE') is the FIRST call — no inline hash/revoke checks.
 *  - Response built via sanitizeInvoiceForPublic() — no Prisma spread.
 *  - No cookies read or written.
 *  - No requireAuth.
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { publicRateLimiter } from '../../middleware/public/rate-limit.js'
import { resolvePublicToken } from '../../middleware/resolve-public-token.js'
import { prisma } from '../../lib/prisma.js'
import { sanitizeInvoiceForPublic } from '../../services/sanitize-invoice-public.js'
import logger from '../../lib/logger.js'

const router = Router()

// ---------------------------------------------------------------------------
// Prisma select — minimal set needed to build PublicInvoiceDto
// Only allowlisted columns are fetched; nothing else reaches the handler.
// ---------------------------------------------------------------------------

const PUBLIC_INVOICE_SELECT = {
  id: true,
  documentNumber: true,
  type: true,
  status: true,
  documentDate: true,
  dueDate: true,
  currencyCode: true,
  subtotal: true,
  grandTotal: true,
  paidAmount: true,
  balanceDue: true,
  termsAndConditions: true,
  notes: true,
  lineItems: {
    select: {
      quantity: true,
      rate: true,
      lineTotal: true,
      product: {
        select: {
          name: true,
          unit: { select: { symbol: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  party: {
    select: { name: true },
  },
  business: {
    select: { name: true, gstin: true, upiVpa: true },
  },
} as const

// ---------------------------------------------------------------------------
// GET /api/p/invoice/:token
// ---------------------------------------------------------------------------

router.get(
  '/:token',
  publicRateLimiter('invoice'),
  resolvePublicToken('INVOICE'),
  asyncHandler(async (req, res) => {
    const link = req.publicLink!

    const doc = await prisma.document.findFirst({
      where: {
        id: link.resourceId,
        businessId: link.businessId, // IDOR guard — resource must belong to issuing business
        isDeleted: false,
      },
      select: PUBLIC_INVOICE_SELECT,
    })

    if (!doc) {
      // Defensive — should not happen if the link was correctly issued
      logger.warn('public invoice: document not found for active link', {
        linkId: link.id,
        resourceId: link.resourceId,
      })
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Invoice not found' },
      })
      return
    }

    const payload = sanitizeInvoiceForPublic(doc)
    res.status(200).json({ success: true, data: payload })
  })
)

export default router
